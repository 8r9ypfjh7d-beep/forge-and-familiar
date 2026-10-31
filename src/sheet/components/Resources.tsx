import { useState } from 'react'
import { isValidNotation } from '../../dice'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { featureUseContext, getMaxHp, getResources, getSpellSlots, SORCERY_POOLS, planUse, type ResourceInfo, type UseOption, type UsePlan } from '../../rules'
import { LastRoll, type Shown } from '../combat/LastRoll'
import { fitsBudget, recoverableSlots, spendResource, withForm } from '../uses'
import type { MessageKey } from '../../i18n'
import type { BeastForm } from '../../model/character'
import { FormPicker } from './WildShape'
import { DAWN_ITEMS } from '../../rules/data/dawnItems'
import { dawn, dawnCounters, removeCounter, setResourceUsed, upsertCounter, type Counter } from '../engine'
import { useSheetRolls } from '../dice'
import type { Apply } from '../types'
import { Pips, Stepper } from './Pips'
import { itemSpellCaster, useCast } from '../../spellbook/Cast'
import { useSpells } from './Effects'
import { itemSpellsOf } from './SpellSlots'

const RECHARGE = { short: 'rest.short', long: 'rest.long', dawn: 'rest.dawn', none: 'rest.none' } as const
/** Pools larger than this show a stepper instead of a row of pips. */
const PIP_LIMIT = 10

export function Resources({ character, apply }: { character: Character; apply: Apply }) {
  // Sorcery points have their own pips on the Metamagic card, and custom actions' uses sit on the action's row, so neither shows twice.
  const resources = getResources(character).filter(r => !SORCERY_POOLS.includes(r.id) && !r.id.startsWith('act:'))
  const counters = character.state.counters ?? []
  const { t, term } = useI18n()
  const rolls = useSheetRolls(character)
  const atDawn = dawnCounters(character)
  // Item charges (from an item's effects) that come back at dawn, with what is spent.
  const dawnItems = resources.filter(r => r.recharge === 'dawn').map(r => ({ ...r, used: character.state.resources[r.id]?.used ?? 0 }))

  const [out, setOut] = useState<{ key: number; name: string; rolls: Shown[]; note?: string } | null>(null)
  const uses = useResourceUse(character, apply, o => setOut(p => ({ key: (p?.key ?? 0) + 1, ...o })))
  const { use: spendUse, pool, setPool, spendPool } = uses
  // A race's or feat's once-per-rest spell (Hellish Rebuke) is cast by Use, the same as its Cast under Spells.
  const spells = useSpells(character)
  const casting = useCast(character, apply)
  const spellCaster = itemSpellCaster(spells, casting.cast)
  const spellOf = (r: ResourceInfo) => (r.id.startsWith('spell:') ? itemSpellsOf(character).find(s => s.useId === r.id) : undefined)

  /** One tap: casts a spell resource, or spends a use, rolls its healing (Second Wind) and starts its effect (Rage shows under Effects). */
  const use = (r: ResourceInfo, label: string) => {
    const spell = spellOf(r)
    if (spell && spellCaster.can(spell)) {
      const cast = spellCaster.cast(spell)
      if (cast) setOut(o => ({ key: (o?.key ?? 0) + 1, name: cast.name, rolls: cast.rolls, note: cast.note }))
      return
    }
    spendUse(r, label)
  }

  const onDawn = () => {
    const rolled: Record<string, number> = {}
    for (const k of atDawn) if (k.used > 0 && k.regain?.trim()) rolled[k.id] = rolls.total(k.regain, t('sheet.atDawn', { label: k.label }))
    for (const r of dawnItems) if (r.used > 0 && r.regain) rolled[r.id] = rolls.total(r.regain, t('sheet.atDawn', { label: r.label }))
    apply(t('sheet.log.dawn'), c => dawn(c, rolled))
  }

  return (
    <section className="card" aria-labelledby="res-title">
      <h2 id="res-title">{t('sheet.resources')}</h2>
      {resources.length === 0 && counters.length === 0 && <p className="hint">{t('sheet.resources.empty')}</p>}
      {out && (
        <div className="use-out" key={out.key}>
          <strong>{out.name}</strong>
          <LastRoll rolls={out.rolls} note={out.note} onDone={() => setOut(null)} />
        </div>
      )}
      <ul className="track-list">
        {resources.map(r => {
          const used = character.state.resources[r.id]?.used ?? 0
          const label = term('resource', r.id, r.label)
          const set = (u: number) => apply(t(u > used ? 'sheet.log.used' : 'sheet.log.regained', { label }), c => setResourceUsed(c, r.id, u))
          return (
            <li key={r.id}>
              <span className="track-label">{label}<small>{t(RECHARGE[r.recharge])}{r.regain ? t('sheet.regains', { dice: r.regain }) : ''}</small></span>
              {r.max <= PIP_LIMIT
                ? <Pips total={r.max} used={used} label={label} onChange={set} />
                : <Stepper value={r.max - used} max={r.max} label={label} onChange={v => set(r.max - v)} />}
              {r.max <= PIP_LIMIT && <span className="track-count">{r.max - used}/{r.max}</span>}
              <button type="button" className="glass-btn small prominent track-use" aria-label={t('use.useName', { label })} aria-expanded={pool === r.id || undefined} onClick={() => (pool === r.id ? setPool(null) : use(r, label))}>{t('use.use')}</button>
              {pool === r.id && <PoolForm left={r.max - used} missing={Math.max(0, getMaxHp(character) - character.state.currentHp)} label={label} onSpend={(n, self) => spendPool(r, label, n, self)} />}
              <UsePanel uses={uses} resource={r} label={label} character={character} />
            </li>
          )
        })}
        {counters.map(k => (
          <li key={k.id}>
            <span className="track-label">{k.label}<small>{t(RECHARGE[k.recharge])}{k.recharge === 'dawn' && k.regain ? t('sheet.regains', { dice: k.regain }) : ''}</small></span>
            <Stepper value={k.max - k.used} max={k.max} label={k.label}
              onChange={v => apply(t(k.max - v > k.used ? 'sheet.log.used' : 'sheet.log.regained', { label: k.label }), c => upsertCounter(c, { ...k, used: k.max - v }))} />
            <button type="button" className="btn ghost small" aria-label={t('sheet.removeWhat', { label: k.label })}
              onClick={() => confirm(t('sheet.confirmRemove', { name: k.label })) && apply(t('sheet.log.removedTracker', { label: k.label }), c => removeCounter(c, k.id))}>{t('common.remove')}</button>
          </li>
        ))}
      </ul>
      {atDawn.length + dawnItems.length > 0 && (
        <button type="button" className="btn small dawn" disabled={[...atDawn, ...dawnItems].every(k => k.used === 0)} onClick={onDawn}>
          {t('sheet.dawnButton')}
        </button>
      )}
      <AddCounter onAdd={k => apply(t('sheet.log.addedTracker', { label: k.label }), c => upsertCounter(c, k))} />
    </section>
  )
}


export interface UseOut { name: string; rolls: Shown[]; note?: string }

/** What a Use asks before it happens: a beast (Wild Shape), slots to take back (Arcane Recovery) or an option (Channel Divinity). */
type Panel =
  | { id: string; form: NonNullable<UsePlan['form']> }
  | { id: string; recover: NonNullable<UsePlan['recover']> }
  | { id: string; options: UseOption[] }

/**
 * Using a resource in one tap: spends a use, rolls its healing (Second Wind) and starts its effect (Rage shows under Effects).
 * A pool (Lay on Hands) asks how many points first: `pool` is the resource whose PoolForm is open. Wild Shape, Arcane Recovery
 * and Channel Divinity ask their question in `panel` (shown by UsePanel).
 */
export function useResourceUse(character: Character, apply: Apply, show: (o: UseOut) => void) {
  const { t, term, abilityShort } = useI18n()
  const rolls = useSheetRolls(character)
  const [pool, setPoolId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const setPool = (id: string | null) => { setPoolId(id); setPanel(null) }
  const planOf = (r: ResourceInfo, label: string) => planUse(r.id, label, featureUseContext(character, r.id))

  /** Spends points from a pool: on yourself they heal you, on an ally they are only spent. */
  const spendPool = (r: ResourceInfo, label: string, n: number, self: boolean) => {
    const left = r.max - (character.state.resources[r.id]?.used ?? 0)
    apply(t(self ? 'use.log.poolSelf' : 'use.log.pool', { label, n }), c => spendResource(c, r.id, planOf(r, label), self ? { heal: n } : {}, n))
    show({ name: label, rolls: [], note: [self ? t('cast.healed', { n }) : t('use.spentPool', { n }), t('use.left', { n: Math.max(0, left - n), max: r.max })].join(' · ') })
    setPool(null)
  }

  /**
   * Spends the use and does the rest: healing and damage rolls, temp HP, the die to give, pact slots or picked slots back,
   * a pool refilled, the effect (with its beast form) and the note on what the sheet can't do for you.
   */
  const finish = (r: ResourceInfo, label: string, plan: UsePlan, picked: { form?: BeastForm; slots?: number[] } = {}) => {
    const { form, slots } = picked
    const shown: Shown[] = []
    let healed: number | undefined
    if (plan.heal) {
      const roll = rolls.spell(label, { damage: plan.heal, damageType: 'healing' }).damage
      if (roll) { shown.push({ roll, what: t('cs.roll.healing') }); healed = roll.total }
    }
    if (plan.hit) {
      const roll = rolls.spell(label, { damage: plan.hit.dice, damageType: plan.hit.type }).damage
      const type = plan.hit.type ? term('damage', plan.hit.type, plan.hit.type) : ''
      if (roll) shown.push({ roll, what: t(type ? 'cs.roll.damage' : 'cs.roll.damagePlain', { type }) })
    }
    const tempHp = plan.tempHp ? Number(plan.tempHp) || undefined : undefined
    const left = r.max - (character.state.resources[r.id]?.used ?? 0)
    const refill = plan.refill && getResources(character).find(x => x.id === plan.refill)
    const notes = [
      plan.save ? t('cs.saveNote', { dc: plan.save.dc, ability: abilityShort(plan.save.ability) }) : '',
      plan.area?.cone && plan.area.line ? t('use.area.either', { cone: plan.area.cone, w: plan.area.line[0], l: plan.area.line[1] })
        : plan.area?.cone ? t('use.area.cone', { cone: plan.area.cone }) : plan.area?.line ? t('use.area.line', { w: plan.area.line[0], l: plan.area.line[1] }) : '',
      plan.note ? t(`use.note.${plan.note.key}` as MessageKey, plan.note.vars) : '',
      plan.give ? t('use.give', { die: plan.give }) : '',
      plan.pactSlots ? t('use.pactBack', { n: plan.pactSlots }) : '',
      slots?.length ? t('use.slotsBack', { levels: slots.join(', ') }) : '',
      refill ? t('use.refilled', { label: term('resource', refill.id, refill.label), n: refill.max }) : '',
      form ? t('ws.became', { name: form.name, ac: form.ac, hp: form.hp }) : '',
      tempHp ? (tempHp <= character.state.tempHp ? t('cast.keptTempHp', { n: character.state.tempHp }) : t('cast.gotTempHp', { n: tempHp })) : '',
      left <= 0 ? t('use.noneLeft') : t('use.left', { n: left - 1, max: r.max }),
      plan.effect ? t('cast.inEffect') : '', healed ? t('cast.healed', { n: healed }) : '',
    ].filter(Boolean)
    const done = form ? withForm(plan, form) : plan
    apply(t('use.log', { label }), c => spendResource(c, r.id, done, { heal: healed, tempHp, slots }))
    show({ name: form ? `${label}: ${form.name}` : label, rolls: shown, note: notes.join(' · ') })
  }

  const use = (r: ResourceInfo, label: string) => {
    const plan = planOf(r, label)
    if (plan.pool && pool !== r.id) return setPool(r.id)
    // Wild Shape, Arcane Recovery and Channel Divinity ask first; tapping Use again closes the question.
    const ask = plan.form ? { form: plan.form } : plan.recover ? { recover: plan.recover } : plan.options?.length ? { options: plan.options } : undefined
    if (ask) {
      setPoolId(null)
      return setPanel(p => (p?.id === r.id ? null : { id: r.id, ...ask }))
    }
    finish(r, label, plan)
  }

  const pickForm = (r: ResourceInfo, label: string, form: BeastForm) => {
    setPanel(null)
    finish(r, label, planOf(r, label), { form })
  }
  const pickSlots = (r: ResourceInfo, label: string, slots: number[]) => {
    setPanel(null)
    finish(r, label, planOf(r, label), { slots })
  }
  /** Channel Divinity: the picked option is what the use does, under its own name. */
  const pickOption = (r: ResourceInfo, label: string, o: UseOption) => {
    setPanel(null)
    finish(r, `${label}: ${term('feature', o.name, o.name)}`, o.plan)
  }

  return { use, pool, setPool, spendPool, panel, pickForm, pickSlots, pickOption }
}

/** The question a Use is waiting on for this resource, if any: a beast, slots to recover, or an option. */
export function UsePanel({ uses, resource: r, label, character }: { uses: ReturnType<typeof useResourceUse>; resource: ResourceInfo; label: string; character: Character }) {
  const p = uses.panel
  if (!p || p.id !== r.id) return null
  if ('form' in p) return <FormPicker character={character} limit={p.form} label={label} onPick={f => uses.pickForm(r, label, f)} />
  if ('recover' in p) return <SlotRecovery character={character} {...p.recover} label={label} onPick={slots => uses.pickSlots(r, label, slots)} />
  return <OptionPicker options={p.options} label={label} onPick={o => uses.pickOption(r, label, o)} />
}

/** Arcane Recovery: how many spent slots of each level to take back, within the level budget. */
function SlotRecovery({ character, budget, maxLevel, label, onPick }: { character: Character; budget: number; maxLevel: number; label: string; onPick: (slots: number[]) => void }) {
  const { t } = useI18n()
  const spent = recoverableSlots(character, getSpellSlots(character).slots, maxLevel)
  const [n, setN] = useState<number[]>(() => spent.map(() => 0))
  const picked = n.flatMap((k, i) => Array.from({ length: Math.min(k, spent[i]) }, () => i + 1))
  const total = picked.reduce((a, b) => a + b, 0)
  const ok = picked.length > 0 && fitsBudget(picked, budget)
  return (
    <div className="pool-form use-panel" role="group" aria-label={t('use.recoverName', { label })}>
      <p className="hint">{t('use.recoverBudget', { n: budget, max: maxLevel })}</p>
      {spent.every(k => k === 0) && <p className="hint">{t('use.recoverNone')}</p>}
      {spent.map((k, i) => k > 0 && (
        <span key={i} className="use-slot">
          <span>{t(`sheet.slot.${i + 1}` as MessageKey)}</span>
          <Stepper value={n[i]} max={k} label={t(`sheet.slot.${i + 1}` as MessageKey)} onChange={v => setN(x => x.map((y, j) => (j === i ? Math.max(0, v) : y)))} />
        </span>
      ))}
      <span className={total > budget ? 'hint over' : 'hint'}>{t('use.recoverTotal', { n: total, max: budget })}</span>
      <button type="button" className="glass-btn small prominent" disabled={!ok} onClick={() => onPick(picked)}>{t('use.recover')}</button>
    </div>
  )
}

/** Channel Divinity: which option this use is. */
function OptionPicker({ options, label, onPick }: { options: UseOption[]; label: string; onPick: (o: UseOption) => void }) {
  const { t, term, abilityShort } = useI18n()
  return (
    <div className="pool-form use-panel" role="group" aria-label={t('use.optionName', { label })}>
      {options.map(o => (
        <button key={o.id} type="button" className="glass-btn small" onClick={() => onPick(o)}>
          {term('feature', o.name, o.name)}
          {o.plan.save && <small> · {t('cs.saveNote', { dc: o.plan.save.dc, ability: abilityShort(o.plan.save.ability) })}</small>}
        </button>
      ))}
    </div>
  )
}

/** How many points to spend from a pool, then on me (heals) or on an ally. */
export function PoolForm({ left, missing, label, onSpend }: { left: number; missing: number; label: string; onSpend: (n: number, self: boolean) => void }) {
  const { t } = useI18n()
  const [n, setN] = useState(Math.max(1, Math.min(left, missing || 5)))
  const amount = Math.max(1, Math.min(left, n))
  return (
    <div className="pool-form" role="group" aria-label={t('use.poolName', { label })}>
      <Stepper value={amount} max={Math.max(1, left)} label={t('use.poolAmount')} onChange={setN} />
      <button type="button" className="glass-btn small prominent" disabled={left <= 0} onClick={() => onSpend(amount, true)}>{t('use.poolSelf', { n: amount })}</button>
      <button type="button" className="glass-btn small" disabled={left <= 0} onClick={() => onSpend(amount, false)}>{t('use.poolAlly', { n: amount })}</button>
    </div>
  )
}

function AddCounter({ onAdd }: { onAdd: (k: Counter) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [max, setMax] = useState('20')
  const [recharge, setRecharge] = useState<Counter['recharge']>('none')
  const [regain, setRegain] = useState('')
  const regainOk = !regain.trim() || isValidNotation(regain.trim())
  const { t } = useI18n()

  if (!open) return <button type="button" className="btn ghost" onClick={() => setOpen(true)}>{t('sheet.addTracker')}</button>

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Math.floor(Number(max))
    if (!label.trim() || !(n > 0) || !regainOk) return
    const dice = recharge === 'dawn' && regain.trim() ? { regain: regain.trim() } : {}
    onAdd({ id: `custom-${Date.now().toString(36)}`, label: label.trim(), max: n, used: 0, recharge, ...dice })
    setLabel(''); setMax('20'); setRecharge('none'); setRegain(''); setOpen(false)
  }

  const preset = (id: string) => {
    const item = DAWN_ITEMS.find(i => i.id === id)
    if (!item) return
    setLabel(item.name); setMax(String(item.charges)); setRecharge('dawn'); setRegain(item.regain ?? '')
  }

  return (
    <form className="add-counter" onSubmit={submit}>
      <label className="wide">{t('sheet.tracker.preset')}
        <select value="" onChange={e => preset(e.target.value)}>
          <option value="">{t('sheet.tracker.presetPick')}</option>
          {DAWN_ITEMS.map(i => <option key={i.id} value={i.id}>{i.name} ({i.charges}{i.regain ? `, +${i.regain}` : ''})</option>)}
        </select>
      </label>
      <label>{t('sheet.tracker.name')}<input value={label} onChange={e => setLabel(e.target.value)} placeholder={t('sheet.tracker.placeholder')} autoFocus /></label>
      <label>{t('sheet.tracker.max')}<input value={max} onChange={e => setMax(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></label>
      <label>{t('sheet.tracker.recharge')}
        <select value={recharge} onChange={e => setRecharge(e.target.value as Counter['recharge'])}>
          <option value="none">{t('rest.none')}</option>
          <option value="short">{t('rest.short')}</option>
          <option value="long">{t('rest.long')}</option>
          <option value="dawn">{t('rest.dawnOption')}</option>
        </select>
      </label>
      {recharge === 'dawn' && (
        <label className="wide">Regains at dawn
          <input value={regain} onChange={e => setRegain(e.target.value)} placeholder="1d6+1, blank for all"
            aria-invalid={!regainOk} />
        </label>
      )}
      <div className="row">
        <button type="submit" className="btn primary">{t('common.add')}</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

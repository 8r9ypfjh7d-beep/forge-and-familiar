import { useState } from 'react'
import { isValidNotation } from '../../dice'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { getMaxHp, getResources, planUse, resourceClassLevel, rulesEdition, type ResourceInfo } from '../../rules'
import { LastRoll, type Shown } from '../combat/LastRoll'
import { spendResource } from '../uses'
import { DAWN_ITEMS } from '../../rules/data/dawnItems'
import { dawn, dawnCounters, removeCounter, setResourceUsed, upsertCounter, type Counter } from '../engine'
import { useSheetRolls } from '../dice'
import type { Apply } from '../types'
import { SORCERY_POINTS } from './Metamagic'
import { Pips, Stepper } from './Pips'
import { itemSpellCaster, useCast } from '../../spellbook/Cast'
import { useSpells } from './Effects'
import { itemSpellsOf } from './SpellSlots'

const RECHARGE = { short: 'rest.short', long: 'rest.long', dawn: 'rest.dawn', none: 'rest.none' } as const
/** Pools larger than this show a stepper instead of a row of pips. */
const PIP_LIMIT = 10

export function Resources({ character, apply }: { character: Character; apply: Apply }) {
  // Sorcery points have their own pips on the Metamagic card, so they are not shown twice.
  const resources = getResources(character).filter(r => r.id !== SORCERY_POINTS)
  const counters = character.state.counters ?? []
  const { t, term } = useI18n()
  const rolls = useSheetRolls(character)
  const atDawn = dawnCounters(character)
  // Item charges (from an item's effects) that come back at dawn, with what is spent.
  const dawnItems = resources.filter(r => r.recharge === 'dawn').map(r => ({ ...r, used: character.state.resources[r.id]?.used ?? 0 }))

  const [out, setOut] = useState<{ key: number; name: string; rolls: Shown[]; note?: string } | null>(null)
  const { use: spendUse, pool, setPool, spendPool } = useResourceUse(character, apply, o => setOut(p => ({ key: (p?.key ?? 0) + 1, ...o })))
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
            </li>
          )
        })}
        {counters.map(k => (
          <li key={k.id}>
            <span className="track-label">{k.label}<small>{t(RECHARGE[k.recharge])}{k.recharge === 'dawn' && k.regain ? t('sheet.regains', { dice: k.regain }) : ''}</small></span>
            <Stepper value={k.max - k.used} max={k.max} label={k.label}
              onChange={v => apply(t(k.max - v > k.used ? 'sheet.log.used' : 'sheet.log.regained', { label: k.label }), c => upsertCounter(c, { ...k, used: k.max - v }))} />
            <button type="button" className="btn ghost small" aria-label={t('sheet.removeWhat', { label: k.label })}
              onClick={() => apply(t('sheet.log.removedTracker', { label: k.label }), c => removeCounter(c, k.id))}>{t('common.remove')}</button>
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

/**
 * Using a resource in one tap: spends a use, rolls its healing (Second Wind) and starts its effect (Rage shows under Effects).
 * A pool (Lay on Hands) asks how many points first: `pool` is the resource whose PoolForm is open.
 */
export function useResourceUse(character: Character, apply: Apply, show: (o: UseOut) => void) {
  const { t } = useI18n()
  const rolls = useSheetRolls(character)
  const [pool, setPool] = useState<string | null>(null)
  const planOf = (r: ResourceInfo, label: string) => planUse(r.id, label, { edition: rulesEdition(character), classLevel: resourceClassLevel(character, r.id) })

  /** Spends points from a pool: on yourself they heal you, on an ally they are only spent. */
  const spendPool = (r: ResourceInfo, label: string, n: number, self: boolean) => {
    const left = r.max - (character.state.resources[r.id]?.used ?? 0)
    apply(t(self ? 'use.log.poolSelf' : 'use.log.pool', { label, n }), c => spendResource(c, r.id, planOf(r, label), self ? { heal: n } : {}, n))
    show({ name: label, rolls: [], note: [self ? t('cast.healed', { n }) : t('use.spentPool', { n }), t('use.left', { n: Math.max(0, left - n), max: r.max })].join(' · ') })
    setPool(null)
  }

  const use = (r: ResourceInfo, label: string) => {
    const plan = planOf(r, label)
    if (plan.pool && pool !== r.id) return setPool(r.id)
    const shown: Shown[] = []
    let healed: number | undefined
    if (plan.heal) {
      const roll = rolls.spell(label, { damage: plan.heal, damageType: 'healing' }).damage
      if (roll) { shown.push({ roll, what: t('cs.roll.healing') }); healed = roll.total }
    }
    const left = r.max - (character.state.resources[r.id]?.used ?? 0)
    const notes = [left <= 0 ? t('use.noneLeft') : t('use.left', { n: left - 1, max: r.max }), plan.effect ? t('cast.inEffect') : '', healed ? t('cast.healed', { n: healed }) : ''].filter(Boolean)
    apply(t('use.log', { label }), c => spendResource(c, r.id, plan, { heal: healed }))
    show({ name: label, rolls: shown, note: notes.join(' · ') })
  }

  return { use, pool, setPool, spendPool }
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

// The DM's live sheet for one NPC (src/npc): the hero card, hit points with the block's defenses, conditions,
// rests, legendary and spell pips, the shared stat block with roll buttons, and DM-only notes. Every change
// goes through the pure engine and is saved at once; the session log undoes the last change. DM only:
// App renders this for view kind 'npc' when the signed-in account is a DM, and the route is DM-only (src/nav).
import { useEffect, useRef, useState } from 'react'
import { announce } from '../../a11y'
import { ConfirmDialog } from '../../builder/ConfirmDialog'
import { addCombatant, createEncounter, listEncounters, saveEncounter, type Encounter } from '../../combat'
import { npcCombatant } from '../../combat/npcRows'
import { addMonster, npcPlanEntry, updatePlan } from '../../dm/logic'
import { loadDm, saveDm } from '../../dm/store'
import type { DmState, EncounterPlan } from '../../dm/types'
import { rollD20 } from '../../dice'
import { useDice } from '../../dice/ui'
import { useI18n, type MessageKey } from '../../i18n'
import { CONDITIONS, DAMAGE_TYPES, formatMod, type ConditionId } from '../../rules'
import { StatBlock, crLabel, initBonus, legendaryCount, legendaryResistance, limitedActions, passivePerception, perDayGroups, speedText, spellSlots, typeLine } from '../../monsters'
import {
  heal, isDown, longRest, maxHp, npcDefense, rechargeRoll, setCondition, setHp, setMaxHp, setTempHp, setUses, shortRest,
  spendLegendary, spendSlot, spendSpellUse, startTurn, takeDamage, useLegendaryResistance,
} from '../engine'
import { deleteNpc, getNpc, onNpcsChanged, saveNpc } from '../store'
import type { NpcSheet as Npc } from '../types'
import '../../sheet/sheet.css'
import './npc.css'

interface LogEntry { id: number; text: string; before: Npc }

export interface NpcSheetProps {
  npcId: string
  /** The signed-in DM: fights the NPC can join belong to this account. */
  ownerId: string
  onBack: () => void
  /** Opens the NPC creator in edit mode. Without it the sheet edits name, role and max HP in place. */
  onEdit?: () => void
  /** Opens the initiative tracker on the fight the NPC just joined. */
  onOpenFight?: (encounterId: string) => void
}

export function NpcSheet({ npcId, ownerId, onBack, onEdit, onOpenFight }: NpcSheetProps) {
  const { t } = useI18n()
  const [npc, setNpc] = useState<Npc | null | undefined>(undefined)
  const [log, setLog] = useState<LogEntry[]>([])
  const [editing, setEditing] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const nextId = useRef(1)

  useEffect(() => {
    let live = true
    const load = () => getNpc(npcId).then(n => { if (live) setNpc(n ?? null) })
    load()
    const off = onNpcsChanged(id => { if (!id || id === npcId) load() })
    return () => { live = false; off() }
  }, [npcId])

  if (npc === undefined) return <div className="ff-sheet ff-npc"><p className="hint">{t('common.loading')}</p></div>
  if (npc === null) {
    return (
      <div className="ff-sheet ff-npc">
        <p>{t('npc.notFound')}</p>
        <button type="button" className="btn" onClick={onBack}>{t('common.back')}</button>
      </div>
    )
  }

  /** Applies a pure change, saves it and remembers the previous sheet for Undo. */
  const apply = (text: string, fn: (n: Npc) => Npc) => {
    const next = fn(npc)
    if (next === npc) return
    setNpc(next)
    setLog(l => [{ id: nextId.current++, text, before: npc }, ...l].slice(0, 50))
    announce(text)
    void saveNpc(next)
  }
  const undo = () => {
    const [last, ...rest] = log
    if (!last) return
    setLog(rest)
    setNpc(last.before)
    void saveNpc(last.before)
  }
  // The Legendary Resistance trait's pips on the stat block are the sheet's legendary resistance count.
  const resistanceTrait = npc.block.traits.find(isResistance)
  const uses = resistanceTrait ? { ...npc.state.uses, [resistanceTrait.name]: npc.state.legendaryResistanceUsed } : npc.state.uses
  const remove = async () => {
    await deleteNpc(npc.id)
    onBack()
  }

  return (
    <div className="ff-sheet ff-npc">
      <header className="sheet-header">
        <button type="button" className="btn ghost" onClick={onBack} aria-label={t('npc.back')}>{t('common.backArrow')}</button>
        <div className="who"><span className="sr-only">{npc.name}</span></div>
        <button type="button" className="btn small" aria-pressed={onEdit ? undefined : editing} onClick={() => (onEdit ? onEdit() : setEditing(e => !e))}>
          ✎ {editing && !onEdit ? t('npc.done') : t('npc.edit')}
        </button>
        <button type="button" className="btn ghost small" onClick={() => setAskDelete(true)}>{t('common.delete')}</button>
      </header>
      <div className="npc-grid">
        <div className="npc-col">
          <HeroCard npc={npc} editing={editing && !onEdit} apply={apply} ownerId={ownerId} onOpenFight={onOpenFight} />
          <HitPoints npc={npc} apply={apply} />
          <Rests apply={apply} />
          <Spells npc={npc} apply={apply} />
          <Notes npc={npc} />
        </div>
        <div className="npc-col">
          <StatBlock m={npc.block} rollAs={npc.name} hideHp uses={uses}
            onUse={(a, spent) => apply(t(spent > (uses[a.name] ?? 0) ? 'npc.log.use' : 'npc.log.return', { name: a.name }),
              n => (isResistance(a) ? { ...n, state: { ...n.state, legendaryResistanceUsed: spent } } : setUses(n, a, spent)))} />
          <section className="card" aria-labelledby="npc-log-title">
            <div className="card-head">
              <h2 id="npc-log-title">{t('sheet.session')}</h2>
              <button type="button" className="btn ghost small" disabled={!log.length} onClick={undo}>
                {log[0] ? t('sheet.undoWhat', { what: log[0].text }) : t('sheet.undo')}
              </button>
            </div>
            {log.length === 0 ? <p className="hint">{t('sheet.logEmpty')}</p> : (
              <ol className="log">{log.map(e => <li key={e.id} className="log-entry"><span className="what">{e.text}</span></li>)}</ol>
            )}
          </section>
        </div>
      </div>
      <ConfirmDialog open={askDelete} title={t('npc.deleteAsk', { name: npc.name })} yes={t('common.delete')} onYes={() => void remove()} onClose={() => setAskDelete(false)} />
    </div>
  )
}

type Apply = (text: string, fn: (n: Npc) => Npc) => void

const isResistance = (a: { name: string }) => /legendary resistance/i.test(a.name)

/** Who this is: portrait, name, role, creature line, AC, speed, proficiency, passive Perception, Initiative and Add to fight. */
function HeroCard({ npc, editing, apply, ownerId, onOpenFight }: { npc: Npc; editing: boolean; apply: Apply; ownerId: string; onOpenFight?: (id: string) => void }) {
  const { t, monsterName } = useI18n()
  const { record } = useDice()
  const m = npc.block
  const [picking, setPicking] = useState(false)
  const [fights, setFights] = useState<Encounter[] | null>(null)
  // Fights planned on the DM screen come first, then combats already in the tracker.
  const [plans, setPlans] = useState<DmState | null>(null)
  useEffect(() => {
    if (!picking) return
    let live = true
    listEncounters(ownerId).then(l => { if (live) setFights(l) })
    loadDm(ownerId).then(s => { if (live) setPlans(s) })
    return () => { live = false }
  }, [picking, ownerId])

  const plan = async (p: EncounterPlan) => {
    const state = await loadDm(ownerId)
    await saveDm(ownerId, updatePlan(state, p.id, x => (x.monsters.some(m => m.npcId === npc.id) ? x : addMonster(x, npcPlanEntry(npc)))))
    setPicking(false)
    announce(t('npc.log.joined', { fight: p.name }))
  }

  const rename = (patch: Partial<Pick<Npc, 'name' | 'role'>>) => apply(t('npc.log.edited'), n => ({ ...n, ...patch }))
  const join = async (fight?: Encounter) => {
    const enc = fight ?? createEncounter(crypto.randomUUID(), ownerId, t('combat.defaultName', { n: (fights?.length ?? 0) + 1 }))
    // `npcId` links the row back to this sheet for the tracker.
    const row = npcCombatant(npc, crypto.randomUUID())
    const saved = await saveEncounter(addCombatant(enc, row))
    setPicking(false)
    announce(t('npc.log.joined', { fight: saved.name }))
    onOpenFight?.(saved.id)
  }

  return (
    <section className="card npc-top" aria-labelledby="npc-name">
      <div className="npc-hero">
        <div className="npc-portrait">
          {npc.portrait ? <img src={npc.portrait} alt="" /> : <div className="placeholder" aria-hidden="true">{npc.name.slice(0, 1)}</div>}
        </div>
        <div className="npc-who">
          {editing ? (
            <div className="npc-edit">
              <label>{t('npc.name')}<input value={npc.name} onChange={e => rename({ name: e.target.value })} /></label>
              <label>{t('npc.role')}<input value={npc.role ?? ''} onChange={e => rename({ role: e.target.value })} /></label>
              <label>{t('npc.maxHp')}<input inputMode="numeric" value={maxHp(npc)} onChange={e => { const v = Number(e.target.value.replace(/\D/g, '')); if (v > 0) apply(t('npc.log.maxHp', { n: v }), n => setMaxHp(n, v)) }} /></label>
            </div>
          ) : (
            <>
              <h1 id="npc-name">{npc.name}</h1>
              {npc.role && <p className="npc-role">{npc.role}</p>}
            </>
          )}
          <p>{monsterName(m)} · <span lang="en" dir="ltr">{typeLine(m)}</span></p>
          <p>{t('npc.cr', { cr: crLabel(m.challengeRating), xp: m.xp.toLocaleString() })}</p>
        </div>
        <dl className="npc-stats">
          <div><dt>{t('stat.ac')}</dt><dd>{m.armorClass[0]?.value ?? 10}</dd></div>
          <div><dt>{t('stat.speed')}</dt><dd className="npc-speed" lang="en" dir="ltr">{speedText(m.speed)}</dd></div>
          <div><dt>{t('stat.prof')}</dt><dd>{formatMod(m.proficiencyBonus)}</dd></div>
          <div><dt>{t('stat.passivePerception')}</dt><dd>{passivePerception(m)}</dd></div>
        </dl>
        <div className="npc-hero-actions">
          <button type="button" className="btn primary" onClick={() => record(rollD20(initBonus(m), { label: `${npc.name}: ${t('npc.initiativeLabel')}` }, 'check'), { quiet: true })}>
            {t('npc.initiative', { bonus: formatMod(initBonus(m)) })}
          </button>
          <button type="button" className="btn" aria-expanded={picking} onClick={() => setPicking(p => !p)}>⚔ {t('npc.addToFight')}</button>
        </div>
        {picking && (
          <div className="npc-fights" role="group" aria-label={t('npc.pickFight')}>
            <p className="hint">{t('npc.pickFight')}</p>
            {fights === null || plans === null ? <p className="hint">{t('common.loading')}</p> : (
              <div className="row">
                {plans.plans.map(p => <button key={p.id} type="button" className="chip" onClick={() => void plan(p)}>{t('npc.plannedFight', { name: p.name })}</button>)}
                {fights.map(f => <button key={f.id} type="button" className="chip" onClick={() => void join(f)}>{f.name}</button>)}
                <button type="button" className="chip on" onClick={() => void join()}>{t('npc.newFight')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/** Hit points with the block's defenses, legendary pips, a New turn button and the conditions row. */
function HitPoints({ npc, apply }: { npc: Npc; apply: Apply }) {
  const { t, term } = useI18n()
  const { roll } = useDice()
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('')
  const [said, setSaid] = useState('')
  const { currentHp, tempHp } = npc.state
  const max = maxHp(npc)
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const pct = max ? (currentHp / max) * 100 : 0
  const typeName = (x: string) => term('damage', x, x)
  const typeLabel = (x: string) => term('damage', x, x[0].toUpperCase() + x.slice(1))
  const defended = (x: string) => npcDefense(npc, x)
  const types = [...DAMAGE_TYPES].sort((a, b) => Number(!defended(a)) - Number(!defended(b)))
  const legendary = legendaryCount(npc.block)
  const resistance = legendaryResistance(npc.block)
  const act = (fn: () => void) => { if (n > 0) { fn(); setAmount('') } }

  const damage = () => {
    const hit = takeDamage(npc, n, type || undefined)
    const why = hit.defense && t(hit.defense === 'immune' ? 'hurt.immune' : hit.defense === 'resistant' ? 'hurt.resistant' : 'npc.vulnerable')
    const text = why
      ? t('hurt.log.typed', { taken: hit.dealt, type: typeName(type), n, why })
      : type ? t('hurt.log.type', { n, type: typeName(type) }) : t('sheet.log.damage', { n })
    setSaid(type ? (why ? t('hurt.typed', { n, type: typeName(type), taken: hit.dealt, why }) : t('hurt.plain', { n, type: typeName(type) })) : '')
    apply(text, x => takeDamage(x, n, type || undefined).npc)
    setType('')
  }

  /** Start of the NPC's turn: legendary actions back, and a d6 for every spent recharge action. */
  const newTurn = () => {
    const spent = limitedActions(npc.block).filter(a => a.usage?.type === 'recharge' && (npc.state.uses[a.name] ?? 0) > 0)
    const rolls = spent.map(a => ({ a, d6: roll('1d6', { label: `${npc.name}: ${a.name}` }).total }))
    const back = rolls.filter(r => r.a.usage?.type === 'recharge' && r.d6 >= r.a.usage.minimum)
    const text = rolls.length
      ? back.length ? t('npc.log.recharged', { names: back.map(r => `${r.a.name} (${r.d6})`).join(', ') }) : t('npc.log.noRecharge', { names: rolls.map(r => `${r.a.name} (${r.d6})`).join(', ') })
      : t('npc.log.newTurn')
    apply(text, x => rolls.reduce((acc, r) => rechargeRoll(acc, r.a, r.d6), startTurn(x)))
  }

  return (
    <section className="card hp" aria-labelledby="npc-hp-title">
      <div className="card-head">
        <h2 id="npc-hp-title">{t('sheet.hp')}</h2>
        <button type="button" className="btn small" onClick={newTurn}>{t('npc.newTurn')}</button>
      </div>
      <div className="hp-numbers">
        <div className="hp-current" aria-live="polite"><span className="big">{currentHp}</span><span className="of">/ {max}</span></div>
        <div className={tempHp ? 'hp-temp has' : 'hp-temp'}><span className="big">{tempHp}</span><span className="of">{t('sheet.temp')}</span></div>
      </div>
      <div className="hp-bar" aria-hidden="true">
        <div className={`hp-fill ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}`} style={{ width: `${pct}%` }} />
        {tempHp > 0 && <div className="hp-temp-fill" style={{ width: `${Math.min(100, (tempHp / max) * 100)}%` }} />}
      </div>
      {isDown(npc) && <p className="status status-dying">{t('npc.down')}</p>}
      <form className="hp-controls" onSubmit={e => e.preventDefault()}>
        <label className="sr-only" htmlFor="npc-hp-amount">{t('sheet.amount')}</label>
        <input id="npc-hp-amount" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} />
        <button type="submit" className="btn danger" disabled={!n} onClick={() => act(damage)}>{t('sheet.damage')}</button>
        <button type="button" className="btn heal" disabled={!n} onClick={() => act(() => apply(t('sheet.log.heal', { n }), x => heal(x, n)))}>{t('sheet.heal')}</button>
        <button type="button" className="btn" disabled={!n} onClick={() => act(() => apply(t('sheet.log.temp', { n }), x => setTempHp(x, n)))}>{t('sheet.tempHp')}</button>
      </form>
      <label className="hp-type">
        <span>{t('hurt.type')}</span>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="">{t('hurt.anyType')}</option>
          {types.map(x => {
            const def = defended(x)
            const key: MessageKey | null = def === 'immune' ? 'hurt.immuneMark' : def === 'resistant' ? 'hurt.resistantMark' : def === 'vulnerable' ? 'npc.vulnerableMark' : null
            return <option key={x} value={x}>{key ? t(key, { type: typeLabel(x) }) : typeLabel(x)}</option>
          })}
        </select>
      </label>
      {said && <p className="hp-said" aria-live="polite">{said}</p>}
      {isDown(npc) && (
        <div className="row">
          <button type="button" className="btn small" onClick={() => apply(t('npc.log.backUp'), x => setHp(x, 1))}>{t('sheet.death.revive')}</button>
        </div>
      )}
      {(legendary > 0 || resistance > 0) && (
        <div className="npc-legendary">
          {legendary > 0 && (
            <Pips label={t('npc.legendaryActions')} total={legendary} spent={npc.state.legendaryUsed}
              onChange={spent => apply(t(spent > npc.state.legendaryUsed ? 'npc.log.legendary' : 'npc.log.legendaryBack'), x => spendLegendary(x, spent - x.state.legendaryUsed))} />
          )}
          {resistance > 0 && !npc.block.traits.some(isResistance) && (
            <Pips label={t('npc.legendaryResistance')} total={resistance} spent={npc.state.legendaryResistanceUsed}
              onChange={spent => apply(t(spent > npc.state.legendaryResistanceUsed ? 'npc.log.legendaryResistance' : 'npc.log.legendaryResistanceBack'),
                x => (spent > x.state.legendaryResistanceUsed ? useLegendaryResistance(x) : { ...x, state: { ...x.state, legendaryResistanceUsed: spent } }))} />
          )}
        </div>
      )}
      <Conditions npc={npc} apply={apply} />
    </section>
  )
}

/** Filled pips are still available; tapping the first used pip returns one. */
function Pips({ label, total, spent, onChange }: { label: string; total: number; spent: number; onChange: (spent: number) => void }) {
  return (
    <div className="npc-pips">
      <span>{label}</span>
      <div className="mon-pips" role="group" aria-label={label}>
        {Array.from({ length: total }, (_, i) => {
          const used = i < spent
          return <button key={i} type="button" className={`mon-pip${used ? ' used' : ''}`} aria-pressed={used} aria-label={`${label} ${i + 1}/${total}`} onClick={() => onChange(used ? i : i + 1)} />
        })}
      </div>
    </div>
  )
}

function Conditions({ npc, apply }: { npc: Npc; apply: Apply }) {
  const { t, term } = useI18n()
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<ConditionId | null>(null)
  const active = npc.state.conditions
  const name = (id: ConditionId) => term('condition', id, id[0].toUpperCase() + id.slice(1))
  const immune = (id: ConditionId) => npc.block.conditionImmunities.some(l => l.toLowerCase().split(/[^a-z]+/).includes(id))
  const set = (id: ConditionId, on: boolean) => {
    apply(t(on ? 'cond.log.add' : 'cond.log.remove', { name: name(id) }), x => setCondition(x, id, on))
    if (!on && open === id) setOpen(null)
  }
  const shown = open && active.includes(open) ? open : null
  return (
    <div className="conditions" role="group" aria-label={t('cond.title')}>
      <div className="cond-row">
        {active.map(id => (
          <span key={id} className="chip on cond-chip">
            <button type="button" className="cond-name" aria-expanded={shown === id} aria-label={t('cond.rulesOf', { name: name(id) })} onClick={() => setOpen(o => (o === id ? null : id))}>{name(id)}</button>
            <button type="button" className="cond-x" aria-label={t('cond.remove', { name: name(id) })} onClick={() => set(id, false)}>✕</button>
          </span>
        ))}
        <button type="button" className="chip cond-add" aria-expanded={adding} onClick={() => setAdding(a => !a)}>{t('cond.add')}</button>
      </div>
      {shown && <p className="cond-rules hint"><strong>{name(shown)}.</strong> {t(`dm.cond.${shown}` as MessageKey)}</p>}
      {adding && (
        <div className="cond-picker">
          {CONDITIONS.filter(id => !active.includes(id)).map(id => (
            <button key={id} type="button" className="chip" disabled={immune(id)} title={t(`dm.cond.${id}` as MessageKey)} onClick={() => { set(id, true); setAdding(false) }}>
              {immune(id) ? t('cond.immune', { name: name(id) }) : name(id)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Rests({ apply }: { apply: Apply }) {
  const { t } = useI18n()
  return (
    <section className="card rests" aria-labelledby="npc-rest-title">
      <h2 id="npc-rest-title">{t('sheet.rest')}</h2>
      <div className="row rest-buttons">
        <button type="button" className="btn" onClick={() => apply(t('npc.log.short'), shortRest)}>{t('rest.short')}</button>
        <button type="button" className="btn primary" onClick={() => apply(t('npc.log.long'), longRest)}>{t('rest.long')}</button>
      </div>
      <p className="hint">{t('npc.restHint')}</p>
    </section>
  )
}

/** Slot pips per level and per-day groups, when the block casts spells. The spells themselves are in the stat block. */
function Spells({ npc, apply }: { npc: Npc; apply: Apply }) {
  const { t } = useI18n()
  const slots = spellSlots(npc.block)
  const perDay = Object.entries(perDayGroups(npc.block))
  if (!slots.some(Boolean) && !perDay.length) return null
  return (
    <section className="card" aria-labelledby="npc-spells-title">
      <h2 id="npc-spells-title">{t('npc.spells')}</h2>
      {slots.map((total, i) => total > 0 && (
        <Pips key={i} label={t('npc.slots', { n: i + 1 })} total={total} spent={npc.state.slotsUsed[i]}
          onChange={spent => apply(t(spent > npc.state.slotsUsed[i] ? 'npc.log.slot' : 'npc.log.slotBack', { n: i + 1 }), x => spendSlot(x, i + 1, spent < x.state.slotsUsed[i]))} />
      ))}
      {perDay.map(([label, total]) => (
        <Pips key={label} label={label} total={total} spent={npc.state.spellUses[label] ?? 0}
          onChange={spent => apply(t(spent > (npc.state.spellUses[label] ?? 0) ? 'npc.log.use' : 'npc.log.return', { name: label }), x => spendSpellUse(x, label, spent < (x.state.spellUses[label] ?? 0)))} />
      ))}
    </section>
  )
}

/** DM-only notes, saved a moment after typing stops. Not part of the undo log. */
function Notes({ npc }: { npc: Npc }) {
  const { t } = useI18n()
  const [text, setText] = useState(npc.notes)
  const [touched, setTouched] = useState(false)
  useEffect(() => { if (!touched) setText(npc.notes) }, [npc.notes, touched])
  useEffect(() => {
    if (!touched || text === npc.notes) return
    const timer = setTimeout(() => { void saveNpc({ ...npc, notes: text }); setTouched(false) }, 600)
    return () => clearTimeout(timer)
  }, [text, touched, npc])
  return (
    <section className="card" aria-labelledby="npc-notes-title">
      <h2 id="npc-notes-title">{t('npc.notes')}</h2>
      <textarea className="npc-notes" rows={4} value={text} placeholder={t('npc.notesPh')} aria-label={t('npc.notes')}
        onChange={e => { setText(e.target.value); setTouched(true) }} />
    </section>
  )
}


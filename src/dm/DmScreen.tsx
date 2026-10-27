// The DM screen: party budget on top, then tabs for encounters, monsters, quick reference and NPCs.
// Uses the sheet's card style (.ff-sheet) so it reads like the rest of the app.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createEncounter, addCombatant, saveEncounter } from '../combat'
import { BUNDLED, loadKind, type Monster, type MonsterAction } from '../content'
import { rollD20 } from '../dice'
import { RollView, useDice } from '../dice/ui'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { DmRequestsTab, inbox, StoryReminders, useRequests } from '../requests'
import { formatMod } from '../rules'
import type { Ability } from '../rules'
import {
  abilityMod, activePlan, addMonster, addPlan, changeCount, crLabel, crSteps, difficulty, findMonsters, monsterTypes,
  NPC_TABLES, partyBudget, partySize, planCombatants, planEntry, planXp, randomNpc, removePlan, updatePlan,
  type Difficulty, type MonsterQuery, type NpcIdea,
} from './logic'
import { loadDm, onDmChanged, saveDm, syncDm } from './store'
import type { DmState, EncounterPlan, Npc } from './types'
import '../sheet/sheet.css'
import '../sheet/combat/combat.css'
import './dm.css'

const newId = () => crypto.randomUUID()
const SOURCE = 'srd-5.1'
const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export type DmTab = 'encounters' | 'monsters' | 'reference' | 'npcs' | 'requests'
type Tab = DmTab
const TABS: Tab[] = ['encounters', 'monsters', 'reference', 'npcs', 'requests']
const TAB_KEYS: Record<Tab, MessageKey> = {
  encounters: 'dm.tab.encounters', monsters: 'dm.tab.monsters', reference: 'dm.tab.reference', npcs: 'dm.tab.npcs', requests: 'dm.tab.requests',
}
const DIFFICULTY_KEYS: Record<Difficulty, MessageKey> = {
  none: 'dm.diff.none', trivial: 'dm.diff.trivial', low: 'dm.diff.low', moderate: 'dm.diff.moderate', high: 'dm.diff.high', beyond: 'dm.diff.beyond',
}

type Update = (fn: (s: DmState) => DmState) => void

/** The DM's own screen. Nothing here reads players' characters. */
export function DmScreen({ userId, onRunEncounter, initialTab }: { userId: string; onRunEncounter: (encounterId: string) => void; initialTab?: DmTab }) {
  const { t } = useI18n()
  const [state, setState] = useState<DmState | null>(null)
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [tab, setTab] = useState<Tab>(initialTab ?? 'encounters')
  const requests = useRequests()
  // Opened straight on a later tab (from a request link): bring it into view on narrow screens.
  useEffect(() => { if (initialTab) document.getElementById(`dm-tab-${initialTab}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [initialTab, state])
  const [openMonster, setOpenMonster] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    // This device's copy first, then the server's (other devices' edits) once it answers.
    loadDm(userId).then(s => { if (live) setState(s) }).then(() => syncDm(userId)).then(s => { if (live) setState(s) })
    const off = onDmChanged(userId, s => { if (live) setState(s) })
    return () => { live = false; off() }
  }, [userId])
  useEffect(() => {
    let live = true
    loadKind('monsters', { sources: [SOURCE] }).then(list => { if (live) setMonsters(list) }).catch(() => {})
    return () => { live = false }
  }, [])

  const update = useCallback<Update>(fn => {
    setState(prev => {
      if (!prev) return prev
      const next = fn(prev)
      saveDm(userId, next)
      return next
    })
  }, [userId])

  if (!state) return null
  const plan = activePlan(state)

  const addToPlan = (m: Monster) => update(s => {
    const p = activePlan(s)
    if (p) return updatePlan(s, p.id, x => addMonster(x, planEntry(m)))
    return addPlan(s, addMonster({ id: newId(), name: t('dm.planName', { n: s.plans.length + 1 }), monsters: [] }, planEntry(m)))
  })

  const run = async (p: EncounterPlan) => {
    const rows = planCombatants(p, monsters, newId)
    const enc = rows.reduce((e, row) => addCombatant(e, row), createEncounter(newId(), userId, p.name))
    const saved = await saveEncounter(enc)
    onRunEncounter(saved.id)
  }

  const showMonster = (id: string) => { setOpenMonster(id); setTab('monsters') }

  const move = (e: React.KeyboardEvent, i: number) => {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!by) return
    const dir = getComputedStyle(e.currentTarget).direction === 'rtl' ? -by : by
    const next = TABS[(i + dir + TABS.length) % TABS.length]
    setTab(next)
    document.getElementById(`dm-tab-${next}`)?.focus()
  }

  return (
    <div className="ff-sheet ff-dm">
      <PartyCard state={state} update={update} plan={plan} />
      {requests && <StoryReminders list={requests} onOpen={() => setTab('requests')} />}
      <div className="cs-tabs">
        <div className="cs-tablist" role="tablist" aria-label={t('dm.tabs')}>
          {TABS.map((id, i) => (
            <button key={id} id={`dm-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="dm-tabpanel"
              tabIndex={tab === id ? 0 : -1} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} onKeyDown={e => move(e, i)}>
              {t(TAB_KEYS[id])}
              {id === 'requests' && requests && inbox(requests).length > 0 && <span className="dm-badge">{inbox(requests).length}</span>}
            </button>
          ))}
        </div>
        <div id="dm-tabpanel" role="tabpanel" aria-labelledby={`dm-tab-${tab}`} className="cs-tabpanel">
          {tab === 'encounters' && <EncountersTab state={state} update={update} monsters={monsters} onAdd={addToPlan} onRun={run} onOpenMonster={showMonster} />}
          {tab === 'monsters' && <MonstersTab monsters={monsters} openId={openMonster} onOpen={setOpenMonster} onAdd={addToPlan} planName={plan?.name} />}
          {tab === 'reference' && <ReferenceTab />}
          {tab === 'npcs' && <NpcsTab state={state} update={update} />}
          {tab === 'requests' && <DmRequestsTab list={requests ?? []} />}
        </div>
      </div>
      <p className="hint dm-credit">{t('dm.credit')}</p>
      <p className="hint dm-credit" dir="ltr" lang="en">{BUNDLED.find(m => m.source.id === SOURCE)?.source.attribution}</p>
    </div>
  )
}

// ---------- Top card: the party and its XP budget ----------

function PartyCard({ state, update, plan }: { state: DmState; update: Update; plan?: EncounterPlan }) {
  const { t } = useI18n()
  const budget = partyBudget(state.party)
  const xp = plan ? planXp(plan) : 0
  const setGroup = (i: number, patch: Partial<{ count: number; level: number }>) =>
    update(s => ({ ...s, party: s.party.map((g, j) => (j === i ? { ...g, ...patch } : g)) }))
  return (
    <section className="card dm-top" aria-labelledby="dm-title">
      <div>
        <h1 id="dm-title">{t('dm.title')}</h1>
        <p className="hint">{t('dm.intro')}</p>
        <h2 className="sub-title">{t('dm.party', { count: partySize(state.party) })}</h2>
        <ul className="plain dm-groups">
          {state.party.map((g, i) => (
            <li key={i}>
              <label>
                <span className="sr-only">{t('dm.players')}</span>
                <input type="number" min={0} max={12} inputMode="numeric" value={g.count}
                  onChange={e => setGroup(i, { count: Math.max(0, Math.min(12, Number(e.target.value) || 0)) })} />
              </label>
              <span>{t('dm.playersAtLevel')}</span>
              <label>
                <span className="sr-only">{t('dm.level')}</span>
                <select value={g.level} onChange={e => setGroup(i, { level: Number(e.target.value) })}>
                  {Array.from({ length: 20 }, (_, n) => <option key={n} value={n + 1}>{n + 1}</option>)}
                </select>
              </label>
              {state.party.length > 1 && (
                <button className="btn ghost small" onClick={() => update(s => ({ ...s, party: s.party.filter((_, j) => j !== i) }))}
                  aria-label={t('dm.removeGroup')}>✕</button>
              )}
            </li>
          ))}
        </ul>
        <button className="btn small" onClick={() => update(s => ({ ...s, party: [...s.party, { count: 1, level: s.party.at(-1)?.level ?? 1 }] }))}>
          {t('dm.addGroup')}
        </button>
      </div>
      <div className="dm-budget">
        <h2 className="sub-title">{t('dm.budget')}</h2>
        <dl className="cs-stats dm-stats">
          <div><dt>{t('dm.diff.low')}</dt><dd>{budget.low.toLocaleString()}</dd></div>
          <div><dt>{t('dm.diff.moderate')}</dt><dd>{budget.moderate.toLocaleString()}</dd></div>
          <div><dt>{t('dm.diff.high')}</dt><dd>{budget.high.toLocaleString()}</dd></div>
          <div className={`dm-now diff-${difficulty(xp, budget)}`}>
            <dt>{plan ? plan.name : t('dm.noPlan')}</dt>
            <dd>{xp.toLocaleString()}</dd>
          </div>
        </dl>
        <p className="hint">{t('dm.budgetHelp')}</p>
      </div>
    </section>
  )
}

// ---------- Encounters ----------

function EncountersTab({ state, update, monsters, onAdd, onRun, onOpenMonster }: {
  state: DmState
  update: Update
  monsters: Monster[]
  onAdd: (m: Monster) => void
  onRun: (p: EncounterPlan) => void
  onOpenMonster: (id: string) => void
}) {
  const { t } = useI18n()
  const plan = activePlan(state)
  const budget = partyBudget(state.party)
  const create = () => update(s => addPlan(s, { id: newId(), name: t('dm.planName', { n: s.plans.length + 1 }), monsters: [] }))

  return (
    <>
      <section className="card dm-plan" aria-labelledby="dm-plan-title">
        <div className="card-head">
          <h2 id="dm-plan-title">{t('dm.plans')}</h2>
          <button className="btn small" onClick={create}>{t('dm.newPlan')}</button>
        </div>
        {!plan ? <p className="hint">{t('dm.plansEmpty')}</p> : (
          <>
            <div className="dm-plan-bar">
              {state.plans.length > 1 && (
                <select aria-label={t('dm.pickPlan')} value={plan.id} onChange={e => update(s => ({ ...s, activePlanId: e.target.value }))}>
                  {state.plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <input aria-label={t('dm.planNameLabel')} value={plan.name}
                onChange={e => update(s => updatePlan(s, plan.id, p => ({ ...p, name: e.target.value })))} />
              <button className="btn ghost small" onClick={() => confirm(t('dm.deletePlan', { name: plan.name })) && update(s => removePlan(s, plan.id))}>
                {t('common.delete')}
              </button>
            </div>
            <Meter xp={planXp(plan)} budget={budget} />
            {plan.monsters.length === 0 ? <p className="hint">{t('dm.planEmpty')}</p> : (
              <ul className="plain dm-plan-list">
                {plan.monsters.map(m => (
                  <li key={`${m.source}:${m.monsterId}`}>
                    <button className="link-btn" onClick={() => onOpenMonster(m.monsterId)}>{m.name}</button>
                    <span className="muted small">{t('dm.crXp', { cr: crLabel(m.cr), xp: (m.xp * m.count).toLocaleString() })}</span>
                    <span className="dm-count">
                      <button className="btn small" aria-label={t('dm.fewer', { name: m.name })} onClick={() => update(s => updatePlan(s, plan.id, p => changeCount(p, m, -1)))}>−</button>
                      <b aria-live="polite">{m.count}</b>
                      <button className="btn small" aria-label={t('dm.more', { name: m.name })} onClick={() => update(s => updatePlan(s, plan.id, p => changeCount(p, m, 1)))}>+</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="row">
              <button className="btn primary" disabled={!plan.monsters.length || !monsters.length} onClick={() => onRun(plan)}>{t('dm.run')}</button>
            </div>
            <p className="hint">{t('dm.runHelp')}</p>
          </>
        )}
      </section>
      <section className="card" aria-labelledby="dm-add-title">
        <h2 id="dm-add-title">{t('dm.addMonsters')}</h2>
        <MonsterBrowser monsters={monsters} onAdd={onAdd} onOpen={onOpenMonster} />
      </section>
    </>
  )
}

function Meter({ xp, budget }: { xp: number; budget: { low: number; moderate: number; high: number } }) {
  const { t } = useI18n()
  const d = difficulty(xp, budget)
  const pct = budget.high ? Math.min(100, (xp / budget.high) * 100) : 0
  const mark = (n: number) => `${budget.high ? (n / budget.high) * 100 : 0}%`
  return (
    <div className={`dm-meter diff-${d}`}>
      <div className="dm-meter-head">
        <b>{t(DIFFICULTY_KEYS[d])}</b>
        <span className="muted small">{t('dm.xpOf', { xp: xp.toLocaleString(), high: budget.high.toLocaleString() })}</span>
      </div>
      <div className="dm-meter-bar" role="meter" aria-valuemin={0} aria-valuemax={budget.high} aria-valuenow={Math.min(xp, budget.high)} aria-label={t('dm.difficulty')}>
        <span className="fill" style={{ inlineSize: `${pct}%` }} />
        <span className="tick" style={{ insetInlineStart: mark(budget.low) }} />
        <span className="tick" style={{ insetInlineStart: mark(budget.moderate) }} />
      </div>
    </div>
  )
}

// ---------- Monsters ----------

function MonsterBrowser({ monsters, onAdd, onOpen, openId }: {
  monsters: Monster[]
  onAdd: (m: Monster) => void
  onOpen: (id: string) => void
  openId?: string | null
}) {
  const { t } = useI18n()
  const [q, setQ] = useState<MonsterQuery>({ text: '', minCr: null, maxCr: null, type: '' })
  const crs = useMemo(() => crSteps(monsters), [monsters])
  const types = useMemo(() => monsterTypes(monsters), [monsters])
  const found = useMemo(() => findMonsters(monsters, q), [monsters, q])
  const cr = (v: string) => (v === '' ? null : Number(v))
  if (!monsters.length) return <p className="hint">{t('common.loading')}</p>
  return (
    <div className="dm-browser">
      <div className="dm-filters">
        <input type="search" value={q.text} onChange={e => setQ({ ...q, text: e.target.value })} placeholder={t('dm.searchMonsters')} aria-label={t('dm.searchMonsters')} />
        <select aria-label={t('dm.minCr')} value={q.minCr ?? ''} onChange={e => setQ({ ...q, minCr: cr(e.target.value) })}>
          <option value="">{t('dm.minCr')}</option>
          {crs.map(c => <option key={c} value={c}>{t('dm.cr', { cr: crLabel(c) })}</option>)}
        </select>
        <select aria-label={t('dm.maxCr')} value={q.maxCr ?? ''} onChange={e => setQ({ ...q, maxCr: cr(e.target.value) })}>
          <option value="">{t('dm.maxCr')}</option>
          {crs.map(c => <option key={c} value={c}>{t('dm.cr', { cr: crLabel(c) })}</option>)}
        </select>
        <select aria-label={t('dm.type')} value={q.type} onChange={e => setQ({ ...q, type: e.target.value })}>
          <option value="">{t('dm.anyType')}</option>
          {types.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      {found.length === 0 ? <p className="hint">{t('dm.noMonsters')}</p> : (
        <ul className="plain dm-monster-list">
          {found.map(m => (
            <li key={m.id} className={openId === m.id ? 'on' : ''}>
              <button className="link-btn" onClick={() => onOpen(m.id)} aria-current={openId === m.id ? 'true' : undefined}>{m.name}</button>
              <span className="muted small">{t('dm.crXp', { cr: crLabel(m.challengeRating), xp: m.xp.toLocaleString() })}</span>
              <button className="btn small" onClick={() => onAdd(m)} aria-label={t('dm.addNamed', { name: m.name })}>{t('dm.add')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MonstersTab({ monsters, openId, onOpen, onAdd, planName }: {
  monsters: Monster[]
  openId: string | null
  onOpen: (id: string) => void
  onAdd: (m: Monster) => void
  planName?: string
}) {
  const { t } = useI18n()
  const open = monsters.find(m => m.id === openId)
  return (
    <div className="dm-two">
      <section className="card" aria-labelledby="dm-mon-title">
        <h2 id="dm-mon-title">{t('dm.tab.monsters')}</h2>
        <MonsterBrowser monsters={monsters} onAdd={onAdd} onOpen={onOpen} openId={openId} />
      </section>
      {open
        ? <StatBlock key={open.id} m={open} onAdd={() => onAdd(open)} planName={planName} />
        : <section className="card"><p className="hint">{t('dm.pickMonster')}</p></section>}
    </div>
  )
}

const speedText = (s: Monster['speed']) =>
  Object.entries(s).filter(([, v]) => typeof v === 'string').map(([k, v]) => (k === 'walk' ? v : `${k} ${v}`)).join(', ')

const usageText = (a: MonsterAction) =>
  a.usage?.type === 'recharge' ? ` (Recharge ${a.usage.dice === '1d6' ? `${a.usage.minimum}–6` : a.usage.dice})`
    : a.usage?.type === 'per day' ? ` (${a.usage.times}/Day)` : ''

function StatBlock({ m, onAdd, planName }: { m: Monster; onAdd: () => void; planName?: string }) {
  const { t, abilityShort } = useI18n()
  const { record, roll } = useDice()
  const [last, setLast] = useState<ReturnType<typeof record> | null>(null)
  const say = (r: ReturnType<typeof record>) => setLast(r)
  const d20 = (bonus: number, label: string, type: 'check' | 'save' | 'attack') => say(record(rollD20(bonus, { label: `${m.name}: ${label}` }, type)))
  const dmg = (dice: string, label: string) => {
    try { say(roll(dice, { label: `${m.name}: ${label}` })) } catch { /* not dice notation */ }
  }
  const list = (k: MessageKey, items: string[]) => items.length ? <p><b>{t(k)}</b> {items.join(', ')}</p> : null
  const senses = Object.entries(m.senses).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
  const saves = Object.entries(m.savingThrows) as [Ability, number][]
  const skills = Object.entries(m.skills)

  return (
    <section className="card dm-statblock" aria-labelledby="dm-sb-name" lang="en" dir="ltr">
      <div className="card-head">
        <div>
          <h3 id="dm-sb-name">{m.name}</h3>
          <p className="hint">{m.sizes.join(' or ')} {m.type}{m.subtype ? ` (${m.subtype})` : ''}, {m.alignment}</p>
        </div>
        <button className="btn small primary" onClick={onAdd} title={planName}>{t('dm.addToPlan')}</button>
      </div>
      <dl className="dm-sb-core">
        <div><dt>{t('stat.ac')}</dt><dd>{m.armorClass.map(a => `${a.value}${a.type ? ` (${a.type})` : ''}`).join(', ')}</dd></div>
        <div><dt>{t('stat.hp')}</dt><dd>{m.hitPoints} <button className="chip-roll" onClick={() => dmg(m.hitPointsRoll, t('stat.hp'))}>{m.hitPointsRoll}</button></dd></div>
        <div><dt>{t('stat.speed')}</dt><dd>{speedText(m.speed)}</dd></div>
        <div><dt>{t('dm.crLabel')}</dt><dd>{crLabel(m.challengeRating)} ({m.xp.toLocaleString()} XP) · {t('stat.prof')} {formatMod(m.proficiencyBonus)}</dd></div>
      </dl>
      <div className="dm-sb-abilities" role="group" aria-label={t('dm.abilityChecks')}>
        {ABILITIES.map(a => {
          const mod = abilityMod(m.abilities[a])
          return (
            <button key={a} onClick={() => d20(mod, abilityShort(a), 'check')}>
              <span>{abilityShort(a)}</span><b>{m.abilities[a]}</b><small>{formatMod(mod)}</small>
            </button>
          )
        })}
      </div>
      <div className="dm-sb-lines">
        {saves.length > 0 && (
          <p><b>{t('dm.saves')}</b> {saves.map(([a, v]) => (
            <button key={a} className="chip-roll" onClick={() => d20(v, `${abilityShort(a)} save`, 'save')}>{abilityShort(a)} {formatMod(v)}</button>
          ))}</p>
        )}
        {skills.length > 0 && (
          <p><b>{t('dm.skills')}</b> {skills.map(([s, v]) => (
            <button key={s} className="chip-roll" onClick={() => d20(v, s, 'check')}>{s} {formatMod(v)}</button>
          ))}</p>
        )}
        {list('dm.vulnerable', m.damageVulnerabilities)}
        {list('dm.resist', m.damageResistances)}
        {list('dm.immune', m.damageImmunities)}
        {list('dm.condImmune', m.conditionImmunities)}
        {list('dm.senses', senses)}
        {m.languages && <p><b>{t('dm.languages')}</b> {m.languages}</p>}
      </div>
      {last && <div className="dm-roll" aria-live="polite"><RollView roll={last} compact /></div>}
      <Actions title={t('dm.traits')} list={m.traits} onD20={d20} onDmg={dmg} />
      <Actions title={t('dm.actions')} list={m.actions} onD20={d20} onDmg={dmg} />
      <Actions title={t('dm.bonusActions')} list={m.bonusActions} onD20={d20} onDmg={dmg} />
      <Actions title={t('dm.reactions')} list={m.reactions} onD20={d20} onDmg={dmg} />
      <Actions title={t('dm.legendary')} list={m.legendaryActions} onD20={d20} onDmg={dmg} />
    </section>
  )
}

function Actions({ title, list, onD20, onDmg }: {
  title: string
  list: MonsterAction[]
  onD20: (bonus: number, label: string, type: 'attack') => void
  onDmg: (dice: string, label: string) => void
}) {
  const { t } = useI18n()
  if (!list.length) return null
  return (
    <>
      <h2 className="sub-title">{title}</h2>
      <ul className="plain dm-actions">
        {list.map((a, i) => (
          <li key={i}>
            <p><b>{a.name}{usageText(a)}.</b> {a.description}</p>
            {(a.attackBonus != null || a.damage.length > 0 || a.damageChoice?.length) && (
              <div className="dm-action-rolls">
                {a.attackBonus != null && (
                  <button className="btn small" onClick={() => onD20(a.attackBonus!, a.name, 'attack')}>{t('dm.toHit', { bonus: formatMod(a.attackBonus) })}</button>
                )}
                {[...a.damage, ...(a.damageChoice ?? [])].map((d, j) => (
                  <button key={j} className="btn small" onClick={() => onDmg(d.dice, `${a.name} (${d.type})`)}>{d.dice} {d.type}</button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

// ---------- Quick reference (the DM screen panels) ----------

const DCS: [MessageKey, number][] = [
  ['dm.ref.dc.veryEasy', 5], ['dm.ref.dc.easy', 10], ['dm.ref.dc.medium', 15], ['dm.ref.dc.hard', 20], ['dm.ref.dc.veryHard', 25], ['dm.ref.dc.impossible', 30],
]
const COVER: [MessageKey, MessageKey][] = [
  ['dm.ref.cover.half', 'dm.ref.cover.halfRule'], ['dm.ref.cover.threeQuarters', 'dm.ref.cover.threeQuartersRule'], ['dm.ref.cover.total', 'dm.ref.cover.totalRule'],
]
const PACE: [MessageKey, string, string, string, MessageKey][] = [
  ['dm.ref.pace.fast', '400 ft.', '4', '30', 'dm.ref.pace.fastRule'],
  ['dm.ref.pace.normal', '300 ft.', '3', '24', 'dm.ref.pace.normalRule'],
  ['dm.ref.pace.slow', '200 ft.', '2', '18', 'dm.ref.pace.slowRule'],
]
const LIGHT: [MessageKey, MessageKey][] = [
  ['dm.ref.light.dim', 'dm.ref.light.dimRule'], ['dm.ref.light.dark', 'dm.ref.light.darkRule'], ['dm.ref.light.darkvision', 'dm.ref.light.darkvisionRule'],
]
const OTHER: [MessageKey, MessageKey][] = [
  ['dm.ref.other.falling', 'dm.ref.other.fallingRule'], ['dm.ref.other.breath', 'dm.ref.other.breathRule'],
  ['dm.ref.other.help', 'dm.ref.other.helpRule'], ['dm.ref.other.group', 'dm.ref.other.groupRule'], ['dm.ref.other.surprise', 'dm.ref.other.surpriseRule'],
]
const REF_CONDITIONS = ['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'] as const

function RefCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card dm-ref"><h2>{title}</h2>{children}</section>
}

function ReferenceTab() {
  const { t, term } = useI18n()
  return (
    <div className="dm-ref-grid">
      <RefCard title={t('dm.ref.dcs')}>
        <dl className="dm-pairs">{DCS.map(([k, dc]) => <div key={k}><dt>{t(k)}</dt><dd>{dc}</dd></div>)}</dl>
      </RefCard>
      <RefCard title={t('dm.ref.cover')}>
        <dl className="dm-rules">{COVER.map(([k, r]) => <div key={k}><dt>{t(k)}</dt><dd>{t(r)}</dd></div>)}</dl>
      </RefCard>
      <RefCard title={t('dm.ref.pace')}>
        <table className="dm-table">
          <thead><tr><th>{t('dm.ref.pace.pace')}</th><th>{t('dm.ref.pace.minute')}</th><th>{t('dm.ref.pace.hour')}</th><th>{t('dm.ref.pace.day')}</th></tr></thead>
          <tbody>{PACE.map(([k, min, hour, day, rule]) => (
            <tr key={k}><th scope="row">{t(k)}<small>{t(rule)}</small></th><td dir="ltr">{min}</td><td>{hour}</td><td>{day}</td></tr>
          ))}</tbody>
        </table>
      </RefCard>
      <RefCard title={t('dm.ref.light')}>
        <dl className="dm-rules">{LIGHT.map(([k, r]) => <div key={k}><dt>{t(k)}</dt><dd>{t(r)}</dd></div>)}</dl>
      </RefCard>
      <RefCard title={t('dm.ref.conditions')}>
        <dl className="dm-rules">{REF_CONDITIONS.map(c => (
          <div key={c}><dt>{term('condition', c, c[0].toUpperCase() + c.slice(1))}</dt><dd>{t(`dm.cond.${c}` as MessageKey)}</dd></div>
        ))}</dl>
      </RefCard>
      <RefCard title={t('dm.ref.other')}>
        <dl className="dm-rules">{OTHER.map(([k, r]) => <div key={k}><dt>{t(k)}</dt><dd>{t(r)}</dd></div>)}</dl>
      </RefCard>
    </div>
  )
}

// ---------- NPCs ----------

function ideaText(idea: NpcIdea, t: (k: MessageKey) => string) {
  return {
    role: t(`dm.npc.role.${idea.role}` as MessageKey),
    notes: `${t(`dm.npc.quirk.${idea.quirk}` as MessageKey)} ${t('dm.npc.wants')} ${t(`dm.npc.want.${idea.want}` as MessageKey)}`,
  }
}

function NpcsTab({ state, update }: { state: DmState; update: Update }) {
  const { t } = useI18n()
  const [idea, setIdea] = useState<NpcIdea>(() => randomNpc())
  const text = ideaText(idea, t)
  const save = (npc: Npc) => update(s => ({ ...s, npcs: [npc, ...s.npcs] }))
  const edit = (id: string, patch: Partial<Npc>) => update(s => ({ ...s, npcs: s.npcs.map(n => (n.id === id ? { ...n, ...patch } : n)) }))

  return (
    <>
      <section className="card dm-idea" aria-labelledby="dm-idea-title">
        <div className="card-head">
          <h2 id="dm-idea-title">{t('dm.npcIdea')}</h2>
          <button className="btn small" onClick={() => setIdea(randomNpc())}>{t('dm.npcReroll')}</button>
        </div>
        <p className="dm-idea-name">{idea.name}</p>
        <p><b>{text.role}.</b> {text.notes}</p>
        <div className="row">
          <button className="btn primary small" onClick={() => { save({ id: newId(), name: idea.name, ...text }); setIdea(randomNpc()) }}>{t('dm.npcKeep')}</button>
          <button className="btn small" onClick={() => save({ id: newId(), name: '', role: '', notes: '' })}>{t('dm.npcBlank')}</button>
        </div>
        <p className="hint">{t('dm.npcHelp', { roles: NPC_TABLES.role, quirks: NPC_TABLES.quirk })}</p>
      </section>
      <section className="card" aria-labelledby="dm-npcs-title">
        <h2 id="dm-npcs-title">{t('dm.npcs', { count: state.npcs.length })}</h2>
        {state.npcs.length === 0 ? <p className="hint">{t('dm.npcsEmpty')}</p> : (
          <ul className="plain dm-npcs">
            {state.npcs.map(n => (
              <li key={n.id}>
                <div className="dm-npc-head">
                  <input value={n.name} onChange={e => edit(n.id, { name: e.target.value })} placeholder={t('dm.npcName')} aria-label={t('dm.npcName')} />
                  <input value={n.role} onChange={e => edit(n.id, { role: e.target.value })} placeholder={t('dm.npcRole')} aria-label={t('dm.npcRole')} />
                  <button className="btn ghost small" onClick={() => confirm(t('dm.npcDelete', { name: n.name || t('dm.npcName') })) && update(s => ({ ...s, npcs: s.npcs.filter(x => x.id !== n.id) }))}>
                    {t('common.delete')}
                  </button>
                </div>
                <textarea value={n.notes} rows={2} onChange={e => edit(n.id, { notes: e.target.value })} placeholder={t('dm.npcNotes')} aria-label={t('dm.npcNotes')} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

// The DM screen: party budget on top, then tabs for encounters, players' rolls, monsters, quick reference and NPCs.
// Uses the sheet's card style (.ff-sheet) so it reads like the rest of the app.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createEncounter, addCombatant, saveEncounter } from '../combat'
import { campaignRows } from '../combat/campaign'
import { BOOK_TITLES, loadMonsters, monsterKey, onContentChanged, sourceById, type Edition, type LoadedMonster, type Monster } from '../content'
import { roll, rollD20 } from '../dice'
import { listNpcs, onNpcsChanged, type NpcSheet } from '../npc'
import { useDice } from '../dice/ui'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { DmRequestsTab, inbox, StoryReminders, useRequests } from '../requests'
import { getMap, MapPicker, MapsTab } from '../maps'
import type { Party } from '../party'
import { Codex } from '../lore'
import { usePartyNames } from '../lore/useNames'
import { fetchPartyCharacters } from '../party/cloud'
import { StatBlock } from '../monsters'
import { totalLevel } from '../rules'
import { getCharacter } from '../storage'
import {
  activePlan, addMonster, npcPlanEntry, addPlan, changeCount, crLabel, crSteps, difficulty, findMonsters, monsterGroups, monsterTypes,
  groupsFromLevels, NPC_TABLES, partyBudget, partySize, sameGroups, planCombatants, planEntry, planXp, randomNpc, removePlan, updatePlan,
  type Difficulty, type MonsterQuery, type NpcIdea,
} from './logic'
import { RollsTab } from './RollsTab'
import { useDmRolls, useUnseenRolls } from './useDmRolls'
import { loadDm, onDmChanged, saveDm, syncDm } from './store'
import { emptyDmState, type DmState, type EncounterPlan, type Npc, type PartyGroup, type PlanMonster } from './types'
import '../sheet/sheet.css'
import '../sheet/combat/combat.css'
import { NpcSheetList } from '../npc/ui/NpcSheetList'
import './dm.css'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { stashNpcPrefill, type NpcPrefill } from '../npc/ui/prefill'
import { readDmEdition, writeDmEdition } from './edition'

const newId = () => crypto.randomUUID()

export type DmTab = 'encounters' | 'rolls' | 'monsters' | 'maps' | 'reference' | 'npcs' | 'requests' | 'lore'
type Tab = DmTab
const TABS: Tab[] = ['encounters', 'lore', 'rolls', 'monsters', 'maps', 'reference', 'npcs', 'requests']
const TAB_KEYS: Record<Tab, MessageKey> = {
  encounters: 'dm.tab.encounters', rolls: 'dm.tab.rolls', monsters: 'dm.tab.monsters', maps: 'dm.tab.maps', reference: 'dm.tab.reference', npcs: 'dm.tab.npcs', requests: 'dm.tab.requests', lore: 'dm.tab.lore',
}
const DIFFICULTY_KEYS: Record<Difficulty, MessageKey> = {
  none: 'dm.diff.none', trivial: 'dm.diff.trivial', low: 'dm.diff.low', moderate: 'dm.diff.moderate', high: 'dm.diff.high', beyond: 'dm.diff.beyond',
}

type Update = (fn: (s: DmState) => DmState) => void

/** The DM's own screen. It reads only the levels of the characters in the campaign being run, for the XP budget. */
export function DmScreen({ userId, onRunEncounter, onOpenSheet, onNewNpc, onOpenNpc, initialTab, party }: {
  userId: string
  onRunEncounter: (encounterId: string) => void
  /** Opens the NPC creator (#/npc/new); the prefill is already stashed. */
  onNewNpc?: () => void
  /** Opens a player's sheet view only. */
  onOpenSheet?: (characterId: string) => void
  /** Opens one of the DM's NPC sheets. */
  onOpenNpc?: (npcId: string) => void
  initialTab?: DmTab
  party?: Party
}) {
  const { t } = useI18n()
  const { record } = useDice()
  const nameOf = usePartyNames()
  const [state, setState] = useState<DmState | null>(null)
  const [monsters, setMonsters] = useState<LoadedMonster[]>([])
  const [edition, setEditionState] = useState<Edition>(readDmEdition)
  const setEdition = (e: Edition) => { setEditionState(e); writeDmEdition(e) }
  // The NPC creator opens prefilled: from a stat block, from a text NPC, or blank, in the campaign being run.
  const makeNpc = onNewNpc && ((p: Omit<NpcPrefill, 'partyId'> = {}) => { stashNpcPrefill({ ...p, partyId: party?.id }); onNewNpc() })
  const [tab, setTab] = useState<Tab>(initialTab ?? 'encounters')
  const requests = useRequests()
  // Opened straight on a later tab (from a request link): bring it into view on narrow screens.
  useEffect(() => {
    if (!initialTab) return
    // After saving an NPC the DM lands on the NPCs tab; wait for the app's focus move so the scroll sticks.
    const go = () => document.getElementById(`dm-tab-${initialTab}`)?.scrollIntoView({ block: initialTab === 'npcs' ? 'start' : 'nearest', inline: 'nearest' })
    const id = setTimeout(go, initialTab === 'npcs' ? 120 : 0)
    return () => clearTimeout(id)
  }, [initialTab, state])
  const [openMonster, setOpenMonster] = useState<string | null>(null)
  // The DM's NPC sheets (src/npc) for this campaign, so a plan can field them.
  const [npcs, setNpcs] = useState<NpcSheet[]>([])
  useEffect(() => {
    let live = true
    const load = () => { listNpcs(userId, party?.id).then(list => { if (live) setNpcs(list) }) }
    load()
    const off = onNpcsChanged(load)
    return () => { live = false; off() }
  }, [userId, party?.id])
  // Players' rolls, live, so the Rolls tab can show a badge while the DM works on another tab.
  const rolls = useDmRolls(party)
  const { unseen, markSeen } = useUnseenRolls(userId, rolls)
  useEffect(() => { if (tab === 'rolls') markSeen() }, [tab, rolls, markSeen])

  useEffect(() => {
    let live = true
    // This device's copy first, then the server's (other devices' edits) once it answers.
    loadDm(userId).then(s => { if (live) setState(s) }).then(() => syncDm(userId)).then(s => { if (live) setState(s) })
    const off = onDmChanged(userId, s => { if (live) setState(s) })
    return () => { live = false; off() }
  }, [userId])
  // Every monster source for the chosen rules (SRD, books, legacy older books, homebrew packs); packs can register later.
  useEffect(() => {
    let live = true
    const load = () => loadMonsters(edition).then(list => { if (live) setMonsters(list) }).catch(() => {})
    load()
    const off = onContentChanged(load)
    return () => { live = false; off() }
  }, [edition])

  const update = useCallback<Update>(fn => {
    setState(prev => {
      if (!prev) return prev
      const next = fn(prev)
      saveDm(userId, next)
      return next
    })
  }, [userId])

  const heroes = usePartyHeroes(party)
  const fromParty = heroes && groupsFromLevels(heroes.map(h => h.level))
  // A budget never edited (the stock "4 players, level 1") follows the campaign's characters by itself.
  useEffect(() => {
    if (fromParty?.length && state && sameGroups(state.party, emptyDmState().party) && !sameGroups(fromParty, state.party)) update(s => ({ ...s, party: fromParty }))
  }, [fromParty, state, update])

  if (!state) return null
  const plan = activePlan(state)

  const addToPlan = (m: Monster) => update(s => {
    const p = activePlan(s)
    if (p) return updatePlan(s, p.id, x => addMonster(x, planEntry(m)))
    return addPlan(s, addMonster({ id: newId(), name: t('dm.planName', { n: s.plans.length + 1 }), monsters: [] }, planEntry(m)))
  })

  const addNpcToPlan = (n: NpcSheet) => update(s => {
    const p = activePlan(s)
    if (p) return updatePlan(s, p.id, x => (x.monsters.some(m => m.npcId === n.id) ? x : addMonster(x, npcPlanEntry(n))))
    return addPlan(s, addMonster({ id: newId(), name: t('dm.planName', { n: s.plans.length + 1 }), monsters: [] }, npcPlanEntry(n)))
  })

  // Start: monsters with their stat blocks, initiative rolled per group, HP average or rolled; then the campaign's party.
  const run = async (p: EncounterPlan) => {
    const rows = planCombatants(p, monsters, newId, {
      d20: (bonus, label) => record(rollD20(bonus, { label: `${label}: Initiative` }, 'initiative')).total,
      hp: dice => roll(dice).total,
    }, npcs)
    const pcs = party ? await campaignRows(party, [], newId) : []
    const enc = [...rows, ...pcs].reduce((e, row) => addCombatant(e, row), createEncounter(newId(), userId, p.name))
    // The plan's map goes with the fight; the tracker places tokens on it when combat starts.
    const map = p.mapId ? await getMap(userId, p.mapId) : undefined
    const saved = await saveEncounter(map ? { ...enc, board: { mapId: map.id, tokens: [], fog: map.fog, locked: false } } : enc)
    onRunEncounter(saved.id)
  }

  const showMonster = (key: string) => { setOpenMonster(key); setTab('monsters') }
  const credits = [...new Set(monsters.map(m => sourceById(m.source)?.attribution).filter((x): x is string => !!x))]

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
      <PartyCard state={state} update={update} plan={plan} fromParty={party && fromParty?.length ? { name: party.name, groups: fromParty } : undefined}
        sheets={party && onOpenSheet ? { heroes: heroes ?? [], onOpen: onOpenSheet } : undefined} />
      {requests && <StoryReminders list={requests} onOpen={() => setTab('requests')} />}
      <div className="cs-tabs">
        <div className="cs-tablist" role="tablist" aria-label={t('dm.tabs')}>
          {TABS.map((id, i) => (
            <button key={id} id={`dm-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="dm-tabpanel"
              tabIndex={tab === id ? 0 : -1} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} onKeyDown={e => move(e, i)}>
              {t(TAB_KEYS[id])}
              {id === 'requests' && requests && inbox(requests).length > 0 && <span className="dm-badge">{inbox(requests).length}</span>}
              {id === 'rolls' && tab !== 'rolls' && unseen > 0 && <span className="dm-badge dm-badge--soft">{unseen > 99 ? '99+' : unseen}</span>}
            </button>
          ))}
        </div>
        <div id="dm-tabpanel" role="tabpanel" aria-labelledby={`dm-tab-${tab}`} className="cs-tabpanel">
          {tab === 'rolls' && <RollsTab party={party} entries={rolls} />}
          {tab === 'encounters' && <EncountersTab userId={userId} state={state} update={update} monsters={monsters} npcs={npcs} onAddNpc={addNpcToPlan} onAdd={addToPlan} onRun={run} onOpenMonster={showMonster} />}
          {tab === 'monsters' && <MonstersTab monsters={monsters} openId={openMonster} onOpen={setOpenMonster} onAdd={addToPlan} planName={plan?.name} edition={edition} onEdition={setEdition}
            onMakeNpc={makeNpc && (m => makeNpc({ monster: { source: m.source, id: m.id } }))} />}
          {tab === 'maps' && <MapsTab ownerId={userId} />}
          {tab === 'reference' && <ReferenceTab />}
          {tab === 'npcs' && onOpenNpc && <NpcSheetList ownerId={userId} partyId={party?.id} onOpen={onOpenNpc} onNew={makeNpc && (() => makeNpc())} />}
          {tab === 'npcs' && <NpcsTab state={state} update={update} onGiveStats={makeNpc && (n => makeNpc({ text: n }))} />}
          {tab === 'requests' && <DmRequestsTab list={requests ?? []} />}
          {tab === 'lore' && (party ? <Codex party={party} userId={userId} nameOf={nameOf} /> : <p className="hint">{t('lore.noCampaign')}</p>)}
        </div>
      </div>
      <p className="hint dm-credit">{t('dm.credit')}</p>
      {credits.map(c => <p key={c} className="hint dm-credit" dir="ltr" lang="en">{c}</p>)}
    </div>
  )
}

// ---------- Top card: the party and its XP budget ----------

interface PartyHero { id: string; name: string; level: number }

/** The player characters in the campaign (the DM's own watching seat left out), from this device or the cloud; null while loading. */
function usePartyHeroes(party?: Party): PartyHero[] | null {
  const [heroes, setHeroes] = useState<PartyHero[] | null>(null)
  const ids = party?.members.filter(m => m.userId !== party.dmId).flatMap(m => (m.characterId ? [m.characterId] : [])) ?? []
  const key = ids.join(',')
  useEffect(() => {
    let live = true
    const list = key ? key.split(',') : []
    ;(async () => {
      const local = await Promise.all(list.map(getCharacter))
      const missing = list.filter((_, i) => !local[i])
      const remote = new Map((missing.length ? await fetchPartyCharacters(missing).catch(() => []) : []).map(c => [c.id, c]))
      const found = list.flatMap((id, i) => { const c = local[i] ?? remote.get(id); return c ? [{ id, name: c.name, level: totalLevel(c) }] : [] })
      if (live) setHeroes(found)
    })()
    return () => { live = false }
  }, [key])
  return heroes
}

const TOP_OPEN = 'ff.dm.topOpen.v1'
const readTopOpen = () => { try { return localStorage.getItem(TOP_OPEN) === '1' } catch { return false } }
const writeTopOpen = (open: boolean) => { try { localStorage.setItem(TOP_OPEN, open ? '1' : '0') } catch { /* stays for this visit */ } }

function PartyCard({ state, update, plan, fromParty, sheets }: {
  state: DmState
  update: Update
  plan?: EncounterPlan
  fromParty?: { name: string; groups: PartyGroup[] }
  /** The campaign's characters, each opening its sheet view only. */
  sheets?: { heroes: PartyHero[]; onOpen: (id: string) => void }
}) {
  const { t } = useI18n()
  const budget = partyBudget(state.party)
  const xp = plan ? planXp(plan) : 0
  const setGroup = (i: number, patch: Partial<{ count: number; level: number }>) =>
    update(s => ({ ...s, party: s.party.map((g, j) => (j === i ? { ...g, ...patch } : g)) }))
  const [open, setOpen] = useState(readTopOpen)
  const toggle = () => setOpen(o => { writeTopOpen(!o); return !o })
  const diff = difficulty(xp, budget)
  return (
    <section className={`card dm-top${open ? ' is-open' : ''}`} aria-labelledby="dm-title">
      {/* Folded by default so the tabs sit on the first screen; one line keeps party, budget and the fight in view. */}
      <div className="dm-top-head">
        <h1 id="dm-title">{t('dm.title')}</h1>
        <button type="button" className="btn small dm-top-toggle" aria-expanded={open} aria-controls="dm-top-body" onClick={toggle}>
          {t(open ? 'dm.topHide' : 'dm.topShow')}
        </button>
        {!open && (
          <p className="dm-top-line">
            <span>{t('dm.party', { count: partySize(state.party) })}</span>
            <span>{t('dm.topBudget', { low: budget.low.toLocaleString(), moderate: budget.moderate.toLocaleString(), high: budget.high.toLocaleString() })}</span>
            {plan && <span className={`dm-top-fight diff-${diff}`}>{plan.name}: <b>{xp.toLocaleString()}</b></span>}
          </p>
        )}
      </div>
      {open && <div id="dm-top-body" className="dm-top-body">
      <div>
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
        {fromParty && !sameGroups(fromParty.groups, state.party) && (
          <button className="btn small" onClick={() => update(s => ({ ...s, party: fromParty.groups }))}>
            {t('dm.fromParty', { name: fromParty.name, count: partySize(fromParty.groups) })}
          </button>
        )}
        {sheets && (
          <div className="dm-sheets">
            <h2 className="sub-title">{t('dm.sheets')}</h2>
            {sheets.heroes.length === 0
              ? <p className="hint">{t('dm.sheetsNone')}</p>
              : (
                <ul className="plain dm-sheet-list">
                  {sheets.heroes.map(h => (
                    <li key={h.id}>
                      <button className="btn small" onClick={() => sheets.onOpen(h.id)}>{h.name}</button>
                      <span className="hint">{t('dm.level')} {h.level}</span>
                    </li>
                  ))}
                </ul>
              )}
            <p className="hint">{t('dm.sheetsHelp')}</p>
          </div>
        )}
      </div>
      <div className="dm-budget">
        <h2 className="sub-title">{t('dm.budget')}</h2>
        <dl className="cs-stats dm-stats">
          <div><dt>{t('dm.diff.low')}</dt><dd>{budget.low.toLocaleString()}</dd></div>
          <div><dt>{t('dm.diff.moderate')}</dt><dd>{budget.moderate.toLocaleString()}</dd></div>
          <div><dt>{t('dm.diff.high')}</dt><dd>{budget.high.toLocaleString()}</dd></div>
          <div className={`dm-now diff-${diff}`}>
            <dt>{plan ? plan.name : t('dm.noPlan')}</dt>
            <dd>{xp.toLocaleString()}</dd>
          </div>
        </dl>
        <p className="hint">{t('dm.budgetHelp')}</p>
      </div>
      </div>}
    </section>
  )
}

// ---------- Encounters ----------

function EncountersTab({ userId, state, update, monsters, npcs, onAddNpc, onAdd, onRun, onOpenMonster }: {
  userId: string
  state: DmState
  update: Update
  monsters: Monster[]
  npcs: NpcSheet[]
  onAddNpc: (n: NpcSheet) => void
  onAdd: (m: Monster) => void
  onRun: (p: EncounterPlan) => void
  onOpenMonster: (id: string) => void
}) {
  const { t, monsterName } = useI18n()
  const plan = activePlan(state)
  const budget = partyBudget(state.party)
  // Plans store the English name; show the monster's name in the current language, NPC sheets keep their own.
  const rowName = (m: PlanMonster) => m.npcId ? m.name
    : monsterName(monsters.find(x => x.source === m.source && x.id === m.monsterId) ?? { id: m.monsterId, name: m.name, source: m.source })
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
            <Meter xp={planXp(plan)} budget={budget} players={partySize(state.party)} />
            {plan.monsters.length === 0 ? <p className="hint">{t('dm.planEmpty')}</p> : (
              <ul className="plain dm-plan-list">
                {plan.monsters.map(m => { const name = rowName(m); return (
                  <li key={`${m.source}:${m.monsterId}`}>
                    {m.npcId
                      ? <a className="link-btn" href={`#/npc/${encodeURIComponent(m.npcId)}`}>{name}</a>
                      : <button className="link-btn" onClick={() => onOpenMonster(monsterKey({ source: m.source, id: m.monsterId }))}>{name}</button>}
                    <span className="muted small">{t('dm.crXp', { cr: crLabel(m.cr), xp: (m.xp * m.count).toLocaleString() })}</span>
                    <span className="dm-count">
                      <button className="btn small" aria-label={t('dm.fewer', { name })} onClick={() => update(s => updatePlan(s, plan.id, p => changeCount(p, m, -1)))}>−</button>
                      <b aria-live="polite">{m.count}</b>
                      {!m.npcId && <button className="btn small" aria-label={t('dm.more', { name })} onClick={() => update(s => updatePlan(s, plan.id, p => changeCount(p, m, 1)))}>+</button>}
                    </span>
                  </li>
                ) })}
              </ul>
            )}
            {npcs.length > 0 && (
              <select className="dm-add-npc" aria-label={t('dm.addNpcLabel')} value=""
                onChange={e => { const n = npcs.find(x => x.id === e.target.value); if (n) onAddNpc(n) }}>
                <option value="">{t('dm.addNpc')}</option>
                {npcs.filter(n => !plan.monsters.some(m => m.npcId === n.id)).map(n => <option key={n.id} value={n.id}>{n.name} ({n.block.name})</option>)}
              </select>
            )}
            <label className="dm-notes">
              <span>{t('dm.notes')}</span>
              <textarea rows={3} value={plan.notes ?? ''} placeholder={t('dm.notesPh')}
                onChange={e => update(s => updatePlan(s, plan.id, p => ({ ...p, notes: e.target.value })))} />
            </label>
            <label className="dm-check">
              <input type="checkbox" checked={!!plan.rollHp} onChange={e => update(s => updatePlan(s, plan.id, p => ({ ...p, rollHp: e.target.checked })))} />
              <span>{t('dm.rollHp')}</span>
            </label>
            <MapPicker ownerId={userId} value={plan.mapId} onChange={mapId => update(s => updatePlan(s, plan.id, p => ({ ...p, mapId })))} />
            <div className="row">
              <button className="btn primary" disabled={!plan.monsters.length || !monsters.length} onClick={() => onRun(plan)}>{t('dm.start')}</button>
            </div>
            <p className="hint">{t('dm.startHelp')}</p>
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

function Meter({ xp, budget, players }: { xp: number; budget: { low: number; moderate: number; high: number }; players: number }) {
  const { t } = useI18n()
  const d = difficulty(xp, budget)
  const pct = budget.high ? Math.min(100, (xp / budget.high) * 100) : 0
  const mark = (n: number) => `${budget.high ? (n / budget.high) * 100 : 0}%`
  return (
    <div className={`dm-meter diff-${d}`}>
      <div className="dm-meter-head">
        <b>{t('dm.diffFor', { diff: t(DIFFICULTY_KEYS[d]), count: players })}</b>
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

/** Types with a translated label (dm.ctype.*); homebrew types show as typed. */
const CREATURE_TYPES = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead', 'summon']

function MonsterBrowser({ monsters, onAdd, onOpen, openId, edition, onEdition }: {
  monsters: LoadedMonster[]
  onAdd: (m: Monster) => void
  onOpen: (key: string) => void
  openId?: string | null
  edition?: Edition
  onEdition?: (e: Edition) => void
}) {
  const { t, monsterName } = useI18n()
  const [q, setQ] = useState<MonsterQuery>({ text: '', minCr: null, maxCr: null, type: '', book: '' })
  const crs = useMemo(() => crSteps(monsters), [monsters])
  const types = useMemo(() => monsterTypes(monsters), [monsters])
  const groups = useMemo(() => monsterGroups(monsters), [monsters])
  const found = useMemo(() => findMonsters(monsters, q, 60, monsterName) as LoadedMonster[], [monsters, q, monsterName])
  const cr = (v: string) => (v === '' ? null : Number(v))
  const typeName = (x: string) => (CREATURE_TYPES.includes(x) ? t(`dm.ctype.${x}` as MessageKey) : x[0].toUpperCase() + x.slice(1))
  const groupName = (g: string) => (g === 'srd' ? t('dm.srdSource') : g === 'hb' ? t('dm.homebrewSource') : BOOK_TITLES[g] ?? g)
  if (!monsters.length) return <p className="hint">{t('common.loading')}</p>
  return (
    <div className="dm-browser">
      {edition && onEdition && (
        <div className="dm-edition" role="group" aria-label={t('dm.rulesEdition')}>
          {(['2014', '2024'] as Edition[]).map(e => (
            <button key={e} type="button" className={`btn small${edition === e ? ' primary' : ''}`} aria-pressed={edition === e} onClick={() => onEdition(e)}>{t(e === '2024' ? 'dm.edition2024' : 'dm.edition2014')}</button>
          ))}
        </div>
      )}
      <div className="dm-filters">
        <input type="search" value={q.text} onChange={e => setQ({ ...q, text: e.target.value })} placeholder={t('dm.searchMonsters')} aria-label={t('dm.searchMonsters')} />
        {groups.length > 1 && (
          <select className="dm-source" aria-label={t('dm.source')} value={q.book ?? ''} onChange={e => setQ({ ...q, book: e.target.value })}>
            <option value="">{t('dm.anySource')}</option>
            {groups.map(g => <option key={g} value={g}>{groupName(g)}</option>)}
          </select>
        )}
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
          {types.map(x => <option key={x} value={x}>{typeName(x)}</option>)}
        </select>
      </div>
      {found.length === 0 ? <p className="hint">{t('dm.noMonsters')}</p> : (
        <ul className="plain dm-monster-list">
          {found.map(m => (
            <li key={monsterKey(m)} className={openId === monsterKey(m) ? 'on' : ''}>
              <button className="link-btn" onClick={() => onOpen(monsterKey(m))} aria-current={openId === monsterKey(m) ? 'true' : undefined}>
                {monsterName(m)}{m.legacy && <small className="dm-legacy"> · {t('dm.legacy')}</small>}
              </button>
              <span className="muted small">{t('dm.crXp', { cr: crLabel(m.challengeRating), xp: m.xp.toLocaleString() })}</span>
              <button className="btn small" onClick={() => onAdd(m)} aria-label={t('dm.addNamed', { name: m.name })}>{t('dm.add')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Matches the .dm-two breakpoint: under it the list and the stat block stack. */
const stacked = () => typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches
const smooth = (): ScrollBehavior => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

function MonstersTab({ monsters, openId, onOpen, onAdd, planName, edition, onEdition, onMakeNpc }: {
  monsters: LoadedMonster[]
  openId: string | null
  onOpen: (key: string) => void
  onAdd: (m: Monster) => void
  planName?: string
  edition: Edition
  onEdition: (e: Edition) => void
  onMakeNpc?: (m: Monster) => void
}) {
  const { t } = useI18n()
  // A plan may name a monster by id only (older plans) or by source and id.
  const open = monsters.find(m => monsterKey(m) === openId) ?? monsters.find(m => m.id === openId)
  const listRef = useRef<HTMLElement>(null)
  const blockRef = useRef<HTMLDivElement>(null)
  const openKey = open && monsterKey(open)
  // One column (phones): the stat block sits under the whole list, so bring it into view when a monster opens.
  useEffect(() => {
    if (openKey && stacked()) blockRef.current?.scrollIntoView({ block: 'start', behavior: smooth() })
  }, [openKey])
  const backToList = () => {
    listRef.current?.scrollIntoView({ block: 'start', behavior: smooth() })
    listRef.current?.querySelector<HTMLElement>('li.on .link-btn')?.focus({ preventScroll: true })
  }
  return (
    <div className="dm-two">
      <section ref={listRef} className="card dm-mon-list" aria-labelledby="dm-mon-title">
        <h2 id="dm-mon-title">{t('dm.tab.monsters')}</h2>
        <MonsterBrowser monsters={monsters} onAdd={onAdd} onOpen={onOpen} openId={openId} edition={edition} onEdition={onEdition} />
      </section>
      {open
        ? <div ref={blockRef} className="dm-mon-block"><StatBlock key={monsterKey(open)} m={open} legacy={open.legacy} actions={<div className="row">
            <button className="btn small dm-back-list" onClick={backToList}>{t('common.backArrow')} {t('dm.backToList')}</button>
            {onMakeNpc && <button className="btn small" onClick={() => onMakeNpc(open)}>{t('npc.build.makeNpc')}</button>}
            <button className="btn small primary" onClick={() => onAdd(open)} title={planName}>{t('dm.addToPlan')}</button>
          </div>} /></div>
        : <section className="card"><p className="hint">{t('dm.pickMonster')}</p></section>}
    </div>
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

function NpcsTab({ state, update, onGiveStats }: { state: DmState; update: Update; onGiveStats?: (n: Npc) => void }) {
  const { t } = useI18n()
  const [idea, setIdea] = useState<NpcIdea>(() => randomNpc())
  const text = ideaText(idea, t)
  const save = (npc: Npc) => update(s => ({ ...s, npcs: [npc, ...s.npcs] }))
  const edit = (id: string, patch: Partial<Npc>) => update(s => ({ ...s, npcs: s.npcs.map(n => (n.id === id ? { ...n, ...patch } : n)) }))

  const [deleting, setDeleting] = useState<Npc | null>(null)

  return (
    <>
      <ConfirmDialog open={!!deleting} title={t('dm.npcDelete', { name: deleting?.name || t('dm.npcName') })} yes={t('common.delete')}
        onYes={() => { const id = deleting?.id; setDeleting(null); if (id) update(s => ({ ...s, npcs: s.npcs.filter(x => x.id !== id) })) }} onClose={() => setDeleting(null)} />
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
                  <div className="row dm-npc-btns">
                    {onGiveStats && <button className="btn small" onClick={() => onGiveStats(n)}>{t('npc.build.giveStats')}</button>}
                    <button className="btn ghost small" onClick={() => setDeleting(n)}>
                      {t('common.delete')}
                    </button>
                  </div>
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

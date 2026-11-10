// The DM screen: a one-line header (party, budget, requests), then six tabs: Party, Fights, Story, Maps, NPCs, Library.
// Uses the sheet's card style (.ff-sheet) so it reads like the rest of the app.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createEncounter, addCombatant, saveEncounter, getEncounter, fightStatus, type Encounter } from '../combat'
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
import { SessionNotes } from '../sessions'
import { fetchPartyCharacters } from '../party/cloud'
import { StatBlock } from '../monsters'
import { totalLevel } from '../rules'
import { getCharacter } from '../storage'
import {
  activePlan, addMonster, npcPlanEntry, fitCrRange, tooStrongAlone, trimAdvice, addPlan, changeCount, crLabel, crSteps, difficulty, findMonsters, monsterGroups, monsterTypes,
  groupsFromLevels, partyBudget, partySize, sameGroups, planCombatants, planEntry, planXp, randomNpc, removePlan, updatePlan,
  type Budget, type Difficulty, type MonsterQuery, type NpcIdea,
} from './logic'
import { RollsTab } from './RollsTab'
import { PartyTab } from './PartyTab'
import type { DmView } from '../nav/route'
import { useDmRolls, useUnseenRolls } from './useDmRolls'
import { loadDm, onDmChanged, saveDm, syncDm } from './store'
import type { Translate } from '../i18n/translate'
import { type DmState, type EncounterPlan, type Npc, type PartyGroup, type PlanMonster } from './types'
import '../sheet/sheet.css'
import '../sheet/combat/combat.css'
import '../npc/ui/npc.css'
import { maxHp as npcMaxHp } from '../npc/engine'
import './dm.css'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { stashNpcPrefill, type NpcPrefill } from '../npc/ui/prefill'
import { readDmEdition, writeDmEdition } from './edition'

const newId = () => crypto.randomUUID()
const NEW_NPC = '__new'

/** Every view the DM screen shows; each has its own address (#/dm/<view>). */
export type DmTab = DmView
type Tab = DmTab
/** Six tabs; three hold two views behind a switch. Requests open from the header button. */
type Group = 'party' | 'encounters' | 'story' | 'maps' | 'npcs' | 'library'
const GROUPS: Group[] = ['party', 'encounters', 'story', 'maps', 'npcs', 'library']
const GROUP_OF: Record<Tab, Group | null> = {
  party: 'party', rolls: 'party', encounters: 'encounters', lore: 'story', sessions: 'story', maps: 'maps', npcs: 'npcs', monsters: 'library', reference: 'library', requests: null,
}
const SUBS: Partial<Record<Group, Tab[]>> = { party: ['party', 'rolls'], story: ['lore', 'sessions'], library: ['monsters', 'reference'] }
const GROUP_KEYS: Record<Group, MessageKey> = {
  party: 'dm.tab.party', encounters: 'dm.tab.encounters', story: 'dm.tab.story', maps: 'dm.tab.maps', npcs: 'dm.tab.npcs', library: 'dm.tab.library',
}
const SUB_KEYS: Partial<Record<Tab, MessageKey>> = {
  party: 'dm.tab.players', rolls: 'dm.tab.rolls', lore: 'dm.tab.lore', sessions: 'sessions.tab', monsters: 'dm.tab.monsters', reference: 'dm.tab.reference',
}
const DIFFICULTY_KEYS: Record<Difficulty, MessageKey> = {
  none: 'dm.diff.none', trivial: 'dm.diff.trivial', low: 'dm.diff.low', moderate: 'dm.diff.moderate', high: 'dm.diff.high', beyond: 'dm.diff.beyond',
}

type Update = (fn: (s: DmState) => DmState) => void

/** The DM's own screen. It reads only the levels of the characters in the campaign being run, for the XP budget. */
export function DmScreen({ userId, onRunEncounter, onOpenSheet, onNewNpc, onOpenNpc, initialTab, onTab, party, runs, onPickCampaign, onStartCampaign }: {
  userId: string
  onRunEncounter: (encounterId: string) => void
  /** Opens the NPC creator (#/npc/new); the prefill is already stashed. */
  onNewNpc?: () => void
  /** Opens a player's sheet view only. */
  onOpenSheet?: (characterId: string) => void
  /** Opens one of the DM's NPC sheets. */
  onOpenNpc?: (npcId: string) => void
  initialTab?: DmTab
  /** The view changed: App puts it in the address (replacing, not adding, a history entry). */
  onTab?: (tab: DmTab) => void
  party?: Party
  /** Campaigns this user runs, so the Lore tab can open one when none is in play. */
  runs?: Party[]
  /** Makes a campaign the one in play (its lore opens here). */
  onPickCampaign?: (partyId: string) => void
  /** Opens the campaign page to start one. */
  onStartCampaign?: () => void
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
  const [tab, setTabState] = useState<Tab>(initialTab ?? (party ? 'party' : 'encounters'))
  // The view a switch-holding group last showed, so Story reopens on Sessions if that is where the DM was.
  const [lastSub, setLastSub] = useState<Partial<Record<Group, Tab>>>({})
  const setTab = (next: Tab) => {
    setTabState(next)
    const g = GROUP_OF[next]
    if (g && SUBS[g]) setLastSub(m => ({ ...m, [g]: next }))
  }
  const group = GROUP_OF[tab]
  // A link to another view while the screen is open (a request toast, the NPC creator's Back).
  const [linked, setLinked] = useState(initialTab)
  if (initialTab !== linked) { setLinked(initialTab); if (initialTab) setTab(initialTab) }
  const tabNow = useRef(onTab)
  useEffect(() => { tabNow.current = onTab })
  useEffect(() => { tabNow.current?.(tab) }, [tab])
  // "Draw a new map" on a plan opens the editor; its back button returns to the plan.
  const [drawFrom, setDrawFrom] = useState<{ mapId: string; planName: string } | null>(null)
  const drawMap = (mapId: string, planName: string) => { setDrawFrom({ mapId, planName }); setTab('maps') }
  useEffect(() => { if (tab !== 'maps') setDrawFrom(null) }, [tab])
  const requests = useRequests()
  // Opened straight on a later tab (from a link): bring it into view on narrow screens, once.
  const [firstTab] = useState(initialTab)
  const firstGroup = firstTab && GROUP_OF[firstTab]
  useEffect(() => {
    if (!firstGroup) return
    const id = setTimeout(() => document.getElementById(`dm-tab-${firstGroup}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 120)
    return () => clearTimeout(id)
  }, [firstGroup, state])
  const [openMonster, setOpenMonster] = useState<string | null>(null)
  const [fightQuery, setFightQuery] = useState<FightQuery>(EMPTY_QUERY)
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
    if (fromParty?.length && state && !sameGroups(fromParty, state.party)) update(s => ({ ...s, party: fromParty }))
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
      d20: (bonus, label) => record(rollD20(bonus, { label: `${label}: Initiative` }, 'initiative'), { quiet: true }).total,
      hp: dice => roll(dice).total,
    }, npcs)
    const pcs = party ? await campaignRows(party, [], newId) : []
    const blank: Encounter = { ...createEncounter(newId(), userId, p.name), planId: p.id, ...(p.notes?.trim() ? { notes: p.notes } : {}) }
    const enc = [...rows, ...pcs].reduce((e, row) => addCombatant(e, row), blank)
    // The plan's map goes with the fight; the tracker places tokens on it when combat starts.
    const map = p.mapId ? await getMap(userId, p.mapId) : undefined
    const saved = await saveEncounter(map ? { ...enc, board: { mapId: map.id, tokens: [], fog: map.fog, locked: false } } : enc)
    // Remember the fight on the plan, written now: the screen closes before a queued state update would run.
    const next = updatePlan(await loadDm(userId), p.id, x => ({ ...x, encounterId: saved.id }))
    await saveDm(userId, next)
    setState(next)
    onRunEncounter(saved.id)
  }

  const credits = [...new Set(monsters.map(m => sourceById(m.source)?.attribution).filter((x): x is string => !!x))]

  const move = (e: React.KeyboardEvent, i: number) => {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!by) return
    const dir = getComputedStyle(e.currentTarget).direction === 'rtl' ? -by : by
    const next = GROUPS[(i + dir + GROUPS.length) % GROUPS.length]
    openGroup(next)
    document.getElementById(`dm-tab-${next}`)?.focus()
  }
  const openGroup = (g: Group) => setTab(lastSub[g] ?? SUBS[g]?.[0] ?? (g as Tab))
  const newRequests = requests ? inbox(requests).length : 0
  const subs = group ? SUBS[group] : undefined
  const budget = partyBudget(state.party)

  return (
    <div className="ff-sheet ff-dm">
      {/* One line, so the tabs sit on the first screen. Requests live here so a new one is always in view. */}
      <header className="card dm-top">
        <div className="dm-top-head">
          <h1 id="dm-title">{t('dm.title')}</h1>
          <p className="dm-top-line">
            <span>{t('dm.party', { count: partySize(state.party) })}</span>
            <span>{t('dm.topBudget', { low: budget.low.toLocaleString(), moderate: budget.moderate.toLocaleString(), high: budget.high.toLocaleString() })}</span>
          </p>
          <button type="button" id="dm-tab-requests" className={`btn small dm-req-btn${tab === 'requests' ? ' on' : ''}`} aria-pressed={tab === 'requests'}
            aria-controls="dm-tabpanel" onClick={() => setTab(tab === 'requests' ? (party ? 'party' : 'encounters') : 'requests')}>
            {t('dm.tab.requests')}
            {newRequests > 0 && <span className="dm-badge">{newRequests}</span>}
          </button>
        </div>
      </header>
      <div className="cs-tabs">
        <div className="cs-tablist" role="tablist" aria-label={t('dm.tabs')}>
          {GROUPS.map((id, i) => (
            <button key={id} id={`dm-tab-${id}`} type="button" role="tab" aria-selected={group === id} aria-controls="dm-tabpanel"
              tabIndex={group === id || (!group && i === 0) ? 0 : -1} className={group === id ? 'on' : ''} onClick={() => openGroup(id)} onKeyDown={e => move(e, i)}>
              {t(GROUP_KEYS[id])}
              {id === 'party' && tab !== 'rolls' && unseen > 0 && <span className="dm-badge dm-badge--soft">{unseen > 99 ? '99+' : unseen}</span>}
            </button>
          ))}
        </div>
        <div id="dm-tabpanel" role={group ? 'tabpanel' : 'region'} aria-labelledby={`dm-tab-${group ?? 'requests'}`} className="cs-tabpanel">
          {subs && (
            <div className="glass-segmented dm-sub" role="group" aria-label={t(GROUP_KEYS[group!])}>
              {subs.map(id => (
                <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
                  {t(SUB_KEYS[id]!)}
                  {id === 'rolls' && tab !== 'rolls' && unseen > 0 && <span className="dm-badge dm-badge--soft">{unseen > 99 ? '99+' : unseen}</span>}
                </button>
              ))}
            </div>
          )}
          {tab === 'party' && (party
            ? <PartyTab party={party} userId={userId} nameOf={nameOf} onOpenSheet={onOpenSheet} />
            : <LoreNoCampaign what="dmParty" runs={runs ?? []} onPick={onPickCampaign} onStart={onStartCampaign} />)}
          {tab === 'rolls' && <RollsTab party={party} entries={rolls} />}
          {tab === 'encounters' && <EncountersTab userId={userId} state={state} update={update} monsters={monsters} npcs={npcs} onAddNpc={addNpcToPlan} onAdd={addToPlan} onRun={run} onOpenFight={onRunEncounter}
            query={fightQuery} onQuery={setFightQuery} edition={edition} onEdition={setEdition} onNewNpc={makeNpc && (planId => makeNpc({ fightPlanId: planId }))} onDrawMap={drawMap}
            budgetCard={<PartyCard state={state} update={update} fromParty={party && fromParty?.length ? { name: party.name, groups: fromParty } : undefined} />} />}
          {tab === 'monsters' && <MonstersTab monsters={monsters} openId={openMonster} onOpen={setOpenMonster} onAdd={addToPlan} planName={plan?.name} edition={edition} onEdition={setEdition}
            onMakeNpc={makeNpc && (m => makeNpc({ monster: { source: m.source, id: m.id } }))} />}
          {tab === 'maps' && <MapsTab key={drawFrom?.mapId ?? 'list'} ownerId={userId} initialOpenId={drawFrom?.mapId}
            back={drawFrom ? { label: t('maps.backToPlan', { name: drawFrom.planName }), go: () => setTab('encounters') } : undefined} />}
          {tab === 'reference' && <ReferenceTab />}
          {tab === 'npcs' && <NpcsTab state={state} update={update} sheets={npcs} onOpen={onOpenNpc} onNew={makeNpc && (() => makeNpc())}
            onGiveStats={makeNpc && (n => makeNpc({ text: n }))} />}
          {tab === 'requests' && <DmRequestsTab list={requests ?? []} userId={userId} />}
          {group === 'story' && requests && <StoryReminders list={requests} onOpen={() => setTab('requests')} />}
          {tab === 'lore' && (party ? <Codex party={party} userId={userId} nameOf={nameOf} /> : <LoreNoCampaign runs={runs ?? []} onPick={onPickCampaign} onStart={onStartCampaign} />)}
          {tab === 'sessions' && (party ? <SessionNotes party={party} userId={userId} onOpenLore={() => setTab('lore')} /> : <LoreNoCampaign what="sessions" runs={runs ?? []} onPick={onPickCampaign} onStart={onStartCampaign} />)}
        </div>
      </div>
      <details className="dm-credits">
        <summary className="hint dm-credit">{t('dm.creditLine')} · <u>{t('dm.creditMore')}</u></summary>
        <p className="hint dm-credit">{t('dm.credit')}</p>
        {credits.map(c => <p key={c} className="hint dm-credit" dir="ltr" lang="en">{c}</p>)}
      </details>
    </div>
  )
}

// ---------- Lore tab without a campaign in play ----------

/** Lore and session notes belong to a campaign: open one the DM runs, or start one, right here. */
function LoreNoCampaign({ what = 'lore', runs, onPick, onStart }: { what?: 'lore' | 'sessions' | 'dmParty'; runs: Party[]; onPick?: (id: string) => void; onStart?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="glass thin dm-lore-start">
      <h3>{t(`${what}.startTitle`)}</h3>
      <p className="hint">{t(runs.length ? `${what}.pickCampaign` : `${what}.noCampaign`)}</p>
      <div className="row wrap">
        {onPick && runs.map(p => (
          <button key={p.id} type="button" className="glass-btn prominent" onClick={() => onPick(p.id)}>{t(`${what}.openFor`, { name: p.name })}</button>
        ))}
        {onStart && <button type="button" className={runs.length ? 'glass-btn' : 'glass-btn prominent'} onClick={onStart}>{t('party.start')}</button>}
      </div>
    </div>
  )
}

// ---------- Top card: the party and its XP budget ----------

interface PartyHero { id: string; name: string; level: number; portrait?: string }

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
      const found = list.flatMap((id, i) => { const c = local[i] ?? remote.get(id); return c ? [{ id, name: c.name, level: totalLevel(c), ...(c.portrait ? { portrait: c.portrait } : {}) }] : [] })
      if (live) setHeroes(found)
    })()
    return () => { live = false }
  }, [key])
  return heroes
}

const TOP_OPEN = 'ff.dm.topOpen.v1'
const readTopOpen = () => { try { return localStorage.getItem(TOP_OPEN) === '1' } catch { return false } }
const writeTopOpen = (open: boolean) => { try { localStorage.setItem(TOP_OPEN, open ? '1' : '0') } catch { /* stays for this visit */ } }

/** The Fights tab's party and budget: who the fights are sized for (typed or from the campaign) and the XP tiles. Folded by default. */
function PartyCard({ state, update, fromParty }: {
  state: DmState
  update: Update
  fromParty?: { name: string; groups: PartyGroup[] }
}) {
  const { t } = useI18n()
  const budget = partyBudget(state.party)
  const setGroup = (i: number, patch: Partial<{ count: number; level: number }>) =>
    update(s => ({ ...s, party: s.party.map((g, j) => (j === i ? { ...g, ...patch } : g)) }))
  const [open, setOpen] = useState(readTopOpen)
  const toggle = () => setOpen(o => { writeTopOpen(!o); return !o })
  return (
    <div className={`dm-budget-fold${open ? ' is-open' : ''}`}>
      <button type="button" className="link-btn dm-budget-toggle" aria-expanded={open} aria-controls="dm-budget-body" onClick={toggle}>
        {t('dm.topShow')} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div id="dm-budget-body" className="dm-top-body">
      <div>
        <h3 className="sub-title">{t('dm.party', { count: partySize(state.party) })}</h3>
        {/* A campaign supplies the party (kept in step above), so the manual counts are only for a DM screen without one. */}
        {fromParty ? <p className="hint">{t('dm.partyLinked', { name: fromParty.name, groups: state.party.map(g => t('dm.groupLine', { count: g.count, level: g.level })).join(', ') })}</p> : <>
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
        </>}
      </div>
      <div className="dm-budget">
        <h3 className="sub-title">{t('dm.budget')}</h3>
        <dl className="cs-stats dm-stats">
          <div><dt>{t('dm.diff.low')}</dt><dd>{budget.low.toLocaleString()}</dd></div>
          <div><dt>{t('dm.diff.moderate')}</dt><dd>{budget.moderate.toLocaleString()}</dd></div>
          <div><dt>{t('dm.diff.high')}</dt><dd>{budget.high.toLocaleString()}</dd></div>
        </dl>
        <p className="hint">{t('dm.budgetHelp')}</p>
      </div>
      </div>}
    </div>
  )
}

// ---------- Encounters ----------

/** The Fights tab's monster search; kept on the DM screen so it survives tab switches. */
export type FightQuery = MonsterQuery & { fit?: boolean }
const EMPTY_QUERY: FightQuery = { text: '', minCr: null, maxCr: null, type: '', book: '', fit: true }

function EncountersTab({ userId, state, update, monsters, npcs, onAddNpc, onAdd, onRun, onOpenFight, query, onQuery, edition, onEdition, onNewNpc, onDrawMap, budgetCard }: {
  userId: string
  /** Party size and XP budget, folded under the plan's meter. */
  budgetCard: ReactNode
  state: DmState
  update: Update
  monsters: LoadedMonster[]
  npcs: NpcSheet[]
  onAddNpc: (n: NpcSheet) => void
  onAdd: (m: Monster) => void
  onRun: (p: EncounterPlan) => void
  onOpenFight: (encounterId: string) => void
  query: FightQuery
  onQuery: (q: FightQuery) => void
  edition: Edition
  onEdition: (e: Edition) => void
  /** Opens the NPC creator; the new sheet joins this plan and the DM comes back here. */
  onNewNpc?: (planId: string) => void
  /** Opens the Maps tab editor on a new map drawn for this plan. */
  onDrawMap: (mapId: string, planName: string) => void
}) {
  const { t, monsterName } = useI18n()
  const plan = activePlan(state)
  const [deleting, setDeleting] = useState(false)
  const [restarting, setRestarting] = useState(false)
  // The fight this plan last started, while it still exists in the tracker.
  const [fight, setFight] = useState<Encounter | null>(null)
  const fightId = plan?.encounterId
  useEffect(() => {
    let live = true
    setFight(null)
    if (fightId) getEncounter(fightId).then(e => { if (live) setFight(e ?? null) })
    return () => { live = false }
  }, [fightId])
  const [openRow, setOpenRow] = useState<string | null>(null)
  const budget = partyBudget(state.party)
  const fit = useMemo(() => fitCrRange(state.party), [state.party])
  const findLoaded = (m: Pick<PlanMonster, 'source' | 'monsterId'>) =>
    monsters.find(x => x.source === m.source && x.id === m.monsterId) ?? monsters.find(x => x.id === m.monsterId)
  // Plans store the English name; show the monster's name in the current language, NPC sheets keep their own.
  const rowName = (m: PlanMonster) => m.npcId ? m.name : monsterName(findLoaded(m) ?? { id: m.monsterId, name: m.name, source: m.source })
  const create = () => update(s => addPlan(s, { id: newId(), name: t('dm.planName', { n: s.plans.length + 1 }), monsters: [] }))
  const xp = plan ? planXp(plan) : 0
  const diff = difficulty(xp, budget)
  const advice = plan && trimAdvice(plan, budget)
  const countOf = (m: Monster) => plan?.monsters.find(x => !x.npcId && x.source === m.source && x.monsterId === m.id)?.count ?? 0
  const seePlan = () => document.getElementById('dm-plan-title')?.scrollIntoView({ block: 'start', behavior: smooth() })

  return (
    <div className="dm-fight">
      <section className="card dm-plan" aria-labelledby="dm-plan-title">
        <div className="card-head">
          <h2 id="dm-plan-title">{t('dm.plans')}</h2>
          <button className="btn small" onClick={create}>{t('dm.newPlan')}</button>
        </div>
        {!plan ? <><p className="hint">{t('dm.plansEmpty')}</p>{budgetCard}</> : (
          <>
            <div className="dm-plan-bar">
              {state.plans.length > 1 && (
                <select aria-label={t('dm.pickPlan')} value={plan.id} onChange={e => update(s => ({ ...s, activePlanId: e.target.value }))}>
                  {state.plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <input aria-label={t('dm.planNameLabel')} value={plan.name}
                onChange={e => update(s => updatePlan(s, plan.id, p => ({ ...p, name: e.target.value })))} />
              <button className="btn ghost small" onClick={() => setDeleting(true)}>
                {t('common.delete')}
              </button>
              <ConfirmDialog open={deleting} title={t('dm.deletePlan', { name: plan.name })} yes={t('common.delete')}
                onYes={() => update(s => removePlan(s, plan.id))} onClose={() => setDeleting(false)} />
            </div>
            <Meter xp={xp} budget={budget} players={partySize(state.party)} />
            {budgetCard}
            {advice && (
              <p className="dm-trim small">{t('dm.trimAdvice', {
                xp: advice.over.toLocaleString(),
                options: advice.options.map(o => o.map(r => t('dm.removeItem', { count: r.count, name: rowName(r.m) })).join(', ')).join(t('dm.or')),
              })}</p>
            )}
            {plan.monsters.length === 0 ? <p className="hint">{t('dm.planEmpty')}</p> : (
              <ul className="plain dm-plan-list">
                {plan.monsters.map(m => { const name = rowName(m); const key = `${m.source}:${m.monsterId}`; const block = !m.npcId && openRow === key ? findLoaded(m) : undefined; return (
                  <li key={key}>
                    {m.npcId
                      ? <a className="link-btn" href={`#/npc/${encodeURIComponent(m.npcId)}`}>{name}</a>
                      : <button className="link-btn" aria-expanded={openRow === key} onClick={() => setOpenRow(openRow === key ? null : key)}>{name}</button>}
                    <span className="muted small">{m.count > 1
                      ? t('dm.crXpEach', { cr: crLabel(m.cr), count: m.count, each: m.xp.toLocaleString(), xp: (m.xp * m.count).toLocaleString() })
                      : t('dm.crXp', { cr: crLabel(m.cr), xp: (m.xp * m.count).toLocaleString() })}</span>
                    <span className="dm-count">
                      <button className="btn small" aria-label={t('dm.fewer', { name })} onClick={() => update(s => updatePlan(s, plan.id, p => changeCount(p, m, -1)))}>−</button>
                      <b aria-live="polite">{m.count}</b>
                      {!m.npcId && <button className="btn small" aria-label={t('dm.more', { name })} onClick={() => update(s => updatePlan(s, plan.id, p => changeCount(p, m, 1)))}>+</button>}
                    </span>
                    {block && (
                      <div className="dm-inline-block">
                        <StatBlock m={block} legacy={block.legacy} actions={<div className="row">
                          <button className="btn small" onClick={() => setOpenRow(null)}>{t('dm.closeBlock')}</button>
                        </div>} />
                      </div>
                    )}
                  </li>
                ) })}
              </ul>
            )}
            {(npcs.length > 0 || onNewNpc) && (
              <select className="dm-add-npc" aria-label={t('dm.addNpcLabel')} value=""
                onChange={e => {
                  if (e.target.value === NEW_NPC) { onNewNpc?.(plan.id); return }
                  const n = npcs.find(x => x.id === e.target.value); if (n) onAddNpc(n)
                }}>
                <option value="">{t('dm.addNpc')}</option>
                {npcs.filter(n => !plan.monsters.some(m => m.npcId === n.id)).map(n => <option key={n.id} value={n.id}>{n.name} ({n.block.name})</option>)}
                {onNewNpc && <option value={NEW_NPC}>{t('dm.makeNpc')}</option>}
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
            <MapPicker ownerId={userId} value={plan.mapId} onChange={mapId => update(s => updatePlan(s, plan.id, p => ({ ...p, mapId })))} onDraw={id => onDrawMap(id, plan.name)} />
            {fight ? (
              <>
                <p className={`dm-fight-status is-${fightStatus(fight)}`} role="status">{fightLabel(fight, t)}</p>
                <div className="row">
                  <button className="btn primary" onClick={() => onOpenFight(fight.id)}>{t('dm.openFight')}</button>
                  <button className="link-btn" disabled={!plan.monsters.length || !monsters.length} onClick={() => setRestarting(true)}>{t('dm.startAgain')}</button>
                </div>
                <ConfirmDialog open={restarting} title={t('dm.startAgainConfirm', { name: plan.name })} yes={t('dm.start')}
                  onYes={() => onRun(plan)} onClose={() => setRestarting(false)} />
              </>
            ) : (
              <>
                <div className="row">
                  <button className="btn primary" disabled={!plan.monsters.length || !monsters.length} onClick={() => onRun(plan)}>{t('dm.start')}</button>
                </div>
                <p className="hint">{t('dm.startHelp')}</p>
              </>
            )}
          </>
        )}
      </section>
      <section className="card dm-add" aria-labelledby="dm-add-title">
        <h2 id="dm-add-title">{t('dm.addMonsters')}</h2>
        <MonsterBrowser monsters={monsters} onAdd={onAdd} onOpen={() => {}} inline query={query} onQuery={onQuery}
          fit={fit} budget={budget} countOf={countOf} edition={edition} onEdition={onEdition} />
        {plan && (
          <div className={`dm-fight-sum diff-${diff}`}>
            <span className="dm-fight-sum-text" aria-live="polite">
              <b className="dm-fight-sum-diff">{t(DIFFICULTY_KEYS[diff])}</b> · <b>{plan.name}</b> · {plan.monsters.length ? plan.monsters.map(m => `${rowName(m)} ×${m.count}`).join(', ') : t('dm.sumEmpty')}
            </span>
            <button className="btn small" onClick={seePlan}>{t('dm.seePlan')}</button>
          </div>
        )}
      </section>
    </div>
  )
}

/** "Fight in progress · Round 2", "Fought · ended after round 3" or "Fight set up, not started yet". */
function fightLabel(enc: Encounter, t: Translate): string {
  const s = fightStatus(enc)
  return s === 'fighting' ? t('dm.fightOn', { round: enc.round }) : s === 'ended' ? t('dm.fightEnded', { round: enc.endedRound ?? 1 }) : t('dm.fightNew')
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

function MonsterBrowser({ monsters, onAdd, onOpen, openId, edition, onEdition, inline, query, onQuery, fit, budget, countOf }: {
  monsters: LoadedMonster[]
  onAdd: (m: Monster) => void
  onOpen: (key: string) => void
  openId?: string | null
  edition?: Edition
  onEdition?: (e: Edition) => void
  /** Fights tab: a name opens its stat block inside the row instead of on the Monsters tab. */
  inline?: boolean
  /** Controlled search, so it outlives the tab. */
  query?: FightQuery
  onQuery?: (q: FightQuery) => void
  /** The party's CR range, for the "Fits this party" chip. */
  fit?: { min: number; max: number } | null
  /** Tags monsters that alone are past High. */
  budget?: Budget
  /** How many of a monster the plan holds, for the "Added" flash. */
  countOf?: (m: Monster) => number
}) {
  const { t, monsterName } = useI18n()
  const [own, setOwn] = useState<FightQuery>({ ...EMPTY_QUERY, fit: false })
  const q = query ?? own
  const setQ = onQuery ?? setOwn
  const fitOn = !!fit && !!q.fit && !q.text.trim()
  const eff = useMemo<MonsterQuery>(() => (fitOn && fit ? { ...q, minCr: fit.min, maxCr: fit.max } : q), [q, fitOn, fit])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(flashTimer.current), [])
  const crs = useMemo(() => crSteps(monsters), [monsters])
  const types = useMemo(() => monsterTypes(monsters), [monsters])
  const groups = useMemo(() => monsterGroups(monsters), [monsters])
  const found = useMemo(() => findMonsters(monsters, eff, 60, monsterName) as LoadedMonster[], [monsters, eff, monsterName])
  const cr = (v: string) => (v === '' ? null : Number(v))
  const typeName = (x: string) => (CREATURE_TYPES.includes(x) ? t(`dm.ctype.${x}` as MessageKey) : x[0].toUpperCase() + x.slice(1))
  const groupName = (g: string) => (g === 'srd' ? t('dm.srdSource') : g === 'hb' ? t('dm.homebrewSource') : BOOK_TITLES[g] ?? g)
  const add = (m: Monster) => {
    onAdd(m)
    if (!countOf) return
    setFlash(monsterKey(m))
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 1200)
  }
  const addLabel = (m: Monster) => (flash === monsterKey(m) && countOf ? t('dm.added', { n: countOf(m) }) : t('dm.add'))
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
      {fit && (
        <button type="button" className={`chip dm-fit${fitOn ? ' on' : ''}`} aria-pressed={fitOn}
          onClick={() => setQ(fitOn ? { ...q, fit: false } : { ...q, fit: true, text: '', minCr: null, maxCr: null })}>
          {t('dm.fitParty', { min: crLabel(fit.min), max: crLabel(fit.max) })}
        </button>
      )}
      <div className="dm-filters">
        <input type="search" value={q.text} onChange={e => setQ({ ...q, text: e.target.value })} placeholder={t('dm.searchMonsters')} aria-label={t('dm.searchMonsters')} />
        {groups.length > 1 && (
          <select className="dm-source" aria-label={t('dm.source')} value={q.book ?? ''} onChange={e => setQ({ ...q, book: e.target.value })}>
            <option value="">{t('dm.anySource')}</option>
            {groups.map(g => <option key={g} value={g}>{groupName(g)}</option>)}
          </select>
        )}
        <select aria-label={t('dm.minCr')} value={eff.minCr ?? ''} onChange={e => setQ({ ...eff, fit: false, minCr: cr(e.target.value) })}>
          <option value="">{t('dm.minCr')}</option>
          {crs.map(c => <option key={c} value={c}>{t('dm.cr', { cr: crLabel(c) })}</option>)}
        </select>
        <select aria-label={t('dm.maxCr')} value={eff.maxCr ?? ''} onChange={e => setQ({ ...eff, fit: false, maxCr: cr(e.target.value) })}>
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
          {found.map(m => { const key = monsterKey(m); const on = inline ? expanded === key : openId === key; return (
            <li key={key} className={on ? 'on' : ''}>
              <button className="link-btn" onClick={() => (inline ? setExpanded(on ? null : key) : onOpen(key))}
                aria-current={!inline && on ? 'true' : undefined} aria-expanded={inline ? on : undefined}>
                {monsterName(m)}{m.legacy && <small className="dm-legacy"> · {t('dm.legacy')}</small>}
                {budget && tooStrongAlone(m.xp, budget) && <small className="dm-strong"> · {t('dm.tooStrong')}</small>}
              </button>
              <span className="muted small">{t('dm.crXp', { cr: crLabel(m.challengeRating), xp: m.xp.toLocaleString() })}</span>
              <button className={`btn small${flash === key ? ' dm-added' : ''}`} onClick={() => add(m)} aria-label={t('dm.addNamed', { name: monsterName(m) })}>{addLabel(m)}</button>
              {inline && on && (
                <div className="dm-inline-block">
                  <StatBlock m={m} legacy={m.legacy} actions={<div className="row">
                    <button className="btn small" onClick={() => setExpanded(null)}>{t('dm.closeBlock')}</button>
                    <button className="btn small primary" onClick={() => add(m)}>{addLabel(m)}</button>
                  </div>} />
                </div>
              )}
            </li>
          ) })}
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
const PACE: [MessageKey, number, string, string, MessageKey][] = [
  ['dm.ref.pace.fast', 400, '4', '30', 'dm.ref.pace.fastRule'],
  ['dm.ref.pace.normal', 300, '3', '24', 'dm.ref.pace.normalRule'],
  ['dm.ref.pace.slow', 200, '2', '18', 'dm.ref.pace.slowRule'],
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
            <tr key={k}><th scope="row">{t(k)}<small>{t(rule)}</small></th><td>{t('cs.feet', { n: min })}</td><td>{hour}</td><td>{day}</td></tr>
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

/** One list of the DM's NPCs: full sheets (with HP, tap to open) and quick text NPCs (tap to edit, "Give stats" to make a sheet). */
function NpcsTab({ state, update, sheets, onOpen, onNew, onGiveStats }: {
  state: DmState
  update: Update
  /** NPC sheets for the campaign in play (src/npc). */
  sheets: NpcSheet[]
  onOpen?: (npcId: string) => void
  onNew?: () => void
  onGiveStats?: (n: Npc) => void
}) {
  const { t, monsterName } = useI18n()
  const [idea, setIdea] = useState<NpcIdea>(() => randomNpc())
  const text = ideaText(idea, t)
  const edit = (id: string, patch: Partial<Npc>) => update(s => ({ ...s, npcs: s.npcs.map(n => (n.id === id ? { ...n, ...patch } : n)) }))
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Npc | null>(null)
  const keep = () => {
    const id = newId()
    update(s => ({ ...s, npcs: [{ id, name: idea.name, ...text }, ...s.npcs] }))
    setIdea(randomNpc())
  }
  const count = sheets.length + state.npcs.length

  return (
    <section className="card dm-npcs-card" aria-labelledby="dm-npcs-title">
      <ConfirmDialog open={!!deleting} title={t('dm.npcDelete', { name: deleting?.name || t('dm.npcName') })} yes={t('common.delete')}
        onYes={() => { const id = deleting?.id; setDeleting(null); if (id) update(s => ({ ...s, npcs: s.npcs.filter(x => x.id !== id) })) }} onClose={() => setDeleting(null)} />
      <div className="card-head">
        <h2 id="dm-npcs-title">{t('dm.npcs', { count })}</h2>
        {onNew && <button type="button" className="btn primary small" onClick={onNew}>{t('npc.build.newNpc')}</button>}
      </div>
      {/* A made-up NPC to improvise with, one line: keep it or roll another. */}
      <p className="dm-idea-line">
        <span className="dm-idea-text" title={`${idea.name}, ${text.role}. ${text.notes}`}>{t('dm.npcIdeaLine', { name: idea.name, role: text.role, notes: text.notes })}</span>
        <button type="button" className="link-btn" onClick={keep}>{t('dm.npcKeepShort')}</button>
        <button type="button" className="link-btn" onClick={() => setIdea(randomNpc())}>{t('dm.npcReroll')}</button>
      </p>
      {count === 0 ? <p className="hint">{t('dm.npcsEmpty')}</p> : (
        <ul className="plain npc-list">
          {sheets.map(n => (
            <li key={n.id}>
              <button type="button" className="npc-list-row" onClick={() => onOpen?.(n.id)} disabled={!onOpen}>
                <b>{n.name}</b>
                <span>{[n.role, monsterName(n.block), t('npc.cr', { cr: crLabel(n.block.challengeRating), xp: n.block.xp.toLocaleString() })].filter(Boolean).join(' · ')}</span>
                <small>{t('dm.npcHp', { hp: n.state.currentHp, max: npcMaxHp(n) })}</small>
              </button>
            </li>
          ))}
          {state.npcs.map(n => (
            <li key={n.id} className="dm-npc-text">
              <div className="dm-npc-row">
                <button type="button" className="npc-list-row" aria-expanded={openId === n.id} onClick={() => setOpenId(openId === n.id ? null : n.id)}>
                  <b>{n.name || t('dm.npcUnnamed')}</b>
                  <span>{n.role || n.notes}</span>
                </button>
                {onGiveStats && <button type="button" className="btn small" onClick={() => onGiveStats(n)}>{t('npc.build.giveStats')}</button>}
              </div>
              {openId === n.id && (
                <div className="dm-npc-edit">
                  <div className="dm-npc-head">
                    <input value={n.name} onChange={e => edit(n.id, { name: e.target.value })} placeholder={t('dm.npcName')} aria-label={t('dm.npcName')} />
                    <input value={n.role} onChange={e => edit(n.id, { role: e.target.value })} placeholder={t('dm.npcRole')} aria-label={t('dm.npcRole')} />
                  </div>
                  <textarea value={n.notes} rows={2} onChange={e => edit(n.id, { notes: e.target.value })} placeholder={t('dm.npcNotes')} aria-label={t('dm.npcNotes')} />
                  <div className="row">
                    <button className="btn ghost small" onClick={() => setDeleting(n)}>{t('common.delete')}</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

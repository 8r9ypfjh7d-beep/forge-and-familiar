// Pure DM screen logic: encounter budgets, plan edits, combat tracker hand-off, NPC generator.
// Randomness comes in as an argument, so everything here is testable.
import type { Combatant } from '../combat/types'
import type { Monster } from '../content'
import type { DmState, EncounterPlan, PartyGroup, PlanMonster } from './types'

/** SRD 5.2 "XP Budget per Character" (Low, Moderate, High), index = level - 1. */
export const XP_BUDGET: readonly (readonly [number, number, number])[] = [
  [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100],
  [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100],
  [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800],
  [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000],
]

export type Difficulty = 'none' | 'trivial' | 'low' | 'moderate' | 'high' | 'beyond'

export interface Budget { low: number; moderate: number; high: number }

const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level) || 1))

export function partyBudget(party: PartyGroup[]): Budget {
  return party.reduce((b, g) => {
    const [low, moderate, high] = XP_BUDGET[clampLevel(g.level) - 1]
    const n = Math.max(0, Math.round(g.count) || 0)
    return { low: b.low + low * n, moderate: b.moderate + moderate * n, high: b.high + high * n }
  }, { low: 0, moderate: 0, high: 0 })
}

/** The budget groups for a party's character levels: one group per level, highest first. */
export function groupsFromLevels(levels: number[]): PartyGroup[] {
  const counts = new Map<number, number>()
  for (const l of levels) counts.set(clampLevel(l), (counts.get(clampLevel(l)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[0] - a[0]).map(([level, count]) => ({ level, count }))
}

const levelsOf = (party: PartyGroup[]) => party.flatMap(g => Array<number>(Math.max(0, Math.round(g.count) || 0)).fill(g.level))

/** Same players at the same levels, however the groups are split, so "Fill from" shows only when it would change something. */
export const sameGroups = (a: PartyGroup[], b: PartyGroup[]) =>
  JSON.stringify(groupsFromLevels(levelsOf(a))) === JSON.stringify(groupsFromLevels(levelsOf(b)))

export const partySize = (party: PartyGroup[]) => party.reduce((n, g) => n + Math.max(0, Math.round(g.count) || 0), 0)

/** SRD 5.2 adds monster XP with no multiplier for numbers. */
export const planXp = (plan: EncounterPlan) => plan.monsters.reduce((xp, m) => xp + m.xp * m.count, 0)

export function difficulty(xp: number, b: Budget): Difficulty {
  if (xp <= 0) return 'none'
  if (xp < b.low) return 'trivial'
  if (xp < b.moderate) return 'low'
  if (xp < b.high) return 'moderate'
  if (xp <= b.high) return 'high'
  return 'beyond'
}

export { crLabel } from '../monsters/format'
import { monsterMod as abilityMod } from '../monsters/block'
export { abilityMod }

// ---------- Plans ----------

export function addPlan(state: DmState, plan: EncounterPlan): DmState {
  return { ...state, plans: [...state.plans, plan], activePlanId: plan.id }
}

export function removePlan(state: DmState, id: string): DmState {
  const plans = state.plans.filter(p => p.id !== id)
  return { ...state, plans, activePlanId: state.activePlanId === id ? plans[0]?.id ?? null : state.activePlanId }
}

export function updatePlan(state: DmState, id: string, fn: (p: EncounterPlan) => EncounterPlan): DmState {
  return { ...state, plans: state.plans.map(p => (p.id === id ? fn(p) : p)) }
}

export const activePlan = (state: DmState) => state.plans.find(p => p.id === state.activePlanId) ?? state.plans[0]

const sameMonster = (a: Pick<PlanMonster, 'monsterId' | 'source'>, b: Pick<PlanMonster, 'monsterId' | 'source'>) =>
  a.monsterId === b.monsterId && a.source === b.source

export function planEntry(m: Monster): Omit<PlanMonster, 'count'> {
  return { monsterId: m.id, source: m.source, name: m.name, xp: m.xp, cr: m.challengeRating }
}

/** Adds one more of a monster (stacks with the same monster). */
export function addMonster(plan: EncounterPlan, m: Omit<PlanMonster, 'count'>, count = 1): EncounterPlan {
  const at = plan.monsters.find(x => sameMonster(x, m))
  return at
    ? { ...plan, monsters: plan.monsters.map(x => (x === at ? { ...x, count: Math.min(99, x.count + count) } : x)) }
    : { ...plan, monsters: [...plan.monsters, { ...m, count }] }
}

/** Changes a monster's count by `by`; at 0 it leaves the plan. */
export function changeCount(plan: EncounterPlan, m: Pick<PlanMonster, 'monsterId' | 'source'>, by: number): EncounterPlan {
  return {
    ...plan,
    monsters: plan.monsters
      .map(x => (sameMonster(x, m) ? { ...x, count: Math.min(99, x.count + by) } : x))
      .filter(x => x.count > 0),
  }
}

// ---------- Combat tracker hand-off ----------

/** Tracker rows for a plan: one per creature, numbered when there are several, average HP. */
export function planCombatants(plan: EncounterPlan, monsters: Monster[], newId: () => string): Omit<Combatant, 'conditions'>[] {
  return plan.monsters.flatMap(pm => {
    const m = monsters.find(x => sameMonster({ monsterId: x.id, source: x.source }, pm))
    const hp = m?.hitPoints ?? 1
    return Array.from({ length: pm.count }, (_, i) => ({
      id: newId(),
      name: pm.count > 1 ? `${pm.name} ${i + 1}` : pm.name,
      kind: 'npc' as const,
      initiative: null,
      initBonus: m ? abilityMod(m.abilities.dex) : 0,
      conSave: m ? m.savingThrows.con ?? abilityMod(m.abilities.con) : 0,
      ac: m?.armorClass[0]?.value,
      hp: { current: hp, max: hp, temp: 0 },
    }))
  })
}

// ---------- Monster search ----------

export interface MonsterQuery {
  text: string
  /** Inclusive CR bounds; null = any. */
  minCr: number | null
  maxCr: number | null
  type: string
  /** '' any, 'srd' the SRD, 'hb' homebrew and imported packs, or a book code (`Monster.book`). */
  book?: string
}

/** Which source picker group a monster belongs to: 'srd', its book code, or 'hb' for packs. */
export const monsterGroup = (m: Pick<Monster, 'source' | 'book'>) =>
  m.source.startsWith('srd-') ? 'srd' : m.source.startsWith('books-') ? m.book ?? 'books' : 'hb'

/** Matches the English name, and the translated name when `localName` is given (Hebrew search). */
export function findMonsters(list: Monster[], q: MonsterQuery, limit = 60, localName?: (m: Monster) => string): Monster[] {
  const text = q.text.trim().toLowerCase()
  return list
    .filter(m =>
      (!text || m.name.toLowerCase().includes(text) || (localName?.(m) ?? '').toLowerCase().includes(text)) &&
      (q.minCr == null || m.challengeRating >= q.minCr) &&
      (q.maxCr == null || m.challengeRating <= q.maxCr) &&
      (!q.type || m.type.toLowerCase() === q.type) &&
      (!q.book || monsterGroup(m) === q.book))
    .sort((a, b) => a.challengeRating - b.challengeRating || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** Source groups present in the list, for the source picker: 'srd' first, then book codes, then 'hb'. */
export const monsterGroups = (list: Monster[]) => {
  const set = new Set(list.map(monsterGroup))
  return ['srd', ...[...set].filter(g => g !== 'srd' && g !== 'hb').sort(), ...(set.has('hb') ? ['hb'] : [])].filter(g => set.has(g))
}

/** Every CR in the list, smallest first, for the CR pickers. */
export const crSteps = (list: Monster[]) => [...new Set(list.map(m => m.challengeRating))].sort((a, b) => a - b)

/** Lower-case monster types, for the type picker. */
export const monsterTypes = (list: Monster[]) => [...new Set(list.map(m => m.type.toLowerCase()))].sort()

// ---------- NPC generator ----------

/** Returns an integer from 0 to n - 1. */
export type Chooser = (n: number) => number

export const randomPick: Chooser = n => Math.floor(Math.random() * n)

// Made-up syllables, not from any book.
const STARTS = ['Al', 'Bra', 'Cor', 'Da', 'El', 'Fen', 'Gar', 'Hal', 'Is', 'Jor', 'Kae', 'Lir', 'Mor', 'Nym', 'Or', 'Pell', 'Quin', 'Ros', 'Syl', 'Tor', 'Ul', 'Vey', 'Wren', 'Yor', 'Zan']
const MIDDLES = ['', '', 'a', 'e', 'i', 'o', 'ri', 'la', 'de', 'mo']
const ENDS = ['dric', 'wyn', 'mar', 'ra', 'thas', 'ven', 'lin', 'da', 'gorn', 'iel', 'is', 'ock', 'ara', 'en', 'ius']
const SURNAMES = ['Ashford', 'Blackbriar', 'Copperkettle', 'Dunmere', 'Emberly', 'Fairwind', 'Greystone', 'Hollowell', 'Ironvale', 'Marsh', 'Oakhart', 'Quickwater', 'Redfern', 'Stormbrook', 'Thistle', 'Underhill']

export function randomName(pick: Chooser = randomPick): string {
  const first = STARTS[pick(STARTS.length)] + MIDDLES[pick(MIDDLES.length)] + ENDS[pick(ENDS.length)]
  return `${first} ${SURNAMES[pick(SURNAMES.length)]}`
}

/** Counts of the translated roles, quirks and wants (dm.npc.role.N, dm.npc.quirk.N, dm.npc.want.N). */
export const NPC_TABLES = { role: 16, quirk: 16, want: 12 } as const

export interface NpcIdea { name: string; role: number; quirk: number; want: number }

export function randomNpc(pick: Chooser = randomPick): NpcIdea {
  return { name: randomName(pick), role: pick(NPC_TABLES.role), quirk: pick(NPC_TABLES.quirk), want: pick(NPC_TABLES.want) }
}

// ---------- Saved data ----------

/** Fills gaps in older or hand-edited saves. */
export function normalizeDm(raw: unknown, fallback: DmState): DmState {
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Partial<DmState>
  return {
    schemaVersion: fallback.schemaVersion,
    party: Array.isArray(r.party) && r.party.length ? r.party : fallback.party,
    plans: Array.isArray(r.plans) ? r.plans : [],
    activePlanId: typeof r.activePlanId === 'string' ? r.activePlanId : null,
    npcs: Array.isArray(r.npcs) ? r.npcs : [],
  }
}

/**
 * Which copy the DM screen uses after reaching the server: edits this device hasn't sent yet
 * win, otherwise the server's copy. `push` says this device's copy should be sent up.
 */
export function pickDm(local: DmState, localPending: boolean, server: DmState | null): { state: DmState; push: boolean } {
  if (localPending || !server) return { state: local, push: localPending || !server }
  return { state: server, push: false }
}

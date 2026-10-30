// The DM's roll log: every player's rolls, public and secret, in one list. Pure helpers; RollsTab.tsx renders them.
import type { RollResult, RollType } from '../dice'
import type { SecretRoll } from '../dice/secret'
import { mergePartyRolls } from '../party/feed'
import type { Party } from '../party/types'

export interface DmRollEntry {
  roll: RollResult
  /** UserProfile.id of the player who rolled. */
  userId: string
  /** True for a roll only the DM sees. */
  secret: boolean
}

export type RollKind = 'all' | 'attacks' | 'checks' | 'saves' | 'secret'
export const ROLL_KINDS: RollKind[] = ['all', 'attacks', 'checks', 'saves', 'secret']

const KIND_TYPES: Record<Exclude<RollKind, 'all' | 'secret'>, RollType[]> = {
  attacks: ['attack', 'damage'],
  checks: ['check', 'skill', 'initiative'],
  saves: ['save', 'deathSave'],
}

export const DM_ROLL_LIMIT = 100

/**
 * Public rolls (the feed's rules: the character each member brings, since they joined) plus the party's
 * secret rolls, each roll once, newest first. The DM's own rolls never appear: the DM brings no character.
 */
export function mergeDmRolls(
  party: Party,
  histories: Record<string, readonly RollResult[] | undefined>,
  secrets: readonly SecretRoll[],
  limit = DM_ROLL_LIMIT,
): DmRollEntry[] {
  const members = new Set(party.members.map(m => m.userId))
  const byId = new Map<string, DmRollEntry>()
  for (const s of secrets) {
    if (s.fromUserId !== party.dmId && members.has(s.fromUserId)) byId.set(s.roll.id, { roll: s.roll, userId: s.fromUserId, secret: true })
  }
  for (const f of mergePartyRolls(party, histories, Number.MAX_SAFE_INTEGER)) {
    if (!byId.has(f.roll.id)) byId.set(f.roll.id, { roll: f.roll, userId: f.userId, secret: false })
  }
  return [...byId.values()].sort((a, b) => b.roll.timestamp.localeCompare(a.roll.timestamp)).slice(0, limit)
}

export function matchesKind(entry: DmRollEntry, kind: RollKind): boolean {
  if (kind === 'all') return true
  if (kind === 'secret') return entry.secret
  return KIND_TYPES[kind].includes(entry.roll.type)
}

/** Narrows the log to one player and/or one kind of roll. */
export function filterRolls(entries: readonly DmRollEntry[], filter: { userId?: string | null; kind?: RollKind }): DmRollEntry[] {
  const kind = filter.kind ?? 'all'
  return entries.filter(e => (!filter.userId || e.userId === filter.userId) && matchesKind(e, kind))
}

export interface PlayerRollSummary {
  userId: string
  count: number
  /** ISO time of the newest roll, if any. */
  lastAt?: string
  crits: number
  fumbles: number
}

/** One row per player who brings a character (the DM excluded), in member order. */
export function playerSummary(party: Party, entries: readonly DmRollEntry[]): PlayerRollSummary[] {
  return party.members.filter(m => m.characterId && m.userId !== party.dmId).map(m => {
    const mine = entries.filter(e => e.userId === m.userId)
    return {
      userId: m.userId,
      count: mine.length,
      lastAt: mine[0]?.roll.timestamp,
      crits: mine.filter(e => e.roll.d20?.crit && e.roll.type !== 'deathSave').length,
      fumbles: mine.filter(e => e.roll.d20?.fumble).length,
    }
  })
}

/** Rolls newer than the DM's last look at the log. Nothing counts before the first look. */
export function unseenCount(entries: readonly DmRollEntry[], seenAt: string | undefined): number {
  if (!seenAt) return 0
  return entries.filter(e => e.roll.timestamp > seenAt).length
}

export const rollsSeenKey = (userId: string) => `ff.dm.rollsSeen.v1.${userId}`

// Party roll feed: every member's rolls with the character they bring, newest first.
// Reads each member's dice history on this device, plus (cloud parties) the rolls the server shares
// with party members (RollFeed via cloud.ts fetchPartyRolls).
import type { RollResult } from '../dice'
import type { Party } from './types'

/** Same key the dice module's DiceProvider writes, one history per player. */
const ROLLS_PREFIX = 'ff.rolls.v1.'

export interface FeedEntry {
  roll: RollResult
  userId: string
}

/**
 * Merges members' histories into one feed. A member's roll shows only when it was made by the
 * character they bring to this party, after they joined. Rolls of watchers (like the DM) stay private,
 * and secret rolls (sent only to the DM) are skipped; the DM sees those in their own log.
 */
export function mergePartyRolls(party: Party, histories: Record<string, readonly RollResult[] | undefined>, limit = 50): FeedEntry[] {
  const feed: FeedEntry[] = []
  for (const m of party.members) {
    if (!m.characterId) continue
    for (const roll of histories[m.userId] ?? []) {
      if ('secret' in roll && roll.secret) continue
      if (roll.roller?.characterId === m.characterId && roll.timestamp >= m.joinedAt) feed.push({ roll, userId: m.userId })
    }
  }
  return feed.sort((a, b) => b.roll.timestamp.localeCompare(a.roll.timestamp)).slice(0, limit)
}

/** One member's rolls from two sources (this device, the cloud), each roll once, newest first. */
export function mergeRollLists(a: readonly RollResult[], b: readonly RollResult[]): RollResult[] {
  const byId = new Map<string, RollResult>()
  for (const r of [...a, ...b]) if (!byId.has(r.id)) byId.set(r.id, r)
  return [...byId.values()].sort((x, y) => y.timestamp.localeCompare(x.timestamp))
}

export function readMemberRolls(userId: string): RollResult[] {
  try {
    const list = JSON.parse(globalThis.localStorage?.getItem(ROLLS_PREFIX + userId) ?? '[]')
    return Array.isArray(list) ? (list as RollResult[]) : []
  } catch {
    return []
  }
}

/** Calls fn when any player's rolls change in another tab. Same-tab rolls come from useDice().history. */
export function onMemberRollsChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === null || e.key.startsWith(ROLLS_PREFIX)) fn() }
  window.addEventListener('storage', other)
  return () => window.removeEventListener('storage', other)
}

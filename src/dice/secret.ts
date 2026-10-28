// Secret rolls: a player rolls and only the party's DM sees the result.
// They never enter the roller's own history (ff.rolls.v1.*), so the group feed can't leak them.
// Storage is one log per party in localStorage; for cloud parties secretCloud.ts also sends each roll
// to the server, where only the party's DM can read results, and refreshes the DM's log from it.
import type { RollResult } from './types'

export interface SecretRoll {
  roll: RollResult
  /** UserProfile.id of the player who rolled. */
  fromUserId: string
}

/** What the roller sees afterwards: that they rolled, never the result. */
export interface MaskedSecretRoll {
  id: string
  label: string
  timestamp: string
}

export type SecretView =
  | { kind: 'dm'; rolls: SecretRoll[] }
  | { kind: 'player'; sent: MaskedSecretRoll[] }

export const SECRET_LIMIT = 100

export const secretKey = (partyId: string) => `ff.rolls.secret.v1.${partyId}`

export function maskSecret({ roll }: SecretRoll): MaskedSecretRoll {
  return { id: roll.id, label: roll.label ?? 'Secret roll', timestamp: roll.timestamp }
}

/** Newest first, capped. */
export function addSecret(list: readonly SecretRoll[], entry: SecretRoll, limit = SECRET_LIMIT): SecretRoll[] {
  return [entry, ...list].slice(0, limit)
}

/** The DM sees every result; a player sees only that their own rolls were sent. */
export function secretView(list: readonly SecretRoll[], dmId: string, viewerId: string): SecretView {
  if (viewerId === dmId) return { kind: 'dm', rolls: [...list] }
  return { kind: 'player', sent: list.filter(s => s.fromUserId === viewerId).map(maskSecret) }
}

const CHANGED = 'ff:secret-rolls-changed'

export function loadSecretRolls(partyId: string): SecretRoll[] {
  try {
    const list = JSON.parse(globalThis.localStorage?.getItem(secretKey(partyId)) ?? '[]')
    return Array.isArray(list) ? (list as SecretRoll[]) : []
  } catch {
    return []
  }
}

function saveSecretRolls(partyId: string, list: SecretRoll[]) {
  try {
    globalThis.localStorage?.setItem(secretKey(partyId), JSON.stringify(list))
  } catch {
    // Storage full or blocked: the roll is lost, same as any offline write.
  }
  globalThis.dispatchEvent?.(new CustomEvent(CHANGED, { detail: partyId }))
}

export function sendSecretRoll(partyId: string, entry: SecretRoll): void {
  saveSecretRolls(partyId, addSecret(loadSecretRolls(partyId), entry))
}

/** Replaces the party's log on this device (the DM's copy of the server's). Skips unchanged lists. */
export function replaceSecretRolls(partyId: string, list: SecretRoll[]): void {
  if (JSON.stringify(list) !== JSON.stringify(loadSecretRolls(partyId))) saveSecretRolls(partyId, list)
}

export function clearSecretRolls(partyId: string): void {
  saveSecretRolls(partyId, [])
}

/** Calls fn when this party's secret log changes, in this tab or another. Returns an unsubscribe function. */
export function onSecretRollsChanged(partyId: string, fn: () => void): () => void {
  const here = (e: Event) => { if ((e as CustomEvent).detail === partyId) fn() }
  const other = (e: StorageEvent) => { if (e.key === secretKey(partyId)) fn() }
  globalThis.addEventListener?.(CHANGED, here)
  globalThis.addEventListener?.('storage', other)
  return () => {
    globalThis.removeEventListener?.(CHANGED, here)
    globalThis.removeEventListener?.('storage', other)
  }
}

// Activation code helpers. Pure apart from Web Crypto hashing.
import type { Account } from './types'
import type { RosterEntry } from './roster'

/** Uppercases and drops spaces and dashes, so "roy 7pbj-2msu" matches "ROY-7PBJ-2MSU". */
export function normalizeActivationCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

/** Hex SHA-256 of the normalized code; the database computes the same value. */
export async function hashActivationCode(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeActivationCode(input))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function findInRoster(input: string, roster: RosterEntry[]): Promise<Account | undefined> {
  const hash = await hashActivationCode(input)
  const hit = roster.find(a => a.hash === hash)
  return hit && { id: hit.id, name: hit.name, role: hit.role }
}

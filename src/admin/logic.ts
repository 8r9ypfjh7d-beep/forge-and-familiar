// Admin page helpers. Pure: callers pass in the device's saved entries.
import type { AccountRow, CharacterRow, DmStateRow } from '../cloud/types'
import type { Character, UserProfile } from '../model/character'

/** Every app key starts with this; other sites' data on the same origin is left alone. */
export const APP_PREFIX = 'ff.'
/** Kept on restore, so restoring a backup never signs the admin out (here or on the server). */
export const KEEP_ON_RESTORE = ['ff.account.v1', 'ff.cloud.v1', 'ff.supabase.auth']
/** This browser's server sign-in; never put in a backup file. */
export const NEVER_BACKED_UP = ['ff.supabase.auth']

export interface SavedEntry {
  key: string
  value: string
}

export interface KeyRow {
  key: string
  bytes: number
  /** Number of records when the value is a list. */
  items?: number
  /** What it holds, by name: 'characters', 'dm'... Matches an `admin.key.*` message. */
  kind: string
  /** The profile or character the key belongs to, for per-user keys. */
  ownerId?: string
}

const KINDS: [prefix: string, kind: string][] = [
  ['ff.characters.v1', 'characters'],
  ['ff.profiles.v1', 'profiles'],
  ['ff.activeProfile.v1', 'activeProfile'],
  ['ff.account.v1', 'account'],
  ['ff.requests.v1', 'requests'],
  ['ff.dm.v1.', 'dm'],
  ['ff.dm.pending.v1.', 'dmPending'],
  ['ff.cloud.v1', 'cloud'],
  ['ff.supabase.auth', 'cloudAuth'],
  ['ff.parties.v1', 'parties'],
  ['ff.encounters.v1', 'encounters'],
  ['ff.homebrew.v1', 'homebrew'],
  ['ff.companions.v1', 'companions'],
  ['ff.snapshots.v1', 'snapshots'],
  ['ff.journal.v1.', 'journal'],
  ['ff.recaps.v1.', 'recaps'],
  ['ff.rolls.secret.v1.', 'secretRolls'],
  ['ff.rolls.v1.', 'rolls'],
  ['ff.handouts.v1', 'handouts'],
  ['ff.lore.chapters.v1', 'lore chapters'],
  ['ff.sessions.v1', 'schedule'],
  ['ff.history.v1', 'history'],
]

/** Names what a saved key holds, and whose it is for per-user keys like `ff.dm.v1.<userId>`. */
export function describeKey(key: string): Pick<KeyRow, 'kind' | 'ownerId'> {
  const hit = KINDS.find(([prefix]) => key.startsWith(prefix))
  if (!hit) return { kind: 'other' }
  const rest = key.slice(hit[0].length)
  return hit[0].endsWith('.') && rest ? { kind: hit[1], ownerId: rest } : { kind: hit[1] }
}

export function keyRows(entries: SavedEntry[]): KeyRow[] {
  return entries
    .filter(e => e.key.startsWith(APP_PREFIX))
    .map(e => {
      let items: number | undefined
      try {
        const v = JSON.parse(e.value)
        if (Array.isArray(v)) items = v.length
      } catch { /* plain string */ }
      return { key: e.key, bytes: new Blob([e.value]).size, items, ...describeKey(e.key) }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

export interface Backup {
  app: 'forge-and-familiar'
  kind: 'device-backup'
  version: 1
  createdAt: string
  data: Record<string, string>
}

export function buildBackup(entries: SavedEntry[], now: string): Backup {
  const data: Record<string, string> = {}
  for (const e of entries) if (e.key.startsWith(APP_PREFIX) && !NEVER_BACKED_UP.includes(e.key)) data[e.key] = e.value
  return { app: 'forge-and-familiar', kind: 'device-backup', version: 1, createdAt: now, data }
}

/** Reads a backup file. Returns null for anything that isn't one; only app keys with string values are kept. */
export function parseBackup(text: string): Backup | null {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const b = v as Partial<Backup>
  if (b.app !== 'forge-and-familiar' || b.kind !== 'device-backup' || b.version !== 1) return null
  if (!b.data || typeof b.data !== 'object') return null
  const data: Record<string, string> = {}
  for (const [k, val] of Object.entries(b.data)) {
    if (k.startsWith(APP_PREFIX) && !NEVER_BACKED_UP.includes(k) && typeof val === 'string') data[k] = val
  }
  return { app: b.app, kind: b.kind, version: 1, createdAt: String(b.createdAt ?? ''), data }
}

/** Writes and removals that turn the device into the backup, apart from KEEP_ON_RESTORE keys. */
export function restorePlan(current: string[], backup: Backup): { set: SavedEntry[]; remove: string[] } {
  const keep = (k: string) => KEEP_ON_RESTORE.includes(k)
  return {
    set: Object.entries(backup.data).filter(([k]) => !keep(k)).map(([key, value]) => ({ key, value })),
    remove: current.filter(k => k.startsWith(APP_PREFIX) && !keep(k) && !(k in backup.data)),
  }
}

export interface Person {
  id: string
  name: string
  role?: 'player' | 'dm'
  admin?: boolean
  /** In the group's roster (has an activation code). */
  account: boolean
  /** Has a profile on this device. */
  local: boolean
  characters: number
}

/** The roster accounts and local profiles in one list, with how many characters each owns here. */
export function people(
  roster: { id: string; name: string; role: 'player' | 'dm'; admin?: boolean }[],
  profiles: UserProfile[],
  characters: Pick<Character, 'ownerId'>[],
): Person[] {
  const count = (id: string) => characters.filter(c => c.ownerId === id).length
  const local = new Set(profiles.map(p => p.id))
  const fromRoster: Person[] = roster.map(a => ({
    id: a.id, name: a.name, role: a.role, admin: a.admin, account: true, local: local.has(a.id), characters: count(a.id),
  }))
  const others: Person[] = profiles
    .filter(p => !roster.some(a => a.id === p.id))
    .map(p => ({ id: p.id, name: p.displayName, account: false, local: true, characters: count(p.id) }))
  // Characters whose owner has no profile here, so they can still be found and moved.
  const known = new Set([...roster.map(a => a.id), ...profiles.map(p => p.id)])
  const orphans: Person[] = [...new Set(characters.map(c => c.ownerId).filter(id => !known.has(id)))]
    .map(id => ({ id, name: id, account: false, local: false, characters: count(id) }))
  return [...fromRoster, ...others, ...orphans]
}

export interface CloudPerson {
  id: string
  name: string
  role: 'player' | 'dm'
  admin: boolean
  /** Browsers signed in to this account, newest first. */
  devices: { userId: string; linkedAt: string }[]
  characters: number
  /** When the account's DM screen was last saved on the server, if it has one. */
  dmSavedAt?: string
  /** Latest save of any of their characters. */
  lastSaved?: string
}

/** One row per server account: devices, characters and DM screen. */
export function cloudPeople(
  accounts: AccountRow[],
  devices: { user_id: string; account_id: string; linked_at: string }[],
  characters: Pick<CharacterRow, 'owner_id' | 'updated_at' | 'deleted'>[],
  dm: Pick<DmStateRow, 'account_id' | 'updated_at'>[],
): CloudPerson[] {
  return accounts.map(a => {
    const mine = characters.filter(c => c.owner_id === a.id && !c.deleted)
    const lastSaved = mine.map(c => c.updated_at).sort().at(-1)
    return {
      id: a.id,
      name: a.name,
      role: a.role,
      admin: a.is_admin,
      devices: devices.filter(d => d.account_id === a.id)
        .sort((x, y) => y.linked_at.localeCompare(x.linked_at))
        .map(d => ({ userId: d.user_id, linkedAt: d.linked_at })),
      characters: mine.length,
      dmSavedAt: dm.find(d => d.account_id === a.id)?.updated_at,
      lastSaved,
    }
  })
}

/** Characters saved on this device that the server doesn't have (not signed in when made, or not synced yet). */
export function deviceOnly(local: Character[], server: Pick<CharacterRow, 'id'>[]): Character[] {
  const ids = new Set(server.map(c => c.id))
  return local.filter(c => !ids.has(c.id))
}

/**
 * True when this device's copy of a character was edited after the server's and differs from it,
 * so the admin can send it up. Sync only uploads the signed-in account's own characters.
 */
export function hasUnsentEdits(local: Character | undefined, server: Pick<CharacterRow, 'data' | 'updated_at'>): boolean {
  if (!local?.updatedAt || local.updatedAt <= server.updated_at) return false
  const strip = (c: Character) => JSON.stringify({ ...c, updatedAt: undefined })
  return strip(local) !== strip(server.data)
}

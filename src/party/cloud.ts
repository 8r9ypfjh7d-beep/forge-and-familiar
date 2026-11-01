// Parties through Supabase (supabase/migrations/20261027120000_parties.sql). Used by store.ts when
// the player is the account this device is signed in to. The last list fetched is cached, so the
// party list still shows offline. Members also read each other's brought characters and rolls.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCloudAccountId, getSupabase } from '../cloud'
import type { RollResult } from '../dice'
import type { Character } from '../model/character'
import type { Party, PartyStash } from './types'

export const CACHE_KEY = 'ff.parties.cloud.v1'
export const PARTIES_CHANGED = 'ff:parties-changed'

interface MemberRow {
  user_id: string
  character_id: string | null
  joined_at: string
}

export interface PartyRow {
  id: string
  name: string
  code: string
  dm_id: string
  stash: PartyStash | null
  rev: number
  created_at: string
  updated_at: string
  /** Missing until the restore_party migration is on the server. */
  ended_at?: string | null
  party_members: MemberRow[]
}

const BASE_COLUMNS = 'id, name, code, dm_id, stash, rev, created_at, updated_at, party_members (user_id, character_id, joined_at)'
const PARTY_COLUMNS = `${BASE_COLUMNS}, ended_at`
/** Postgres "no such column": the server predates 20261101120000_restore_party.sql. */
const NO_COLUMN = '42703'

export function toParty(row: PartyRow): Party {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    dmId: row.dm_id,
    members: [...row.party_members]
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.user_id.localeCompare(b.user_id))
      .map(m => ({ userId: m.user_id, ...(m.character_id ? { characterId: m.character_id } : {}), joinedAt: m.joined_at })),
    ...(row.stash ? { stash: row.stash } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
  }
}

/** The client, when this player is the device's cloud account; else null and parties stay local. */
export async function cloudFor(userId: string): Promise<SupabaseClient | null> {
  return getCloudAccountId() === userId ? getSupabase() : null
}

interface Cache {
  accountId: string
  parties: Party[]
  /** Whether the server keeps ended campaigns (restore_party migration). False means End deletes them. */
  restorable?: boolean
}

function readCache(): Cache | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cache | null
  } catch {
    return null
  }
}

/** The cloud parties last fetched for this account. */
export function cachedParties(userId: string): Party[] {
  const c = readCache()
  return c?.accountId === userId ? c.parties : []
}

/** A cached cloud party by id, whoever's cache it is (the device has one cloud account). */
export const cachedParty = (id: string): Party | undefined => readCache()?.parties.find(p => p.id === id)

/** Whether ending a cloud campaign can be undone (the server keeps ended campaigns). Assumed yes until a fetch says no. */
export const cloudRestorable = (): boolean => readCache()?.restorable !== false

function writeCache(accountId: string, parties: Party[], restorable: boolean) {
  const before = readCache()
  if (before?.accountId === accountId && before.restorable === restorable && JSON.stringify(before.parties) === JSON.stringify(parties)) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ accountId, parties, restorable }))
  } catch {
    // Blocked storage; the list is fetched again next time.
  }
  window.dispatchEvent(new Event(PARTIES_CHANGED))
}

/** Fetches this account's parties and updates the cache. False when offline. */
export async function refreshParties(db: SupabaseClient, userId: string): Promise<boolean> {
  let restorable = true
  let { data, error } = await db.from('parties').select(PARTY_COLUMNS).returns<PartyRow[]>()
  if (error?.code === NO_COLUMN) {
    restorable = false
    ;({ data, error } = await db.from('parties').select(BASE_COLUMNS).returns<PartyRow[]>())
  }
  if (error || !data) return false
  writeCache(userId, data.map(toParty).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), restorable)
  return true
}

export async function fetchParty(db: SupabaseClient, id: string): Promise<{ party: Party; rev: number } | null> {
  const columns = cloudRestorable() ? PARTY_COLUMNS : BASE_COLUMNS
  const { data, error } = await db.from('parties').select(columns).eq('id', id).maybeSingle<PartyRow>()
  if (error || !data) return null
  return { party: toParty(data), rev: data.rev }
}

/** Watches the account's parties live while anyone listens; one channel shared by all listeners. */
let watchers = 0
let stopChannel: (() => void) | undefined
export function watchParties(): () => void {
  watchers++
  if (watchers === 1) {
    const me = getCloudAccountId()
    if (me) {
      getSupabase().then(db => {
        if (!db || watchers === 0 || stopChannel) return
        const refresh = () => { void refreshParties(db, me) }
        const channel = db.channel(`parties-${Math.random().toString(36).slice(2)}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'parties' }, refresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'party_members' }, refresh)
          .subscribe(status => { if (status === 'SUBSCRIBED') refresh() })
        stopChannel = () => { void db.removeChannel(channel) }
      })
    }
  }
  return () => {
    watchers--
    if (watchers === 0) {
      stopChannel?.()
      stopChannel = undefined
    }
  }
}

// ---------- What members see of each other ----------

/** Characters other members bring, read from the cloud (the server only returns those in a shared party). */
export async function fetchPartyCharacters(ids: string[]): Promise<Character[]> {
  const db = ids.length && getCloudAccountId() ? await getSupabase() : null
  if (!db) return []
  const { data, error } = await db.from('characters').select('data').in('id', ids).eq('deleted', false)
    .returns<{ data: Character }[]>()
  return error || !data ? [] : data.map(r => r.data)
}

/** Calls fn when one of these characters changes on the server (another member took damage, say). */
export function watchPartyCharacters(ids: string[], fn: () => void): () => void {
  return watchTable(ids.length ? 'characters' : null, ids.length ? `id=in.(${ids.join(',')})` : undefined, fn)
}

/** Recent rolls of these members, as the server lets this account see them (brought characters, since joining). */
export async function fetchPartyRolls(userIds: string[]): Promise<Record<string, RollResult[]>> {
  const db = userIds.length && getCloudAccountId() ? await getSupabase() : null
  if (!db) return {}
  const { data, error } = await db.from('rolls').select('owner_id, data').in('owner_id', userIds)
    .order('rolled_at', { ascending: false }).limit(100).returns<{ owner_id: string; data: RollResult }[]>()
  const out: Record<string, RollResult[]> = {}
  for (const r of error || !data ? [] : data) (out[r.owner_id] ??= []).push(r.data)
  return out
}

export function watchPartyRolls(fn: () => void): () => void {
  return watchTable('rolls', undefined, fn)
}

/** Calls fn on any change to a table this account can see (optionally filtered, e.g. party_id=eq.x). */
export function watchTable(table: string | null, filter: string | undefined, fn: () => void): () => void {
  let stop: (() => void) | undefined
  let stopped = false
  if (table && getCloudAccountId()) {
    getSupabase().then(db => {
      if (!db || stopped) return
      const channel = db.channel(`${table}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => fn())
        .subscribe()
      stop = () => { void db.removeChannel(channel) }
    })
  }
  return () => {
    stopped = true
    stop?.()
  }
}

/** Sends one roll right away, so the party feed shows it within a second. Cloud sync would send it later anyway. */
export async function sendRoll(userId: string, roll: RollResult): Promise<void> {
  const db = roll.roller?.characterId ? await cloudFor(userId) : null
  if (!db) return
  await db.from('rolls').upsert(
    { id: roll.id, owner_id: userId, character_id: roll.roller!.characterId, data: roll, rolled_at: roll.timestamp },
    { onConflict: 'id', ignoreDuplicates: true },
  )
}

/** Display names of every account, for members whose profile isn't on this device. */
export async function fetchAccountNames(): Promise<Record<string, string>> {
  const db = getCloudAccountId() ? await getSupabase() : null
  if (!db) return {}
  const { data } = await db.from('accounts').select('id, name').returns<{ id: string; name: string }[]>()
  return Object.fromEntries((data ?? []).map(a => [a.id, a.name]))
}

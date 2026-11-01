// Party store. For the account this device is signed in to, parties live in Supabase (cloud.ts) and
// work across devices, live. Local profiles ("this device only") and devices without the cloud keep
// parties in localStorage, shared between profiles on one device, as before.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCloudAccountId, getSupabase, isCloudEnabled } from '../cloud'
import { CACHE_KEY, cachedParties, cachedParty, cloudFor, cloudRestorable, fetchParty, PARTIES_CHANGED, refreshParties, watchParties } from './cloud'
import { addMember, isMember, isValidCode, makeInviteCode, normalizeCode, removeMember, setMemberCharacter } from './code'
import { canEndParty, canRestoreParty, endedParties, runningParties } from './active'
import { applyStash, type StashAction, type StashResult } from './stash'
import type { Party } from './types'

const KEY = 'ff.parties.v1'
const CHANGED = PARTIES_CHANGED

function readParties(): Party[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? (list as Party[]) : []
  } catch {
    return []
  }
}

function writeParties(list: Party[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked; nothing else to do offline.
  }
  window.dispatchEvent(new Event(CHANGED))
}

function update(id: string, change: (p: Party) => Party | null): Party | null {
  const list = readParties()
  const i = list.findIndex(p => p.id === id)
  if (i < 0) return null
  const next = change(list[i])
  if (next) list[i] = next
  else list.splice(i, 1)
  writeParties(list)
  return next
}

/** A Postgres error code means the server refused; no code means the connection failed. */
const offline = (error: { code?: string } | null) => !!error && !error.code

/**
 * For modules that share a party's data (hand-outs, polls, secret rolls): the cloud client when this
 * is a cloud party and the device is signed in, else null and the module keeps its data on the device.
 */
export async function cloudForParty(partyId: string): Promise<SupabaseClient | null> {
  if (readParties().some(p => p.id === partyId) || !getCloudAccountId()) return null
  return getSupabase()
}

/** The cloud client when this party is a cloud one this player can reach, else null (local party). */
async function cloudParty(partyId: string, userId: string): Promise<SupabaseClient | null> {
  if (readParties().some(p => p.id === partyId)) return null
  return cloudFor(userId)
}

/** Every campaign this player is in, running or ended. */
async function allParties(userId: string): Promise<Party[]> {
  const local = readParties().filter(p => isMember(p, userId))
  const db = await cloudFor(userId)
  if (!db) return local
  // Shows the cached list now; a fresh fetch fires onPartiesChanged if anything changed.
  void refreshParties(db, userId)
  return [...cachedParties(userId), ...local]
}

/** The campaigns this player is in that are still running. */
export async function listParties(userId: string): Promise<Party[]> {
  return runningParties(await allParties(userId))
}

/** The campaigns this player was in that their DM ended, most recently ended first. */
export async function listEndedParties(userId: string): Promise<Party[]> {
  return endedParties(await allParties(userId))
}

/** Whether ending this campaign can be undone. Device campaigns always; cloud ones once the server keeps ended campaigns. */
export function canUndoEnd(partyId: string): boolean {
  return readParties().some(p => p.id === partyId) || cloudRestorable()
}

export async function getParty(id: string): Promise<Party | undefined> {
  const local = readParties().find(p => p.id === id)
  if (local) return local
  return cachedParty(id)
}

function createLocal(name: string, creatorId: string, dmId: string): Party {
  const list = readParties()
  const taken = new Set(list.map(p => p.code))
  let code = makeInviteCode()
  while (taken.has(code)) code = makeInviteCode()
  const now = new Date().toISOString()
  const members = [creatorId, dmId].filter((id, i, all) => all.indexOf(id) === i).map(userId => ({ userId, joinedAt: now }))
  const party: Party = { id: crypto.randomUUID(), name, code, dmId, members, createdAt: now, updatedAt: now }
  writeParties([...list, party])
  return party
}

/** Makes a party with its DM: the creator or another player. Both join it; everyone else joins by code. */
export async function createParty(name: string, creatorId: string, dmId: string = creatorId): Promise<Party> {
  const db = await cloudFor(creatorId)
  if (db) {
    for (let tries = 0; tries < 5; tries++) {
      const id = crypto.randomUUID()
      const { error } = await db.rpc('create_party', { p_id: id, p_name: name.slice(0, 80), p_code: makeInviteCode(), p_dm: dmId })
      if (error?.code === '23505') continue // Code taken: try another.
      if (error) break
      await refreshParties(db, creatorId)
      const made = cachedParties(creatorId).find(p => p.id === id)
      if (made) return made
    }
  }
  // No cloud, or it failed: a party on this device.
  return createLocal(name, creatorId, dmId)
}

export type JoinResult = { ok: true; party: Party } | { ok: false; reason: 'invalid' | 'not-found' | 'offline' | 'tooMany' | 'notLinked' | 'ended' }

export async function joinParty(rawCode: string, userId: string, characterId?: string): Promise<JoinResult> {
  const code = normalizeCode(rawCode)
  if (!isValidCode(code)) return { ok: false, reason: 'invalid' }
  const found = readParties().find(p => p.code === code)
  if (found?.endedAt) return { ok: false, reason: 'ended' }
  if (found) return { ok: true, party: update(found.id, p => addMember(p, userId, characterId))! }
  // Already in it (the DM, or joined before): just open it.
  const mine = cachedParties(userId).find(p => p.code === code)
  if (mine) return mine.endedAt ? { ok: false, reason: 'ended' } : { ok: true, party: mine }
  const db = await cloudFor(userId)
  // Cloud campaigns need this player signed in to the cloud on this device; without that the
  // server is never asked, so "no such code" would be wrong.
  if (!db) return { ok: false, reason: isCloudEnabled() && getCloudAccountId() !== userId ? 'notLinked' : 'not-found' }
  const { data, error } = await db.rpc('join_party', { p_code: code, p_character: characterId ?? null })
  if (error) {
    const reason = offline(error) ? 'offline' : /too many/.test(error.message) ? 'tooMany' : /campaign ended/.test(error.message) ? 'ended' : 'not-found'
    return { ok: false, reason }
  }
  if (!data) return { ok: false, reason: 'not-found' }
  await refreshParties(db, userId)
  const party = cachedParties(userId).find(p => p.id === data)
  if (party?.endedAt) return { ok: false, reason: 'ended' }
  return party ? { ok: true, party } : { ok: false, reason: 'offline' }
}

export async function chooseCharacter(partyId: string, userId: string, characterId: string | undefined): Promise<void> {
  const db = await cloudParty(partyId, userId)
  if (!db) { update(partyId, p => setMemberCharacter(p, userId, characterId)); return }
  await db.from('party_members').update({ character_id: characterId ?? null }).eq('party_id', partyId).eq('user_id', userId)
  await refreshParties(db, userId)
}

export async function leaveParty(partyId: string, userId: string): Promise<void> {
  const db = await cloudParty(partyId, userId)
  if (!db) { update(partyId, p => removeMember(p, userId)); return }
  await db.rpc('leave_party', { p_party: partyId })
  await refreshParties(db, userId)
}

/** Ends the campaign for everyone: only its DM (or the admin) can. It leaves every list but Ended campaigns,
 *  keeping everything, so restoreParty() brings it back as it was. Characters stay with their players.
 *  (On a server without the restore_party migration, end_party still deletes it: see canUndoEnd.) */
export async function endParty(partyId: string, userId: string): Promise<boolean> {
  const db = await cloudParty(partyId, userId)
  if (!db) {
    const found = readParties().find(p => p.id === partyId)
    if (!found || !canEndParty(found, userId)) return false
    update(partyId, p => ({ ...p, endedAt: p.endedAt ?? new Date().toISOString() }))
    return true
  }
  const { error } = await db.rpc('end_party', { p_party: partyId })
  await refreshParties(db, userId)
  return !error
}

/** Brings an ended campaign back for everyone, with its members, stash, lore and invite code as they were. */
export async function restoreParty(partyId: string, userId: string): Promise<boolean> {
  const db = await cloudParty(partyId, userId)
  if (!db) {
    const found = readParties().find(p => p.id === partyId)
    if (!found || !canRestoreParty(found, userId)) return false
    update(partyId, p => { const next = { ...p }; delete next.endedAt; return next })
    return true
  }
  const { error } = await db.rpc('restore_party', { p_party: partyId })
  await refreshParties(db, userId)
  return !error
}

/** Deletes an ended campaign for good. Characters stay with their players. */
export async function deleteParty(partyId: string, userId: string): Promise<boolean> {
  const db = await cloudParty(partyId, userId)
  if (!db) {
    const found = readParties().find(p => p.id === partyId)
    if (!found || !canRestoreParty(found, userId)) return false
    update(partyId, () => null)
    return true
  }
  const { error } = await db.rpc('delete_party', { p_party: partyId })
  await refreshParties(db, userId)
  return !error
}

/** Changes the party's shared inventory or gold. Only members can, and every change is logged. */
export async function updateStash(partyId: string, userId: string, action: StashAction): Promise<StashResult> {
  const db = await cloudParty(partyId, userId)
  if (!db) {
    const found = readParties().find(p => p.id === partyId)
    if (!found || !isMember(found, userId)) return { ok: false, reason: "You're not in this party." }
    const res = applyStash(found, userId, action)
    if (res.ok && res.party !== found) update(partyId, () => res.party)
    return res
  }
  // Read, change, write only if nobody else wrote in between; else read again.
  for (let tries = 0; tries < 4; tries++) {
    const fresh = await fetchParty(db, partyId)
    if (!fresh) return { ok: false, reason: "Can't reach the party right now. Try again when you're online." }
    if (!isMember(fresh.party, userId)) return { ok: false, reason: "You're not in this party." }
    const res = applyStash(fresh.party, userId, action)
    if (!res.ok || res.party === fresh.party) return res
    const { data, error } = await db.from('parties').update({ stash: res.party.stash, rev: fresh.rev + 1 })
      .eq('id', partyId).eq('rev', fresh.rev).select('id')
    if (error) return { ok: false, reason: "Can't reach the party right now. Try again when you're online." }
    if (data?.length) {
      await refreshParties(db, userId)
      return res
    }
  }
  return { ok: false, reason: 'Someone else changed the stash at the same time. Try again.' }
}

/** Calls fn whenever parties change, in this tab, another one, or (cloud parties) on another device. Returns an unsubscribe function. */
export function onPartiesChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === KEY || e.key === CACHE_KEY) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  const unwatch = watchParties()
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
    unwatch()
  }
}

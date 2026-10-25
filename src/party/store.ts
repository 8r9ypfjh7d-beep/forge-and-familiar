// Party store. Async like src/storage so a hosted backend can replace localStorage
// without changing callers. Until then, parties are shared between profiles on one device.
import { addMember, isMember, isValidCode, makeInviteCode, normalizeCode, removeMember, setMemberCharacter } from './code'
import { applyStash, type StashAction, type StashResult } from './stash'
import type { Party } from './types'

const KEY = 'ff.parties.v1'
const CHANGED = 'ff:parties-changed'

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

export async function listParties(userId: string): Promise<Party[]> {
  return readParties().filter(p => isMember(p, userId))
}

export async function getParty(id: string): Promise<Party | undefined> {
  return readParties().find(p => p.id === id)
}

export async function createParty(name: string, dmId: string): Promise<Party> {
  const list = readParties()
  const taken = new Set(list.map(p => p.code))
  let code = makeInviteCode()
  while (taken.has(code)) code = makeInviteCode()
  const now = new Date().toISOString()
  const party: Party = { id: crypto.randomUUID(), name, code, dmId, members: [{ userId: dmId, joinedAt: now }], createdAt: now, updatedAt: now }
  writeParties([...list, party])
  return party
}

export type JoinResult = { ok: true; party: Party } | { ok: false; reason: 'invalid' | 'not-found' }

export async function joinParty(rawCode: string, userId: string, characterId?: string): Promise<JoinResult> {
  const code = normalizeCode(rawCode)
  if (!isValidCode(code)) return { ok: false, reason: 'invalid' }
  const found = readParties().find(p => p.code === code)
  if (!found) return { ok: false, reason: 'not-found' }
  const party = update(found.id, p => addMember(p, userId, characterId))!
  return { ok: true, party }
}

export async function chooseCharacter(partyId: string, userId: string, characterId: string | undefined): Promise<void> {
  update(partyId, p => setMemberCharacter(p, userId, characterId))
}

export async function leaveParty(partyId: string, userId: string): Promise<void> {
  update(partyId, p => removeMember(p, userId))
}

/** Changes the party's shared inventory or gold. Only members can, and every change is logged. */
export async function updateStash(partyId: string, userId: string, action: StashAction): Promise<StashResult> {
  const found = readParties().find(p => p.id === partyId)
  if (!found || !isMember(found, userId)) return { ok: false, reason: "You're not in this party." }
  const res = applyStash(found, userId, action)
  if (res.ok && res.party !== found) update(partyId, () => res.party)
  return res
}

/** Calls fn whenever parties change, in this tab or another one. Returns an unsubscribe function. */
export function onPartiesChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}

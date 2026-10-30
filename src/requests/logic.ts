// Pure request rules: create, validate, decide, sort for each side, merge links, grant to a character.
import { addItem } from '../inventory/inventory'
import type { Character, CustomAction } from '../model/character'
import type { Ability, ItemEffect } from '../rules/types'
import { sanitizeEffect } from '../rules/itemEffects'
import type { DmRequest, RequestKind, RequestStatus } from './types'

export interface RequestInput {
  fromId: string
  fromName: string
  characterId: string
  characterName: string
  kind: RequestKind
  title: string
  details: string
  roll?: CustomAction['roll']
  extraDamage?: DmRequest['extraDamage']
  stats?: ItemEffect[]
}

export type RequestProblem = 'noCharacter' | 'noTitle'

export const TITLE_MAX = 80
export const DETAILS_MAX = 600

export function problems(input: Pick<RequestInput, 'characterId' | 'title'>): RequestProblem[] {
  const out: RequestProblem[] = []
  if (!input.characterId) out.push('noCharacter')
  if (!input.title.trim()) out.push('noTitle')
  return out
}

export function newRequest(input: RequestInput, id: string, now: string): DmRequest {
  const { roll, extraDamage, stats, ...rest } = input
  return {
    ...rest,
    id,
    title: input.title.trim().slice(0, TITLE_MAX),
    details: input.details.trim().slice(0, DETAILS_MAX),
    ...mechanics({ roll, extraDamage, stats }),
    createdAt: now,
    status: 'pending',
  }
}

type Mechanics = Pick<DmRequest, 'roll' | 'extraDamage' | 'stats'>

/** Keeps only the parts that say something: a roll with dice or a check, extra damage with dice, any stat change. */
export function mechanics(m: Mechanics): Mechanics {
  const out: Mechanics = {}
  const r = m.roll
  if (r && (r.check || r.dice?.trim())) {
    out.roll = {
      ...(r.check ? { check: r.check, ...(r.ability ? { ability: r.ability } : {}) } : {}),
      ...(r.check === 'save' && r.save ? { save: r.save } : {}),
      ...(r.dice?.trim() ? { dice: r.dice.trim() } : {}),
      ...(r.dice?.trim() && r.type?.trim() ? { type: r.type.trim() } : {}),
    }
  }
  if (m.extraDamage?.damage.trim()) {
    out.extraDamage = { damage: m.extraDamage.damage.trim(), ...(m.extraDamage.type?.trim() ? { type: m.extraDamage.type.trim() } : {}) }
  }
  if (m.stats?.length) out.stats = m.stats.map(f => ({ ...f }))
  return out
}

export const hasMechanics = (r: Mechanics) => !!(r.roll || r.extraDamage || r.stats?.length)

export type Decision = Exclude<RequestStatus, 'pending'>

/** The DM's answer. Going back to pending clears it. */
export function decide(list: DmRequest[], id: string, status: RequestStatus, now: string, reply?: string): DmRequest[] {
  return list.map(r => {
    if (r.id !== id) return r
    if (status === 'pending') {
      const { reply: _r, decidedAt: _d, ...rest } = r
      return { ...rest, status }
    }
    const text = (reply ?? r.reply ?? '').trim()
    return { ...r, status, decidedAt: now, ...(text ? { reply: text } : { reply: undefined }) }
  })
}

export const setStoryNote = (list: DmRequest[], id: string, note: string): DmRequest[] =>
  list.map(r => (r.id === id ? { ...r, storyNote: note } : r))

export const removeRequest = (list: DmRequest[], id: string): DmRequest[] => list.filter(r => r.id !== id)

const oldestFirst = (a: DmRequest, b: DmRequest) => a.createdAt.localeCompare(b.createdAt)
const newestFirst = (a: DmRequest, b: DmRequest) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt)

/** DM: waiting for an answer, oldest first. */
export const inbox = (list: DmRequest[]) => list.filter(r => r.status === 'pending').sort(oldestFirst)
/** DM: approved for later in the story; these are the reminders. */
export const reminders = (list: DmRequest[]) => list.filter(r => r.status === 'later').sort(oldestFirst)
/** DM: granted or denied, newest first. */
export const answered = (list: DmRequest[]) => list.filter(r => r.status === 'granted' || r.status === 'denied').sort(newestFirst)
/** Player: their own requests, newest first. */
export const mine = (list: DmRequest[], userId: string) => list.filter(r => r.fromId === userId).sort(newestFirst)

/** Player: granted requests not yet added to their character. Edits are used in the builder instead. */
export const pendingGrants = (list: DmRequest[], userId: string) =>
  list.filter(r => r.fromId === userId && r.kind !== 'edit' && r.status === 'granted' && !r.applied)

// ---------- Edit permission ----------

export type EditState = 'none' | 'pending' | 'approved'

const editsFor = (list: DmRequest[], userId: string, characterId: string) =>
  list.filter(r => r.kind === 'edit' && r.fromId === userId && r.characterId === characterId)

/** Player: whether they may edit this character now (one approved, unused edit), are waiting, or must ask. */
export function editState(list: DmRequest[], userId: string, characterId: string): EditState {
  const own = editsFor(list, userId, characterId)
  if (own.some(r => r.status === 'granted' && !r.applied)) return 'approved'
  if (own.some(r => r.status === 'pending')) return 'pending'
  return 'none'
}

/** The player's open edit request for this character, if any. */
export const openEditRequest = (list: DmRequest[], userId: string, characterId: string) =>
  editsFor(list, userId, characterId).find(r => r.status === 'pending')

/** Saving an approved edit uses it up; the next edit needs a new OK. */
export const spendEditPass = (list: DmRequest[], userId: string, characterId: string): DmRequest[] => {
  const pass = editsFor(list, userId, characterId).find(r => r.status === 'granted' && !r.applied)
  return pass ? markApplied(list, [pass.id]) : list
}

export function newEditRequest(
  input: Pick<RequestInput, 'fromId' | 'fromName' | 'characterId' | 'characterName' | 'details'>, id: string, now: string,
): DmRequest {
  return newRequest({ ...input, kind: 'edit', title: input.characterName || '?' }, id, now)
}

export const markApplied = (list: DmRequest[], ids: string[]): DmRequest[] =>
  list.map(r => (ids.includes(r.id) ? { ...r, applied: true } : r))

/**
 * Adds a granted request to the character: an item goes in the inventory, an effect or ability
 * becomes a custom action on the combat page (switchable under Effects), anything else goes in the notes.
 */
export function grantToCharacter(c: Character, r: DmRequest, uid: string): Character {
  if (r.kind === 'edit') return c
  const details = r.details.trim()
  const extra = r.extraDamage ? [r.extraDamage.damage, r.extraDamage.type].filter(Boolean).join(' ') : ''
  const action = (kind: CustomAction['kind'], withEffects: boolean): CustomAction => ({
    id: uid, kind, name: r.title,
    ...(details ? { description: details } : {}),
    ...(r.roll ? { roll: { ...r.roll } } : {}),
    ...(withEffects && r.extraDamage ? { effect: { ...r.extraDamage } } : {}),
    ...(withEffects && r.stats?.length ? { stats: r.stats.map(f => ({ ...f })) } : {}),
  })
  const addAction = (ch: Character, a: CustomAction): Character => ({ ...ch, customActions: [...(ch.customActions ?? []), a] })
  if (r.kind === 'item') {
    const withItem = addItem(c, {
      itemId: `custom:${uid}`,
      item: { kind: 'gear', id: 'custom', name: r.title, weight: 0 },
      ...(details ? { notes: details } : {}),
      ...(extra ? { extraDamage: extra } : {}),
      ...(r.stats?.length ? { effects: r.stats.map(f => ({ ...f })) } : {}),
    }).character
    // The item's stat changes and extra damage work while it is equipped; its roll becomes an action.
    return r.roll ? addAction(withItem, action('action', false)) : withItem
  }
  if (r.kind === 'effect' || r.kind === 'ability' || hasMechanics(r)) return addAction(c, action('other', true))
  const line = details ? `${r.title}: ${details}` : r.title
  return { ...c, notes: c.notes.trim() ? `${c.notes.trimEnd()}\n\n${line}` : line }
}

// ---------- Links between devices ----------

/** What a link carries: a new request (player to DM) or the DM's answer (DM to player). */
export type Shared = { type: 'request' | 'answer'; request: DmRequest }

export const LINK_PARAM = 'ff-request'

/** Strips what the other side must not get: the DM's story note and this device's applied flag. */
export function forSharing(type: Shared['type'], r: DmRequest): DmRequest {
  const { storyNote: _s, applied: _a, ...rest } = r
  if (type === 'answer') return rest
  const { reply: _r, decidedAt: _d, ...request } = rest
  return { ...request, status: 'pending' }
}

const toBase64Url = (text: string) => {
  let bin = ''
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (code: string) => {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)))
}

export function encodeShared(type: Shared['type'], r: DmRequest): string {
  const req = forSharing(type, r)
  return toBase64Url(JSON.stringify({ v: 1, t: type === 'request' ? 'q' : 'a', r: req }))
}

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function readMechanics(r: Record<string, unknown>): Mechanics {
  const roll = r.roll as Record<string, unknown> | undefined
  const extra = r.extraDamage as Record<string, unknown> | undefined
  const stats = Array.isArray(r.stats) ? (r.stats as Record<string, unknown>[]).slice(0, 12) : []
  const ability = (v: unknown) => (ABILITIES.includes(v as Ability) ? (v as Ability) : undefined)
  return mechanics({
    roll: roll && typeof roll === 'object' ? {
      check: roll.check === 'attack' || roll.check === 'save' ? roll.check : undefined,
      ability: ability(roll.ability),
      save: ability(roll.save),
      dice: str(roll.dice, 40),
      type: str(roll.type, 30),
    } : undefined,
    extraDamage: extra && typeof extra === 'object' ? { damage: str(extra.damage, 40), type: str(extra.type, 30) } : undefined,
    stats: stats.flatMap(f => sanitizeEffect(f) ?? []),
  })
}

const STATUSES: RequestStatus[] = ['pending', 'later', 'granted', 'denied']
const KINDS: RequestKind[] = ['item', 'effect', 'ability', 'other', 'edit']
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Reads a code from a link. Returns null for anything that isn't a well-formed request. */
export function decodeShared(code: string): Shared | null {
  try {
    const raw = JSON.parse(fromBase64Url(code.trim()))
    if (raw?.v !== 1 || (raw.t !== 'q' && raw.t !== 'a')) return null
    const r = raw.r ?? {}
    const request: DmRequest = {
      id: str(r.id, 64),
      fromId: str(r.fromId, 64),
      fromName: str(r.fromName, 60),
      characterId: str(r.characterId, 64),
      characterName: str(r.characterName, 80),
      kind: KINDS.includes(r.kind) ? r.kind : 'other',
      title: str(r.title, TITLE_MAX),
      details: str(r.details, DETAILS_MAX),
      ...readMechanics(r),
      createdAt: str(r.createdAt, 40),
      status: STATUSES.includes(r.status) ? r.status : 'pending',
      ...(typeof r.reply === 'string' && r.reply ? { reply: str(r.reply, DETAILS_MAX) } : {}),
      ...(typeof r.decidedAt === 'string' ? { decidedAt: str(r.decidedAt, 40) } : {}),
    }
    if (!request.id || !request.fromId || !request.title) return null
    const type = raw.t === 'q' ? 'request' : 'answer'
    return { type, request: type === 'request' ? { ...request, status: 'pending' } : request }
  } catch {
    return null
  }
}

/** Finds the code in a pasted link, a page hash, or a bare code. */
export function codeFrom(text: string): string | null {
  const m = new RegExp(`${LINK_PARAM}=([A-Za-z0-9_-]+)`).exec(text)
  if (m) return m[1]
  const bare = text.trim()
  return /^[A-Za-z0-9_-]{20,}$/.test(bare) ? bare : null
}

export const linkFor = (base: string, type: Shared['type'], r: DmRequest) => `${base}#${LINK_PARAM}=${encodeShared(type, r)}`

export type MergeOutcome = 'added' | 'updated' | 'same' | 'older'

/**
 * Takes a request or answer from a link into this device's list.
 * A request never overwrites one already here (the DM may have answered it). An answer
 * replaces the status and reply unless this device already has a newer answer.
 */
export function mergeShared(list: DmRequest[], s: Shared): { list: DmRequest[]; outcome: MergeOutcome } {
  const here = list.find(r => r.id === s.request.id)
  if (!here) return { list: [...list, s.request], outcome: 'added' }
  if (s.type === 'request') return { list, outcome: 'same' }
  if (here.status === s.request.status && here.reply === s.request.reply && here.decidedAt === s.request.decidedAt) return { list, outcome: 'same' }
  if (here.decidedAt && s.request.decidedAt && here.decidedAt > s.request.decidedAt) return { list, outcome: 'older' }
  const next = list.map(r => {
    if (r.id !== s.request.id) return r
    const { reply: _r, decidedAt: _d, ...rest } = r
    return {
      ...rest,
      status: s.request.status,
      ...(s.request.reply ? { reply: s.request.reply } : {}),
      ...(s.request.decidedAt ? { decidedAt: s.request.decidedAt } : {}),
    }
  })
  return { list: next, outcome: 'updated' }
}

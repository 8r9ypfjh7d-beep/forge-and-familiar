// Pure rules for keeping this device's request list in step with the dm_requests table.
// The local list stays the source the screens read; cloud.ts pushes local changes and merges rows back.
import type { DmRequest, RequestStatus } from './types'

/** A dm_requests row (supabase/migrations/20261027100000_dm_requests.sql). */
export interface RequestRow {
  id: string
  from_id: string
  character_id: string
  data: RequestData
  status: RequestStatus
  reply: string | null
  decided_at: string | null
  applied: boolean
}

/** The request itself, without the columns and without what stays on one device. */
export type RequestData = Omit<DmRequest, 'id' | 'fromId' | 'characterId' | 'status' | 'reply' | 'decidedAt' | 'applied' | 'storyNote'>

/**
 * Bookkeeping kept next to the list (ff.requests.sync.v1).
 * known: ids the server had at the last pull or push. dirty: changed here, not sent yet.
 * gone: removed here, to delete on the server (the server decides if this device may).
 * hidden: removed here; the next pulls skip them, so clearing an answer doesn't bring it back.
 * seeded: the account whose first sync already sent this device's older requests.
 */
export interface SyncState {
  known: string[]
  dirty: string[]
  gone: string[]
  hidden: string[]
  seeded?: string
}

export const emptySync = (): SyncState => ({ known: [], dirty: [], gone: [], hidden: [] })

export function toRow(r: DmRequest): RequestRow {
  const { id, fromId, characterId, status, reply, decidedAt, applied, storyNote: _s, ...data } = r
  return { id, from_id: fromId, character_id: characterId, data, status, reply: reply ?? null, decided_at: decidedAt ?? null, applied: !!applied }
}

export function fromRow(row: RequestRow): DmRequest {
  return {
    ...row.data,
    id: row.id,
    fromId: row.from_id,
    characterId: row.character_id,
    status: row.status,
    ...(row.reply ? { reply: row.reply } : {}),
    ...(row.decided_at ? { decidedAt: row.decided_at } : {}),
    ...(row.applied ? { applied: true } : {}),
  }
}

const add = (ids: string[], more: string[]) => [...new Set([...ids, ...more])]

/** Records a local save: changed or new requests become dirty, removed ones gone and hidden. */
export function noteLocalChange(prev: DmRequest[], next: DmRequest[], s: SyncState): SyncState {
  const before = new Map(prev.map(r => [r.id, JSON.stringify(r)]))
  const changed = next.filter(r => before.get(r.id) !== JSON.stringify(r)).map(r => r.id)
  const kept = new Set(next.map(r => r.id))
  const removed = prev.filter(r => !kept.has(r.id)).map(r => r.id)
  if (!changed.length && !removed.length) return s
  return {
    ...s,
    dirty: add(s.dirty.filter(id => !removed.includes(id)), changed),
    gone: add(s.gone, removed.filter(id => s.known.includes(id))),
    hidden: add(s.hidden, removed),
  }
}

/** The DM's answer: from the server, or this device's when it is newer (an answer link the server hasn't seen). */
function answerOf(here: DmRequest, server: DmRequest, synced: boolean): Pick<DmRequest, 'status' | 'reply' | 'decidedAt'> {
  const pick = (r: DmRequest) => ({ status: r.status, ...(r.reply ? { reply: r.reply } : {}), ...(r.decidedAt ? { decidedAt: r.decidedAt } : {}) })
  if (synced || !here.decidedAt) return pick(server)
  return server.decidedAt && server.decidedAt >= here.decidedAt ? pick(server) : pick(here)
}

/**
 * Merges a full pull of the rows this account can see into the local list. Dirty requests keep
 * their local copy (they are sent next). Requests the server no longer has are dropped, unless
 * they never reached it. The DM's story note stays; applied is never undone.
 */
export function mergeRows(list: DmRequest[], rows: RequestRow[], s: SyncState): { list: DmRequest[]; sync: SyncState } {
  const server = new Map(rows.map(r => [r.id, fromRow(r)]))
  const hidden = new Set(s.hidden)
  const dirty = new Set(s.dirty)
  const known = new Set(s.known)
  const out: DmRequest[] = []
  for (const here of list) {
    const there = server.get(here.id)
    if (!there) {
      if (dirty.has(here.id) || !known.has(here.id)) out.push(here)
      continue
    }
    if (dirty.has(here.id)) { out.push(here); continue }
    const { reply: _r, decidedAt: _d, ...base } = there
    out.push({
      ...base,
      ...answerOf(here, there, known.has(here.id)),
      ...(here.storyNote ? { storyNote: here.storyNote } : {}),
      ...(here.applied || there.applied ? { applied: true } : {}),
    })
  }
  const local = new Set(list.map(r => r.id))
  for (const [id, r] of server) if (!local.has(id) && !hidden.has(id)) out.push(r)
  return {
    list: out,
    sync: { ...s, known: [...server.keys()], hidden: s.hidden.filter(id => server.has(id) || s.gone.includes(id)) },
  }
}

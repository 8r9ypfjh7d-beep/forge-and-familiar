// Live delivery of requests and answers through the dm_requests table. Sends what changed on this
// device, pulls what this account may see, and pulls again on every realtime change. Offline or
// without a cloud sign-in it does nothing, and the share links keep working.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCloudAccountId, getSupabase, onCloudChanged } from '../cloud'
import { listRequests, mergeFromCloud, onRequestsChanged, readSync, writeSync } from './store'
import { mergeRows, toRow, type RequestRow } from './sync'

const TABLE = 'dm_requests'
const DELIVERED = 'ff:requests-delivered'

/** A database refusal (bad row, not allowed) won't change on retry; a dropped connection will. */
const permanent = (error: { code?: string } | null) => !!error?.code

/** Sends dirty requests and deletions. Returns false when the connection failed. */
export async function pushRequests(db: SupabaseClient, me: string): Promise<boolean> {
  const s = readSync()
  if (s.seeded !== me) {
    // First sync for this account: send everything this device already had.
    writeSync({ ...s, seeded: me, dirty: [...new Set([...s.dirty, ...(await listRequests()).map(r => r.id)])] })
  }
  const list = await listRequests()
  let ok = true
  const sent: string[] = []
  const dropped: string[] = []
  for (const id of readSync().dirty) {
    const r = list.find(x => x.id === id)
    if (!r) { dropped.push(id); continue }
    const row = toRow(r)
    // Someone else's request (the DM answering): only an update, and only if the server has it.
    // One that came by link and never reached the server stays on this device.
    const { data, error } = r.fromId === me
      ? await db.from(TABLE).upsert(row).select('id')
      : await db.from(TABLE).update({ status: row.status, reply: row.reply, decided_at: row.decided_at }).eq('id', id).select('id')
    if (!error) (data?.length ? sent : dropped).push(id)
    else if (permanent(error)) dropped.push(id)
    else { ok = false; break }
  }
  const deleted: string[] = []
  for (const id of ok ? readSync().gone : []) {
    const { error } = await db.from(TABLE).delete().eq('id', id)
    if (error && !permanent(error)) { ok = false; break }
    deleted.push(id)
  }
  const after = readSync()
  // A request changed again while it was being sent stays dirty: compare against what was sent.
  const now = await listRequests()
  const same = (id: string) => JSON.stringify(now.find(x => x.id === id)) === JSON.stringify(list.find(x => x.id === id))
  const done = [...sent, ...dropped].filter(same)
  writeSync({
    ...after,
    dirty: after.dirty.filter(id => !done.includes(id)),
    gone: after.gone.filter(id => !deleted.includes(id)),
    known: [...new Set([...after.known, ...sent])],
  })
  if (sent.length) window.dispatchEvent(new Event(DELIVERED))
  return ok
}

/** Reads every request this account can see and merges it into the local list. */
export async function pullRequests(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.from(TABLE).select('id, from_id, character_id, data, status, reply, decided_at, applied')
  if (error || !data) return false
  mergeFromCloud((list, s) => mergeRows(list, data as RequestRow[], s))
  window.dispatchEvent(new Event(DELIVERED))
  return true
}

/** True when the server has this request as it is here: the other side gets it without a link. */
export function isDelivered(id: string): boolean {
  if (!getCloudAccountId()) return false
  const s = readSync()
  return s.known.includes(id) && !s.dirty.includes(id)
}

export function onDeliveryChanged(fn: () => void): () => void {
  window.addEventListener(DELIVERED, fn)
  const off = onRequestsChanged(fn)
  return () => {
    window.removeEventListener(DELIVERED, fn)
    off()
  }
}

/**
 * Keeps requests live while the app is open: push and pull on start, push after each local change,
 * pull on each realtime change, and both again when the device comes back online or to the front.
 * Restarts when the cloud sign-in changes. Returns a stop function.
 */
export function startRequestsCloud(): () => void {
  let stopped = false
  let stopLive: (() => void) | undefined
  let busy: Promise<void> = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined

  const run = (pull: boolean) => {
    busy = busy.then(async () => {
      const me = getCloudAccountId()
      const db = me && !stopped && navigator.onLine !== false ? await getSupabase() : null
      if (!db || !me) return
      try {
        if (await pushRequests(db, me) && pull) await pullRequests(db)
      } catch {
        // Offline mid-way; the next change or reconnect tries again.
      }
    })
  }
  const soon = (pull: boolean) => {
    clearTimeout(timer)
    timer = setTimeout(() => run(pull), 300)
  }

  const subscribe = async () => {
    stopLive?.()
    stopLive = undefined
    const db = getCloudAccountId() ? await getSupabase() : null
    if (!db || stopped) return
    const channel = db.channel(`requests-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => soon(true))
      .subscribe(status => { if (status === 'SUBSCRIBED') soon(true) })
    stopLive = () => { db.removeChannel(channel) }
  }

  const onLocal = () => { if (readSync().dirty.length || readSync().gone.length) soon(false) }
  const onBack = () => { if (document.visibilityState !== 'hidden') soon(true) }
  const onCloud = () => { subscribe(); soon(true) }

  const offLocal = onRequestsChanged(onLocal)
  const offCloud = onCloudChanged(onCloud)
  window.addEventListener('online', onBack)
  document.addEventListener('visibilitychange', onBack)
  onCloud()

  return () => {
    stopped = true
    clearTimeout(timer)
    stopLive?.()
    offLocal()
    offCloud()
    window.removeEventListener('online', onBack)
    document.removeEventListener('visibilitychange', onBack)
  }
}

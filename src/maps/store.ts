// Map store: the DM's maps cached on the device (`ff.maps.v1.<ownerId>`) and mirrored one row per map to
// Supabase `dm_maps` when this device is signed in as that account (or the admin). Newer `updatedAt` wins on both
// sides; a delete removes the row. Pictures stay inside the map's JSON, so a map with a photo is a few hundred KB.
import { isAdmin } from '../accounts/roster'
import { getCloudAccountId, getSupabase } from '../cloud'
import { watchTable } from '../party/cloud'
import { normalizeMap, sortMaps } from './logic'
import type { BattleMapDef } from './types'

const key = (ownerId: string) => `ff.maps.v1.${ownerId}`
/** Map ids this device changed or deleted since the server last got them. */
const pendingKey = (ownerId: string) => `ff.maps.pending.v1.${ownerId}`
const PUSH_DELAY = 800

/** Thrown by saveMap when the device cannot hold the map (a picture too big for localStorage). */
export class MapSpaceError extends Error {}

function readLocal(ownerId: string): BattleMapDef[] {
  try {
    const list = JSON.parse(localStorage.getItem(key(ownerId)) ?? '[]')
    return Array.isArray(list) ? list.flatMap(m => { const n = normalizeMap(m); return n ? [n] : [] }) : []
  } catch {
    return []
  }
}

function writeLocal(ownerId: string, maps: BattleMapDef[]) {
  localStorage.setItem(key(ownerId), JSON.stringify(maps))
}

type Pending = Record<string, 'save' | 'delete'>
function readPending(ownerId: string): Pending {
  try { return JSON.parse(localStorage.getItem(pendingKey(ownerId)) ?? '{}') } catch { return {} }
}
function writePending(ownerId: string, p: Pending) {
  try {
    if (Object.keys(p).length) localStorage.setItem(pendingKey(ownerId), JSON.stringify(p))
    else localStorage.removeItem(pendingKey(ownerId))
  } catch { /* storage blocked */ }
}

/** The server can hold this profile's maps: its own account, or any account for the admin. */
function syncs(ownerId: string): boolean {
  const me = getCloudAccountId()
  return !!me && (me === ownerId || isAdmin(me))
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

async function push(ownerId: string): Promise<void> {
  const supabase = await getSupabase()
  if (!supabase || !syncs(ownerId)) return
  const pending = readPending(ownerId)
  const maps = readLocal(ownerId)
  for (const [id, what] of Object.entries(pending)) {
    try {
      const map = maps.find(m => m.id === id)
      const { error } = what === 'delete' || !map
        ? await supabase.from('dm_maps').delete().eq('owner_id', ownerId).eq('id', id)
        : await supabase.from('dm_maps').upsert({ owner_id: ownerId, id, data: map })
      if (error) continue
      // Saved again while the push was on its way: leave it pending for the next pass.
      const now = readPending(ownerId)
      if (now[id] === what && (what === 'delete' || readLocal(ownerId).find(m => m.id === id)?.updatedAt === map?.updatedAt)) {
        delete now[id]
        writePending(ownerId, now)
      }
    } catch {
      // Offline; sent on the next save or open.
    }
  }
}

function schedulePush(ownerId: string) {
  if (!syncs(ownerId)) return
  clearTimeout(timers.get(ownerId))
  timers.set(ownerId, setTimeout(() => { timers.delete(ownerId); void push(ownerId) }, PUSH_DELAY))
}

/** This device's maps, newest first. Call syncMaps next for the server's. */
export async function listMaps(ownerId: string): Promise<BattleMapDef[]> {
  return sortMaps(readLocal(ownerId))
}

export async function getMap(ownerId: string, id: string): Promise<BattleMapDef | undefined> {
  return readLocal(ownerId).find(m => m.id === id)
}

/** Reconciles with the server (newest updatedAt wins, pending local edits are pushed) and returns the maps to show. */
export async function syncMaps(ownerId: string): Promise<BattleMapDef[]> {
  const local = readLocal(ownerId)
  const supabase = await getSupabase()
  if (!supabase || !syncs(ownerId)) return sortMaps(local)
  try {
    const { data, error } = await supabase.from('dm_maps').select('id, data').eq('owner_id', ownerId)
    if (error || !data) return sortMaps(local)
    const pending = readPending(ownerId)
    const remote = new Map<string, BattleMapDef>()
    for (const row of data as { id: string; data: unknown }[]) {
      const m = normalizeMap(row.data)
      if (m) remote.set(row.id, { ...m, id: row.id, ownerId })
    }
    const merged = new Map<string, BattleMapDef>()
    for (const m of local) {
      const r = remote.get(m.id)
      if (pending[m.id] === 'save') { merged.set(m.id, m); continue }
      if (pending[m.id] === 'delete') continue
      if (r) merged.set(m.id, r.updatedAt > m.updatedAt ? r : m)
      else if (!remoteKnown(ownerId, m.id)) {
        // Made before this device signed in: keep it and send it up.
        merged.set(m.id, m)
        pending[m.id] = 'save'
      }
      // Known to the server once but gone now: deleted on another device.
    }
    writePending(ownerId, pending)
    for (const [id, r] of remote) if (!merged.has(id) && pending[id] !== 'delete') merged.set(id, r)
    const next = [...merged.values()]
    try { writeLocal(ownerId, next) } catch { /* storage full: keep the in-memory copy */ }
    rememberRemote(ownerId, [...remote.keys()])
    if (Object.keys(pending).length) await push(ownerId)
    return sortMaps(next)
  } catch {
    return sortMaps(local)
  }
}

// Ids the server had at the last sync, so a map missing from the server later is known as deleted elsewhere
// rather than never uploaded.
const knownKey = (ownerId: string) => `ff.maps.known.v1.${ownerId}`
function remoteKnown(ownerId: string, id: string): boolean {
  try { return (JSON.parse(localStorage.getItem(knownKey(ownerId)) ?? '[]') as string[]).includes(id) } catch { return false }
}
function rememberRemote(ownerId: string, ids: string[]) {
  try { localStorage.setItem(knownKey(ownerId), JSON.stringify(ids)) } catch { /* storage blocked */ }
}

export async function saveMap(map: BattleMapDef): Promise<BattleMapDef> {
  const next = { ...map, updatedAt: new Date().toISOString() }
  const rest = readLocal(map.ownerId).filter(m => m.id !== map.id)
  try {
    writeLocal(map.ownerId, [...rest, next])
  } catch {
    throw new MapSpaceError('This device is out of space for maps.')
  }
  writePending(map.ownerId, { ...readPending(map.ownerId), [map.id]: 'save' })
  schedulePush(map.ownerId)
  return next
}

export async function deleteMap(ownerId: string, id: string): Promise<void> {
  try { writeLocal(ownerId, readLocal(ownerId).filter(m => m.id !== id)) } catch { /* nothing to free */ }
  writePending(ownerId, { ...readPending(ownerId), [id]: 'delete' })
  schedulePush(ownerId)
}

/** Calls fn with the maps to show whenever another device saves this owner's maps. Returns an unsubscribe. */
export function onMapsChanged(ownerId: string, fn: (maps: BattleMapDef[]) => void): () => void {
  if (!syncs(ownerId)) return () => {}
  let stop = false
  const off = watchTable('dm_maps', `owner_id=eq.${ownerId}`, () => {
    void syncMaps(ownerId).then(maps => { if (!stop) fn(maps) })
  })
  return () => { stop = true; off() }
}

export async function deleteMapsFor(ownerId: string): Promise<void> {
  try {
    localStorage.removeItem(key(ownerId))
    localStorage.removeItem(pendingKey(ownerId))
    localStorage.removeItem(knownKey(ownerId))
  } catch { /* nothing saved */ }
}

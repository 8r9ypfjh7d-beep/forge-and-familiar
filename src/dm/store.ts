// DM screen store: one record per profile, cached on the device and synced to Supabase
// (dm_state) when this device is signed in to the cloud, so the DM sees the same screen everywhere.
import { isAdmin } from '../accounts/roster'
import { getCloudAccountId, getSupabase } from '../cloud'
import { normalizeDm, pickDm } from './logic'
import { emptyDmState, type DmState } from './types'

const key = (userId: string) => `ff.dm.v1.${userId}`
/** Set while this device has DM edits the server hasn't got yet. */
const pendingKey = (userId: string) => `ff.dm.pending.v1.${userId}`
const PUSH_DELAY = 800

function readLocal(userId: string): DmState {
  try {
    return normalizeDm(JSON.parse(localStorage.getItem(key(userId)) ?? 'null'), emptyDmState())
  } catch {
    return emptyDmState()
  }
}

function writeLocal(userId: string, state: DmState) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(state))
  } catch {
    // Storage full or blocked; the screen keeps working in memory.
  }
}

function isPending(userId: string): boolean {
  try { return localStorage.getItem(pendingKey(userId)) === '1' } catch { return false }
}

function setPending(userId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(pendingKey(userId), '1')
    else localStorage.removeItem(pendingKey(userId))
  } catch { /* storage blocked */ }
}

/** The server can hold this profile's DM data: its own account, or any account for the admin. */
function syncs(userId: string): boolean {
  const me = getCloudAccountId()
  return !!me && (me === userId || isAdmin(me))
}

// Edits made since the last push started; a push only clears "pending" if nothing changed meanwhile.
const edits = new Map<string, number>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

async function push(userId: string): Promise<void> {
  const supabase = await getSupabase()
  if (!supabase || !syncs(userId)) return
  const seen = edits.get(userId) ?? 0
  try {
    const { error } = await supabase.from('dm_state').upsert({ account_id: userId, data: readLocal(userId) })
    if (!error && (edits.get(userId) ?? 0) === seen) setPending(userId, false)
  } catch {
    // Offline; sent on the next save or open.
  }
}

/** This device's copy, right away. Call syncDm next for the server's. */
export async function loadDm(userId: string): Promise<DmState> {
  return readLocal(userId)
}

/** Reconciles with the server and returns the copy to show (unchanged when offline or not signed in). */
export async function syncDm(userId: string): Promise<DmState> {
  const local = readLocal(userId)
  const supabase = await getSupabase()
  if (!supabase || !syncs(userId)) return local
  try {
    const { data, error } = await supabase.from('dm_state').select('data').eq('account_id', userId).maybeSingle()
    if (error) return local
    const server = data ? normalizeDm(data.data, emptyDmState()) : null
    const pick = pickDm(local, isPending(userId), server)
    if (pick.push) {
      setPending(userId, true)
      await push(userId)
    } else {
      writeLocal(userId, pick.state)
    }
    return pick.state
  } catch {
    return local
  }
}

export async function saveDm(userId: string, state: DmState): Promise<void> {
  writeLocal(userId, state)
  if (!syncs(userId)) return
  setPending(userId, true)
  edits.set(userId, (edits.get(userId) ?? 0) + 1)
  clearTimeout(timers.get(userId))
  timers.set(userId, setTimeout(() => { timers.delete(userId); void push(userId) }, PUSH_DELAY))
}

/**
 * Calls fn with the server's copy whenever another device saves this profile's DM data.
 * Ignored while this device has unsent edits, so typing is never overwritten. Returns an unsubscribe.
 */
export function onDmChanged(userId: string, fn: (state: DmState) => void): () => void {
  let stop = false
  let off = () => {}
  void getSupabase().then(supabase => {
    if (!supabase || stop || !syncs(userId)) return
    const channel = supabase
      .channel(`dm-${userId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_state', filter: `account_id=eq.${userId}` }, payload => {
        const row = payload.new as { data?: unknown } | undefined
        if (!row?.data || isPending(userId)) return
        const state = normalizeDm(row.data, emptyDmState())
        writeLocal(userId, state)
        fn(state)
      })
      .subscribe()
    off = () => { void supabase.removeChannel(channel) }
  })
  return () => { stop = true; off() }
}

export async function deleteDmFor(userId: string): Promise<void> {
  try { localStorage.removeItem(key(userId)) } catch { /* nothing saved */ }
  setPending(userId, false)
}

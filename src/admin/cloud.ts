// Server side of the admin page: every account, linked device, character and DM screen in
// Supabase. The access rules (supabase/migrations) let only the admin account read all of it.
import { getSupabase, type AccountRow, type CharacterRow, type DmStateRow } from '../cloud'

export interface DeviceRow {
  user_id: string
  account_id: string
  linked_at: string
}

export interface CloudData {
  accounts: AccountRow[]
  devices: DeviceRow[]
  /** Live characters only; deleted ones stay on the server as tombstones for sync. */
  characters: CharacterRow[]
  dm: DmStateRow[]
}

/** Everything on the server, or null when offline, not signed in or the server refuses. */
export async function loadCloud(): Promise<CloudData | null> {
  const supabase = await getSupabase()
  if (!supabase) return null
  try {
    const [accounts, devices, characters, dm] = await Promise.all([
      supabase.from('accounts').select('id, name, role, is_admin').order('name'),
      supabase.from('account_devices').select('user_id, account_id, linked_at'),
      supabase.from('characters').select('id, owner_id, data, rev, deleted, updated_at').eq('deleted', false),
      supabase.from('dm_state').select('account_id, data, updated_at'),
    ])
    if (accounts.error || devices.error || characters.error || dm.error) return null
    return {
      accounts: accounts.data as AccountRow[],
      devices: devices.data as DeviceRow[],
      characters: characters.data as CharacterRow[],
      dm: dm.data as DmStateRow[],
    }
  } catch {
    return null
  }
}

/** Calls fn when any character or DM screen changes on the server. Returns an unsubscribe. */
export function watchCloud(fn: () => void): () => void {
  let stop = false
  let off = () => {}
  void getSupabase().then(supabase => {
    if (!supabase || stop) return
    const channel = supabase
      .channel(`admin-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, fn)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_state' }, fn)
      .subscribe()
    off = () => { void supabase.removeChannel(channel) }
  })
  return () => { stop = true; off() }
}

/**
 * Conditional write of one character row (rev must still be the one shown). False when someone
 * else saved it first or the write failed; the page reloads either way.
 */
async function writeCharacter(row: CharacterRow, change: Partial<Pick<CharacterRow, 'owner_id' | 'data' | 'deleted'>>): Promise<boolean> {
  const supabase = await getSupabase()
  if (!supabase) return false
  try {
    const { data, error } = await supabase.from('characters')
      .update({ ...change, rev: row.rev + 1 })
      .eq('id', row.id).eq('rev', row.rev)
      .select('id')
    return !error && (data?.length ?? 0) > 0
  } catch {
    return false
  }
}

export const moveCloudCharacter = (row: CharacterRow, ownerId: string) =>
  writeCharacter(row, { owner_id: ownerId, data: { ...row.data, ownerId } })

/** Marks it deleted, so every device drops it on its next sync. */
export const deleteCloudCharacter = (row: CharacterRow) => writeCharacter(row, { deleted: true })

export async function deleteCloudDm(accountId: string): Promise<boolean> {
  const supabase = await getSupabase()
  if (!supabase) return false
  try {
    const { error } = await supabase.from('dm_state').delete().eq('account_id', accountId)
    return !error
  } catch {
    return false
  }
}

/** Signs a device out of its account on the server; it works locally until its code is entered again. */
export async function unlinkCloudDevice(userId: string): Promise<boolean> {
  const supabase = await getSupabase()
  if (!supabase) return false
  try {
    const { error } = await supabase.from('account_devices').delete().eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}

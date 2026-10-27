// Cloud sign-in. Each device signs in anonymously, then claim_account(code) links it to the
// account whose activation code was typed. The linked account id is cached (ff.cloud.v1), so
// it is known offline and on every reload.
import { getSupabase } from './client'
import { isCloudEnabled } from './config'
import type { AccountRow, CloudStatus } from './types'

const KEY = 'ff.cloud.v1'
const CHANGED = 'ff:cloud-changed'

interface CloudLink {
  accountId: string
  linkedAt: string
}

function readLink(): CloudLink | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CloudLink) : null
  } catch {
    return null
  }
}

function writeLink(link: CloudLink | null) {
  try {
    if (link) localStorage.setItem(KEY, JSON.stringify(link))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked; the link is redone on the next activation.
  }
  window.dispatchEvent(new Event(CHANGED))
}

/** The account this device is signed in to in the cloud, or null. Same id as the local account. */
export const getCloudAccountId = (): string | null => readLink()?.accountId ?? null

export function getCloudStatus(): CloudStatus {
  if (!isCloudEnabled()) return 'off'
  return readLink() ? 'linked' : 'unlinked'
}

export function onCloudChanged(fn: () => void): () => void {
  window.addEventListener(CHANGED, fn)
  return () => window.removeEventListener(CHANGED, fn)
}

/**
 * Signs this device in to the cloud as the code's account. Returns the account, or null for a
 * wrong code, no cloud settings or no connection (the device keeps working locally).
 */
export async function linkCloudAccount(code: string): Promise<AccountRow | null> {
  const supabase = await getSupabase()
  if (!supabase) return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) return null
    }
    const { data, error } = await supabase.rpc('claim_account', { code })
    const account = (data as AccountRow[] | null)?.[0]
    if (error || !account) return null
    writeLink({ accountId: account.id, linkedAt: new Date().toISOString() })
    return account
  } catch {
    return null
  }
}

/** Unlinks this device and signs it out of the cloud. Local data stays. */
export async function unlinkCloud(): Promise<void> {
  const supabase = await getSupabase()
  try {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('account_devices').delete().eq('user_id', user.id)
      await supabase.auth.signOut()
    }
  } catch {
    // Offline; the server link is dropped on the next sign-in.
  }
  writeLink(null)
}

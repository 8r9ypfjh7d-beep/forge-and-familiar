// The activated account on this device (ff.account.v1). Codes are checked against the
// bundled roster, so activation works offline.
import { setActiveProfileId, saveProfile } from '../storage'
import { findInRoster, normalizeActivationCode } from './codes'
import { ROSTER } from './roster'
import type { Session } from './types'

const KEY = 'ff.account.v1'
const CHANGED = 'ff:account-changed'

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked; the account just won't survive a reload.
  }
  window.dispatchEvent(new Event(CHANGED))
}

export function onSessionChanged(fn: () => void): () => void {
  window.addEventListener(CHANGED, fn)
  return () => window.removeEventListener(CHANGED, fn)
}

/** Signs this device in with a personal code and makes its profile the active one. */
export async function activate(input: string): Promise<Session | null> {
  const code = normalizeActivationCode(input)
  if (!code) return null
  const account = await findInRoster(code, ROSTER)
  if (!account) return null
  const session = { ...account, activatedAt: new Date().toISOString() }
  await saveProfile({ id: account.id, displayName: account.name })
  setActiveProfileId(account.id)
  setSession(session)
  return session
}

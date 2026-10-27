// The activated account on this device (ff.account.v1). Codes are checked by the server, so
// activating needs a connection once; after that the session works offline.
import { linkCloudAccount } from '../cloud'
import { setActiveProfileId, saveProfile } from '../storage'
import { normalizeActivationCode } from './codes'
import type { ActivateError, Session } from './types'

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
export async function activate(input: string): Promise<Session | ActivateError> {
  const code = normalizeActivationCode(input)
  if (!code) return 'wrong'
  const result = await linkCloudAccount(code)
  if (typeof result === 'string') return result
  const session: Session = { id: result.id, name: result.name, role: result.role, activatedAt: new Date().toISOString() }
  await saveProfile({ id: session.id, displayName: session.name })
  setActiveProfileId(session.id)
  setSession(session)
  return session
}

/** The message key for a failed activation. */
export const activateErrorKey = (e: ActivateError) =>
  e === 'limited' ? 'account.tooManyTries' : e === 'offline' ? 'account.needsConnection' : 'account.badCode'

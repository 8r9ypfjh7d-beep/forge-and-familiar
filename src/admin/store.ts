// Raw access to this device's saved app data, for the admin page only.
import { APP_PREFIX, restorePlan, type Backup, type SavedEntry } from './logic'

export function readDevice(): SavedEntry[] {
  const out: SavedEntry[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(APP_PREFIX)) out.push({ key, value: localStorage.getItem(key) ?? '' })
    }
  } catch {
    // Storage blocked; nothing to show.
  }
  return out
}

export function removeKey(key: string) {
  try { localStorage.removeItem(key) } catch { /* nothing saved */ }
}

/** Replaces this device's app data with the backup (the signed-in account stays). The caller reloads. */
export function restoreDevice(backup: Backup) {
  const plan = restorePlan(readDevice().map(e => e.key), backup)
  for (const k of plan.remove) removeKey(k)
  for (const e of plan.set) {
    try { localStorage.setItem(e.key, e.value) } catch { /* storage full */ }
  }
}

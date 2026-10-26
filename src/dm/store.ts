// DM screen store: one record per profile. Async like src/storage so a hosted backend can replace localStorage.
import { normalizeDm } from './logic'
import { emptyDmState, type DmState } from './types'

const key = (userId: string) => `ff.dm.v1.${userId}`

export async function loadDm(userId: string): Promise<DmState> {
  try {
    return normalizeDm(JSON.parse(localStorage.getItem(key(userId)) ?? 'null'), emptyDmState())
  } catch {
    return emptyDmState()
  }
}

export async function saveDm(userId: string, state: DmState): Promise<void> {
  try {
    localStorage.setItem(key(userId), JSON.stringify(state))
  } catch {
    // Storage full or blocked; the screen keeps working in memory.
  }
}

export async function deleteDmFor(userId: string): Promise<void> {
  try { localStorage.removeItem(key(userId)) } catch { /* nothing saved */ }
}

// Adds granted requests to the player's characters on this device. Runs whenever the list changes.
import { getCharacter, saveCharacter } from '../storage'
import { grantToCharacter, markApplied, pendingGrants } from './logic'
import { listRequests, updateRequests } from './store'
import type { DmRequest } from './types'

let running: Promise<DmRequest[]> = Promise.resolve([])

/** Grants not yet on the character get added once. Calls queue, so two at once never add twice. */
export function applyGrants(userId: string): Promise<DmRequest[]> {
  running = running.catch(() => []).then(async () => {
    const due = pendingGrants(await listRequests(), userId)
    const done: DmRequest[] = []
    for (const r of due) {
      const c = await getCharacter(r.characterId)
      if (!c || c.ownerId !== userId) continue
      await saveCharacter(grantToCharacter(c, r, `req-${r.id}`))
      done.push(r)
    }
    if (done.length) await updateRequests(list => markApplied(list, done.map(r => r.id)))
    return done
  })
  return running
}

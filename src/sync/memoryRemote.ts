// In-memory RemoteStore with the same rules as the server (revisions, conditional writes,
// server clock). For tests, and for trying sync without a Supabase project.
import type { Character } from '../model/character'
import type { Snapshot } from '../portability/snapshots'
import type { RollResult } from '../dice/types'
import type { RemoteRow, RemoteStore } from './types'

export interface MemoryRemote extends RemoteStore {
  characters: Map<string, RemoteRow<Character>>
  snapshots: Map<string, RemoteRow<Snapshot>>
  rolls: Map<string, { ownerId: string; roll: RollResult }>
  /** Makes every call fail, like a dropped connection. */
  offline: boolean
}

export function memoryRemote(): MemoryRemote {
  let tick = 0
  const clock = () => new Date(Date.UTC(2026, 0, 1) + ++tick * 1000).toISOString()
  const check = () => { if (r.offline) throw new TypeError('Failed to fetch') }
  const copy = <T,>(x: T): T => structuredClone(x)
  const r: MemoryRemote = {
    characters: new Map(),
    snapshots: new Map(),
    rolls: new Map(),
    offline: false,
    async pullCharacters(ownerId, since) {
      check()
      return [...r.characters.values()].filter(x => x.ownerId === ownerId && (!since || x.updatedAt > since)).map(copy)
    },
    async pushCharacter(row, baseRev) {
      check()
      const cur = r.characters.get(row.id)
      if ((cur?.rev ?? 0) !== baseRev) return { ok: false, server: copy(cur!) }
      const rev = baseRev + 1
      r.characters.set(row.id, {
        id: row.id, ownerId: row.ownerId, rev, deleted: row.deleted, updatedAt: clock(),
        data: copy(row.data ?? cur!.data),
      })
      return { ok: true, rev }
    },
    async pullSnapshots(ownerId, since) {
      check()
      return [...r.snapshots.values()].filter(x => x.ownerId === ownerId && (!since || x.updatedAt > since)).map(copy)
    },
    async putSnapshot(row) {
      check()
      const cur = r.snapshots.get(row.id)
      r.snapshots.set(row.id, { ...copy(row), data: copy(row.deleted && cur ? cur.data : row.data), rev: (cur?.rev ?? 0) + 1, updatedAt: clock() })
    },
    async pushRolls(ownerId, rolls) {
      check()
      for (const roll of rolls) if (!r.rolls.has(roll.id)) r.rolls.set(roll.id, { ownerId, roll: copy(roll) })
    },
    async recentRolls(ownerId, limit) {
      check()
      return [...r.rolls.values()].filter(x => x.ownerId === ownerId).map(x => x.roll)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit)
    },
  }
  return r
}

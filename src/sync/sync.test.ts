import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCharacter } from '../sheet/fixtures'
import { deleteCharacter, getCharacter, listCharacters, saveCharacter } from '../storage'
import { addSnapshots, deleteSnapshot, listSnapshots, takeSnapshot } from '../portability'
import { localHistoryStorage } from '../dice/history'
import type { RollResult } from '../dice/types'
import { CONFLICT_LABEL, mergeRolls, resolveConflict, syncOnce } from './engine'
import { memoryRemote, type MemoryRemote } from './memoryRemote'
import { pendingCount } from './outbox'

const ROY = 'acct-roy'

/** Each device gets its own localStorage. */
const devices = new Map<string, Map<string, string>>()
function on(device: string) {
  if (!devices.has(device)) devices.set(device, new Map())
  const data = devices.get(device)!
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) },
  })
}

const roll = (id: string, timestamp: string): RollResult =>
  ({ id, notation: '1d20', type: 'check', total: 12, terms: [], breakdown: '[12]', timestamp }) as unknown as RollResult

let remote: MemoryRemote
let t = 0
/** Every save gets a later clock than the one before. */
const tick = () => vi.setSystemTime(new Date(Date.UTC(2026, 9, 27, 9, 0, ++t)))

beforeEach(() => {
  devices.clear()
  remote = memoryRemote()
  vi.stubGlobal('window', new EventTarget())
  vi.useFakeTimers({ toFake: ['Date'] })
  tick()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function save(c: Parameters<typeof saveCharacter>[0]) {
  tick()
  return saveCharacter(c)
}

describe('first sync on a device', () => {
  it('uploads the account’s existing characters, snapshots and rolls once', async () => {
    on('phone')
    const aria = await save(makeCharacter({ id: 'aria', ownerId: ROY, name: 'Aria' }))
    await save(makeCharacter({ id: 'bram', ownerId: ROY, name: 'Bram' }))
    await save(makeCharacter({ id: 'other', ownerId: 'local-guest' }))
    await addSnapshots([takeSnapshot(aria)])
    localHistoryStorage(`ff.rolls.v1.${ROY}`).save([roll('r1', '2026-10-27T08:00:00.000Z')])

    await syncOnce(remote, ROY)

    expect([...remote.characters.keys()].sort()).toEqual(['aria', 'bram'])
    expect(remote.snapshots.size).toBe(1)
    expect(remote.rolls.has('r1')).toBe(true)
    expect(pendingCount(ROY)).toBe(0)
  })

  it('loads everything on a new device', async () => {
    on('phone')
    const aria = await save(makeCharacter({ id: 'aria', ownerId: ROY, name: 'Aria' }))
    await addSnapshots([takeSnapshot(aria)])
    localHistoryStorage(`ff.rolls.v1.${ROY}`).save([roll('r1', '2026-10-27T08:00:00.000Z')])
    await syncOnce(remote, ROY)

    on('laptop')
    await syncOnce(remote, ROY)
    expect((await getCharacter('aria'))?.name).toBe('Aria')
    expect(await listSnapshots('aria')).toHaveLength(1)
    expect(localHistoryStorage(`ff.rolls.v1.${ROY}`).load()?.map(r => r.id)).toEqual(['r1'])
    expect(pendingCount(ROY)).toBe(0)
  })
})

describe('play state between devices', () => {
  beforeEach(async () => {
    on('phone')
    await save(makeCharacter({ id: 'aria', ownerId: ROY }))
    await syncOnce(remote, ROY)
    on('laptop')
    await syncOnce(remote, ROY)
  })

  it('carries an HP change over', async () => {
    on('phone')
    const c = (await getCharacter('aria'))!
    await save({ ...c, state: { ...c.state, currentHp: 3 } })
    await syncOnce(remote, ROY)
    on('laptop')
    await syncOnce(remote, ROY)
    expect((await getCharacter('aria'))?.state.currentHp).toBe(3)
  })

  it('keeps offline changes and pushes them when the connection is back', async () => {
    on('phone')
    remote.offline = true
    const c = (await getCharacter('aria'))!
    await save({ ...c, notes: 'Saved in the basement' })
    await expect(syncOnce(remote, ROY)).rejects.toThrow()
    expect(pendingCount(ROY)).toBe(1)
    remote.offline = false
    await syncOnce(remote, ROY)
    expect(pendingCount(ROY)).toBe(0)
    expect(remote.characters.get('aria')?.data.notes).toBe('Saved in the basement')
  })

  it('keeps the newer copy when both devices changed it, and the older build as a snapshot', async () => {
    on('phone')
    const c = (await getCharacter('aria'))!
    await save({ ...c, xp: 34000, classes: [{ classId: 'fighter', level: 6 }, { classId: 'wizard', level: 2 }] })
    on('laptop')
    const l = (await getCharacter('aria'))!
    await save({ ...l, notes: 'Later edit' })
    on('phone')
    await syncOnce(remote, ROY)
    on('laptop')
    await syncOnce(remote, ROY)

    const kept = (await getCharacter('aria'))!
    expect(kept.notes).toBe('Later edit')
    expect(remote.characters.get('aria')?.data.notes).toBe('Later edit')
    const snaps = await listSnapshots('aria')
    expect(snaps[0].label).toBe(CONFLICT_LABEL)
    expect(snaps[0].character.classes[0].level).toBe(6)

    on('phone')
    await syncOnce(remote, ROY)
    expect((await getCharacter('aria'))?.notes).toBe('Later edit')
    expect((await listSnapshots('aria'))[0].label).toBe(CONFLICT_LABEL)
  })

  it('deletes on every device', async () => {
    on('phone')
    await deleteCharacter('aria')
    await syncOnce(remote, ROY)
    expect(remote.characters.get('aria')?.deleted).toBe(true)
    on('laptop')
    await syncOnce(remote, ROY)
    expect(await listCharacters(ROY)).toEqual([])
  })

  it('lets an edit win over a delete from another device', async () => {
    on('phone')
    await deleteCharacter('aria')
    await syncOnce(remote, ROY)
    on('laptop')
    const c = (await getCharacter('aria'))!
    await save({ ...c, notes: 'Still playing her' })
    await syncOnce(remote, ROY)
    expect(remote.characters.get('aria')).toMatchObject({ deleted: false, data: { notes: 'Still playing her' } })
    on('phone')
    await syncOnce(remote, ROY)
    expect((await getCharacter('aria'))?.notes).toBe('Still playing her')
  })

  it('syncs snapshot deletes', async () => {
    on('phone')
    const snap = takeSnapshot((await getCharacter('aria'))!)
    await addSnapshots([snap])
    await syncOnce(remote, ROY)
    on('laptop')
    await syncOnce(remote, ROY)
    expect(await listSnapshots('aria')).toHaveLength(1)
    await deleteSnapshot('aria', snap.id)
    await syncOnce(remote, ROY)
    on('phone')
    await syncOnce(remote, ROY)
    expect(await listSnapshots('aria')).toHaveLength(0)
  })
})

describe('helpers', () => {
  it('resolveConflict: newer wins, edits beat deletes, build changes are rescued', () => {
    const old = makeCharacter({ updatedAt: '2026-01-01T00:00:00Z' })
    const newer = makeCharacter({ updatedAt: '2026-01-02T00:00:00Z', xp: 1 })
    const row = (data = old, deleted = false) => ({ id: 'demo', ownerId: ROY, data, rev: 2, deleted, updatedAt: '' })
    expect(resolveConflict(newer, row())).toMatchObject({ keep: 'local', rescue: old })
    expect(resolveConflict(old, row(newer))).toMatchObject({ keep: 'server', rescue: old })
    expect(resolveConflict(old, row(old, true))).toEqual({ keep: 'local' })
    expect(resolveConflict(undefined, row())).toEqual({ keep: 'server' })
    expect(resolveConflict({ ...old, notes: 'x', updatedAt: newer.updatedAt }, row())).toEqual({ keep: 'local' })
  })

  it('mergeRolls: union by id, newest first, capped', () => {
    const a = [roll('1', '2026-01-03'), roll('2', '2026-01-01')]
    const b = [roll('2', '2026-01-01'), roll('3', '2026-01-02')]
    expect(mergeRolls(a, b, 2).map(r => r.id)).toEqual(['1', '3'])
  })
})

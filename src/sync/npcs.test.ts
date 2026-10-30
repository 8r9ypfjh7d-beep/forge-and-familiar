import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newNpc } from '../npc/engine'
import { makeBlock } from '../npc/fixtures'
import { deleteNpc, listNpcs, saveNpc } from '../npc/store'
import { syncOnce } from './engine'
import { memoryRemote, type MemoryRemote } from './memoryRemote'
import { pendingCount } from './outbox'
import { MissingTableError } from './types'

const NOA = 'acct-noa'
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

let remote: MemoryRemote
let t = 0
const tick = () => vi.setSystemTime(new Date(Date.UTC(2026, 9, 30, 21, 0, ++t)))

const vexa = () => newNpc({ id: 'vexa', ownerId: NOA, name: 'Captain Vexa', block: makeBlock() })
async function save(n: ReturnType<typeof vexa>) {
  tick()
  return saveNpc(n)
}

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

describe('NPC sheets in the cloud', () => {
  it('follow the DM to their other devices', async () => {
    on('phone')
    await save(vexa())
    expect(pendingCount(NOA)).toBe(1)
    await syncOnce(remote, NOA)
    expect(pendingCount(NOA)).toBe(0)

    on('laptop')
    expect(await listNpcs(NOA)).toEqual([])
    await syncOnce(remote, NOA)
    expect((await listNpcs(NOA)).map(n => n.name)).toEqual(['Captain Vexa'])
  })

  it('never reach another account', async () => {
    on('phone')
    await save(vexa())
    await syncOnce(remote, NOA)
    on('roys-phone')
    await syncOnce(remote, ROY)
    expect(await listNpcs(ROY)).toEqual([])
    expect(await listNpcs(NOA)).toEqual([])
  })

  it('carry play state: damage on the laptop shows on the phone', async () => {
    on('phone')
    await save(vexa())
    await syncOnce(remote, NOA)
    on('laptop')
    await syncOnce(remote, NOA)
    const [n] = await listNpcs(NOA)
    await save({ ...n, state: { ...n.state, currentHp: 40 } })
    await syncOnce(remote, NOA)
    on('phone')
    await syncOnce(remote, NOA)
    expect((await listNpcs(NOA))[0].state.currentHp).toBe(40)
  })

  it('let the last save win, and an edit beat a delete', async () => {
    on('phone')
    await save(vexa())
    await syncOnce(remote, NOA)
    on('laptop')
    await syncOnce(remote, NOA)
    await save({ ...(await listNpcs(NOA))[0], name: 'Vexa the Red' })
    on('phone')
    await save({ ...(await listNpcs(NOA))[0], role: 'Pirate' })
    await syncOnce(remote, NOA)
    on('laptop')
    await syncOnce(remote, NOA)
    expect((await listNpcs(NOA))[0]).toMatchObject({ name: 'Captain Vexa', role: 'Pirate' })

    tick()
    await deleteNpc('vexa')
    on('phone')
    await save({ ...(await listNpcs(NOA))[0], notes: 'Owes the party a favour' })
    on('laptop')
    await syncOnce(remote, NOA)
    on('phone')
    await syncOnce(remote, NOA)
    expect((await listNpcs(NOA))[0]?.notes).toBe('Owes the party a favour')
    on('laptop')
    await syncOnce(remote, NOA)
    expect((await listNpcs(NOA)).length).toBe(1)
  })

  it('remove a deleted sheet from every device', async () => {
    on('phone')
    await save(vexa())
    await syncOnce(remote, NOA)
    on('laptop')
    await syncOnce(remote, NOA)
    tick()
    await deleteNpc('vexa')
    await syncOnce(remote, NOA)
    on('phone')
    await syncOnce(remote, NOA)
    expect(await listNpcs(NOA)).toEqual([])
    expect(pendingCount(NOA)).toBe(0)
  })

  it('wait quietly while the server has no npc_sheets table yet', async () => {
    on('phone')
    await save(vexa())
    remote.pullNpcs = async () => { throw new MissingTableError('npc_sheets') }
    await expect(syncOnce(remote, NOA)).resolves.toBeUndefined()
    expect(pendingCount(NOA)).toBe(1)
  })
})

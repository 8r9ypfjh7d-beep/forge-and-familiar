import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subclassById } from '../rules'
import { deletePack, importPack, listPacks, listPartyPacks, loadHomebrew, savePack } from '../homebrew/store'
import { entryId, newPack } from '../homebrew/pack'
import type { HomebrewPack } from '../homebrew/types'
import { syncOnce } from './engine'
import { memoryRemote, type MemoryRemote } from './memoryRemote'
import { pendingCount, updateMeta } from './outbox'
import { MissingTableError } from './types'

const ROY = 'acct-roy'
const NOA = 'acct-noa'

/** Each device gets its own localStorage. */
const devices = new Map<string, Map<string, string>>()
function on(device: string, viewer: string) {
  if (!devices.has(device)) devices.set(device, new Map())
  const data = devices.get(device)!
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) },
  })
  remote.viewer = viewer
  loadHomebrew()
}

let remote: MemoryRemote
let t = 0
const tick = () => vi.setSystemTime(new Date(Date.UTC(2026, 9, 30, 9, 0, ++t)))

/** Roy's pack with one homebrew subclass. */
function royPack(): HomebrewPack {
  const pack = newPack('abcdefabcdef', { id: ROY, displayName: 'Roy' }, 'Roy brew')
  return { ...pack, subclasses: [{ id: entryId(pack, 'Oath of Thorns'), name: 'Oath of Thorns', classId: 'paladin', features: [{ level: 3, name: 'Briar Ward' }], armor: [] }] }
}
const THORNS = 'hb:abcdefabcdef:oath-of-thorns'

async function save(p: HomebrewPack) {
  tick()
  return savePack(p)
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

describe('homebrew packs in the cloud', () => {
  it('follow the account to its other devices', async () => {
    on('phone', ROY)
    await save(royPack())
    expect(pendingCount(ROY)).toBe(1)
    await syncOnce(remote, ROY)
    expect(pendingCount(ROY)).toBe(0)

    on('laptop', ROY)
    expect(subclassById(THORNS)).toBeUndefined()
    await syncOnce(remote, ROY)
    expect((await listPacks()).map(p => p.name)).toEqual(['Roy brew'])
    expect(subclassById(THORNS)?.name).toBe('Oath of Thorns')
    expect(pendingCount(ROY)).toBe(0)
  })

  it('upload packs made before sync knew about them, on an already synced device', async () => {
    on('phone', ROY)
    await save(royPack())
    updateMeta(m => { m.packs = {}; m.owners[ROY] = { initialized: true } })
    await syncOnce(remote, ROY)
    expect(remote.packs.has(`${ROY}:abcdefabcdef`)).toBe(true)
  })

  it('reach party members read-only, so the DM resolves a character’s homebrew subclass', async () => {
    remote.partyOf.set(ROY, 'garden').set(NOA, 'garden')
    on('roy-phone', ROY)
    await save(royPack())
    await syncOnce(remote, ROY)

    on('noa-tablet', NOA)
    await syncOnce(remote, NOA)
    expect(await listPacks()).toEqual([])
    expect((await listPartyPacks()).map(p => p.name)).toEqual(['Roy brew'])
    expect(subclassById(THORNS)?.features[0].name).toBe('Briar Ward')
    expect(pendingCount(NOA)).toBe(0)

    // Roy renames it: Noa gets the change.
    on('roy-phone', ROY)
    await save({ ...(await listPacks())[0], name: 'Thorn brew' })
    await syncOnce(remote, ROY)
    on('noa-tablet', NOA)
    await syncOnce(remote, NOA)
    expect((await listPartyPacks()).map(p => p.name)).toEqual(['Thorn brew'])

    // Adding it to her library makes it her own copy, uploaded under her account.
    await importPack((await listPartyPacks())[0])
    await syncOnce(remote, NOA)
    expect(remote.packs.has(`${NOA}:abcdefabcdef`)).toBe(true)

    // Roy deletes his: Noa's own copy stays.
    on('roy-phone', ROY)
    await deletePack('abcdefabcdef')
    await syncOnce(remote, ROY)
    on('noa-tablet', NOA)
    await syncOnce(remote, NOA)
    expect(await listPartyPacks()).toEqual([])
    expect(subclassById(THORNS)?.name).toBe('Oath of Thorns')
  })

  it('stay private outside the party', async () => {
    on('roy-phone', ROY)
    await save(royPack())
    await syncOnce(remote, ROY)
    on('noa-tablet', NOA)
    await syncOnce(remote, NOA)
    expect(await listPartyPacks()).toEqual([])
    expect(subclassById(THORNS)).toBeUndefined()
  })

  it('delete everywhere, but an edit made meanwhile beats the delete', async () => {
    on('phone', ROY)
    await save(royPack())
    await syncOnce(remote, ROY)
    on('laptop', ROY)
    await syncOnce(remote, ROY)

    on('phone', ROY)
    await deletePack('abcdefabcdef')
    await syncOnce(remote, ROY)
    on('laptop', ROY)
    await syncOnce(remote, ROY)
    expect(await listPacks()).toEqual([])

    // Again, but the laptop edits it before hearing about the delete.
    await save(royPack())
    await syncOnce(remote, ROY)
    on('phone', ROY)
    await syncOnce(remote, ROY)
    await deletePack('abcdefabcdef')
    on('laptop', ROY)
    await save({ ...(await listPacks())[0], name: 'Kept' })
    on('phone', ROY)
    await syncOnce(remote, ROY)
    on('laptop', ROY)
    await syncOnce(remote, ROY)
    on('phone', ROY)
    await syncOnce(remote, ROY)
    expect((await listPacks()).map(p => p.name)).toEqual(['Kept'])
  })

  it('keep the copy saved last when both devices changed it', async () => {
    on('phone', ROY)
    await save(royPack())
    await syncOnce(remote, ROY)
    on('laptop', ROY)
    await syncOnce(remote, ROY)

    on('phone', ROY)
    await save({ ...(await listPacks())[0], name: 'Older' })
    on('laptop', ROY)
    await save({ ...(await listPacks())[0], name: 'Newer' })
    await syncOnce(remote, ROY)
    on('phone', ROY)
    await syncOnce(remote, ROY)
    expect((await listPacks()).map(p => p.name)).toEqual(['Newer'])
    expect(pendingCount(ROY)).toBe(0)
    on('laptop', ROY)
    await syncOnce(remote, ROY)
    expect((await listPacks()).map(p => p.name)).toEqual(['Newer'])
  })

  it('wait quietly while the server has no packs table yet', async () => {
    on('phone', ROY)
    await save(royPack())
    remote.pullPacks = async () => { throw new MissingTableError('relation "homebrew_packs" does not exist') }
    await expect(syncOnce(remote, ROY)).resolves.toBeUndefined()
    expect(pendingCount(ROY)).toBe(1)
  })
})

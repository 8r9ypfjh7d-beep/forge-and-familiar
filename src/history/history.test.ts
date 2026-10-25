import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canRestore, changesIn, diffEntries, mergeRevisions, nextRevision, restoreEntry, summarize } from './revisions'
import { deleteHistory, historyForSharing, importHistory, listRevisions, recordRevision } from './store'
import type { Revision } from './types'

const fireBolt = { id: 'hb:abc:fire-bolt', name: 'Fire Bolt+', level: 0, damage: { dice: '1d10', type: 'fire' }, classes: ['wizard'], updatedAt: '1' }

const rev = (n: number, entry: object, extra: Partial<Revision> = {}): Revision => ({
  id: `r${n}`, entryId: fireBolt.id, kind: 'spells', rev: n, at: `2026-10-0${n}T00:00:00Z`,
  authorId: 'ana', authorName: 'Ana', source: 'edit', entry, ...extra,
})

describe('diffEntries', () => {
  it('lists nested field changes by path and skips updatedAt', () => {
    const after = { ...fireBolt, damage: { dice: '2d10', type: 'fire' }, range: '120 ft', updatedAt: '2' }
    expect(diffEntries(fireBolt, after)).toEqual([
      { path: 'damage.dice', type: 'changed', before: '1d10', after: '2d10' },
      { path: 'range', type: 'added', after: '120 ft' },
    ])
  })

  it('compares arrays whole and ignores key order', () => {
    expect(diffEntries(fireBolt, { ...fireBolt, classes: ['wizard', 'sorcerer'] })).toEqual([
      { path: 'classes', type: 'changed', before: ['wizard'], after: ['wizard', 'sorcerer'] },
    ])
    const { name, ...rest } = fireBolt
    expect(diffEntries(fireBolt, { ...rest, name })).toEqual([])
  })

  it('shows a first version as one added entry', () => {
    expect(summarize(diffEntries(undefined, fireBolt))).toBe('Created')
  })
})

describe('summarize', () => {
  it('names a few fields and counts the rest', () => {
    const paths = ['a', 'b', 'c', 'd', 'e'].map(path => ({ path, type: 'added' as const, after: 1 }))
    expect(summarize(paths.slice(0, 2))).toBe('Changed a, b')
    expect(summarize(paths)).toBe('Changed a, b, c and 2 more')
  })
})

describe('nextRevision', () => {
  it('numbers versions and skips saves that change nothing', () => {
    const first = nextRevision([], { kind: 'spells', entry: fireBolt, authorId: 'ana', authorName: 'Ana' })!
    expect(first).toMatchObject({ rev: 1, source: 'edit', authorName: 'Ana', entryId: fireBolt.id })
    expect(nextRevision([first], { kind: 'spells', entry: { ...fireBolt, updatedAt: '9' }, authorId: 'ana' })).toBeNull()
    const second = nextRevision([first], { kind: 'spells', entry: { ...fireBolt, level: 1 }, authorId: 'ana', note: '  buff  ' })!
    expect(second).toMatchObject({ rev: 2, note: 'buff' })
  })

  it('keeps its own copy of the entry', () => {
    const entry = structuredClone(fireBolt)
    const r = nextRevision([], { kind: 'spells', entry, authorId: 'ana' })!
    entry.damage.dice = '9d9'
    expect((r.entry as typeof fireBolt).damage.dice).toBe('1d10')
  })
})

describe('changesIn and restore', () => {
  it('diffs each version against the one before', () => {
    const list = [rev(1, fireBolt), rev(2, { ...fireBolt, level: 1 })]
    expect(changesIn(list, list[1])).toEqual([{ path: 'level', type: 'changed', before: 0, after: 1 }])
  })

  it('restores a copy and only lets the pack author do it', () => {
    const r = rev(1, fireBolt)
    const back = restoreEntry<typeof fireBolt>(r)
    expect(back).toEqual(fireBolt)
    expect(back).not.toBe(r.entry)
    expect(canRestore('ana', 'ana')).toBe(true)
    expect(canRestore('bo', 'ana')).toBe(false)
  })
})

describe('mergeRevisions', () => {
  it('adds the author history, drops a matching local import, and renumbers', () => {
    const authors = [rev(1, fireBolt), rev(2, { ...fireBolt, level: 1 })]
    const localImport = rev(1, { ...fireBolt, level: 1 }, { id: 'local', source: 'import', at: '2026-10-05T00:00:00Z' })
    const merged = mergeRevisions([localImport], authors)
    expect(merged.map(r => [r.id, r.rev])).toEqual([['r1', 1], ['r2', 2]])
  })

  it('is idempotent and ignores broken rows', () => {
    const list = [rev(1, fireBolt), rev(2, { ...fireBolt, level: 1 })]
    expect(mergeRevisions(list, [...list, { nope: true } as unknown as Revision])).toEqual(list)
  })
})

describe('store', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v) },
    })
    vi.stubGlobal('window', new EventTarget())
  })

  it('records, lists newest first, shares and deletes by pack prefix', async () => {
    await recordRevision({ kind: 'spells', entry: fireBolt, authorId: 'ana' })
    expect(await recordRevision({ kind: 'spells', entry: fireBolt, authorId: 'ana' })).toBeNull()
    await recordRevision({ kind: 'spells', entry: { ...fireBolt, level: 1 }, authorId: 'ana' })
    await recordRevision({ kind: 'items', entry: { id: 'hb:zzz:rope' }, authorId: 'bo' })
    expect((await listRevisions(fireBolt.id)).map(r => r.rev)).toEqual([2, 1])

    const shared = await historyForSharing([fireBolt.id])
    await deleteHistory('hb:abc:')
    expect(await listRevisions(fireBolt.id)).toEqual([])
    expect(await listRevisions('hb:zzz:rope')).toHaveLength(1)

    await importHistory(shared)
    expect((await listRevisions(fireBolt.id)).map(r => r.rev)).toEqual([2, 1])
  })
})

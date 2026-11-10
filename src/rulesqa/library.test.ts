import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import { exactHit, isHebrew, isQuestion, searchAll, searchKind, type Library } from './library'

const lib = async (): Promise<Library> => {
  const own = { sources: ['srd-5.1'] }
  const [spells, equipment, magic, monsters, conditions, feats] = await Promise.all([
    loadKind('spells', own), loadKind('equipment', own), loadKind('magic-items', own),
    loadKind('monsters', own), loadKind('conditions', own), loadKind('feats', own),
  ])
  return { spells, items: [...equipment, ...magic], monsters, conditions, feats }
}

describe('library search', () => {
  it('finds a spell by exact name first, across kinds', async () => {
    const l = await lib()
    const hits = searchAll(l, 'fireball')
    expect(hits[0].kind).toBe('spells')
    expect(exactHit(hits, 'Fireball')?.entry.name).toBe('Fireball')
  })
  it('finds monsters, items and conditions by name', async () => {
    const l = await lib()
    expect(searchAll(l, 'goblin').some(h => h.kind === 'monsters' && h.entry.name === 'Goblin')).toBe(true)
    expect(searchKind(l, 'items', 'longsword')[0].entry.name).toBe('Longsword')
    expect(searchKind(l, 'conditions', 'grappled')[0].entry.name).toBe('Grappled')
  })
  it('leaves monsters out when not asked for', async () => {
    const l = await lib()
    expect(searchAll(l, 'goblin', undefined, ['spells', 'items']).some(h => h.kind === 'monsters')).toBe(false)
  })
  it('matches the translated name', async () => {
    const l = await lib()
    const alias = (h: { entry: { id: string; name: string } }) => (h.entry.id === 'fireball' ? 'כדור אש' : h.entry.name)
    expect(searchAll(l, 'כדור אש', alias)[0].entry.name).toBe('Fireball')
  })
  it('lists a kind A–Z on an empty search and ignores punctuation-only questions', async () => {
    const l = await lib()
    const all = searchKind(l, 'conditions', '')
    expect(all.length).toBe(l.conditions.length)
    expect(all[0].entry.name <= all[1].entry.name).toBe(true)
    expect(searchAll(l, '?')).toEqual([])
    expect(isQuestion('  ? ')).toBe(false)
    expect(isHebrew('מה זה')).toBe(true)
    expect(isHebrew('grapple')).toBe(false)
  })
})

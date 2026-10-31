import { afterEach, describe, expect, it } from 'vitest'
import { loadMonsters, monsterKey, monsterName, monsterSourceNote, registerContentPack, unregisterContentPack, type Monster } from '.'

const PACK = 'hb:test-pack'
afterEach(() => unregisterContentPack(PACK))

const stub = (id: string, name: string, source: string, edition: '2014' | '2024' = '2014'): Monster => ({
  id, name, source, edition, sizes: ['Medium'], type: 'humanoid', alignment: 'neutral', armorClass: [{ value: 10 }], hitPoints: 9, hitDice: '2d8', hitPointsRoll: '2d8',
  speed: { walk: '30 ft.' }, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, savingThrows: {}, skills: {}, damageVulnerabilities: [], damageResistances: [],
  damageImmunities: [], conditionImmunities: [], senses: {}, languages: '', challengeRating: 0, xp: 10, proficiencyBonus: 2, traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [], forms: [],
})

describe('loadMonsters', () => {
  it('2014 is the SRD 5.1 plus 2014 book monsters, no legacy', async () => {
    const list = await loadMonsters('2014')
    expect(list.filter(m => m.source === 'srd-5.1').length).toBeGreaterThan(300)
    expect(list.some(m => m.id === 'beholder' && m.source === 'books-2014')).toBe(true)
    expect(list.some(m => m.legacy)).toBe(false)
    expect(list.some(m => m.source === 'srd-5.2' || m.source === 'books-2024')).toBe(false)
  })

  it('2024 adds unreprinted 2014 book monsters as legacy, never a monster the 2024 sources already have', async () => {
    const list = await loadMonsters('2024')
    expect(list.filter(m => m.source === 'srd-5.2').length).toBeGreaterThan(300)
    // Reprinted in the 2025 Monster Manual, so the 2014 entry stays out.
    expect(list.filter(m => m.id === 'beholder').map(m => [m.source, m.book, m.legacy])).toEqual([['books-2024', 'XMM', undefined]])
    const names = list.filter(m => !m.legacy).map(m => m.name.toLowerCase())
    for (const m of list.filter(m => m.legacy)) expect(names, m.name).not.toContain(m.name.toLowerCase())
    expect(list.some(m => m.source === 'srd-5.1')).toBe(false)
  })

  it('includes registered packs for both editions', async () => {
    registerContentPack({ format: 'ff-content', version: 1, source: { id: PACK, title: 'Test pack', edition: '2014', license: 'own', attribution: 'Noa' }, entries: { monsters: [stub('gloomfang', 'Gloomfang', PACK)] } })
    for (const e of ['2014', '2024'] as const) expect((await loadMonsters(e)).some(m => monsterKey(m) === `${PACK}:gloomfang`)).toBe(true)
  })

  it('keys and names monsters per source', () => {
    const terms = { 'monster.aboleth': 'אבולת' }
    expect(monsterKey({ source: 'srd-5.2', id: 'aboleth' })).toBe('srd-5.2:aboleth')
    expect(monsterName(stub('aboleth', 'Aboleth', 'srd-5.2'), 'he', terms)).toBe('אבולת')
    expect(monsterName(stub('aboleth', 'Aboleth', 'srd-5.2'), 'en', terms)).toBe('Aboleth')
    expect(monsterName({ ...stub('beholder', 'Beholder', 'books-2014'), nameHe: 'בהולדר' }, 'he', terms)).toBe('בהולדר')
    expect(monsterName(stub('gloomfang', 'Gloomfang', PACK), 'he', terms)).toBe('Gloomfang')
  })

  it('tells where a monster comes from', () => {
    expect(monsterSourceNote({ source: 'srd-5.1' }).note).toContain('Creative Commons')
    expect(monsterSourceNote({ source: 'books-2014', book: 'MM' })).toMatchObject({ title: 'Monster Manual (2014)' })
    expect(monsterSourceNote({ source: 'books-2014', book: 'MM' }).note).toContain('summary')
  })
})

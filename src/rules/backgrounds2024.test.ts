import { describe, expect, it } from 'vitest'
import { ABILITIES, ALL_SKILLS, BOOK_BACKGROUNDS_2024, TOOLS, backgroundById, backgroundsFor, createCharacter, getTools, itemById, type CharacterDraft } from './index'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral', rulesEdition: '2024',
  raceId: 'human', backgroundId: 'artisan', classes: [{ classId: 'fighter', level: 1 }], abilityMethod: 'standard',
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, freeAbilityBonuses: ['str', 'str', 'dex'],
  chosenSkills: [], ...over,
})

describe('2024 book backgrounds', () => {
  const all = backgroundsFor('2024')

  it('offers every PHB 2024 background and the newer books', () => {
    const ids = all.map(b => b.id)
    for (const id of ['acolyte', 'artisan', 'charlatan', 'criminal', 'entertainer', 'farmer', 'guard', 'guide', 'hermit', 'merchant',
      'noble', 'sage', 'sailor', 'scribe', 'soldier', 'wayfarer', 'harper', 'house-cannith-heir', 'haunted-one', 'familiar-trainer']) expect(ids).toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(backgroundById('artisan')).toBeUndefined()
  })

  it('gives each one three abilities, two skills, a tool, an Origin feat, a source and gear that exists', () => {
    for (const b of BOOK_BACKGROUNDS_2024) {
      expect(b.source, b.id).toBeTruthy()
      expect(new Set(b.abilityScores).size, b.id).toBe(3)
      for (const a of b.abilityScores ?? []) expect(ABILITIES).toContain(a)
      expect(b.skillProficiencies, b.id).toHaveLength(2)
      for (const s of b.skillProficiencies) expect(ALL_SKILLS).toContain(s)
      const tools = b.toolProficiencies ?? b.toolChoices?.from ?? []
      expect(tools.length, b.id).toBeGreaterThan(0)
      for (const t of tools) expect(TOOLS, b.id).toContain(t)
      expect(b.feat?.id, b.id).toBeTruthy()
      expect(b.gold, b.id).toBeGreaterThan(0)
      expect(b.equipment.filter(id => !itemById(id)), b.id).toEqual([])
    }
  })

  it('applies a book background and names the picked tool in the kit', () => {
    const c = createCharacter(draft({ chosenTools: ["Smith's tools"] }))
    expect(getTools(c)).toContain("Smith's tools")
    expect(c.inventory.find(e => e.itemId === 'artisans-tools')?.name).toBe("Smith's tools")
    expect(c.inventory.find(e => e.itemId === 'pouch')?.qty).toBe(2)
    expect(c.coins.gp).toBeGreaterThanOrEqual(32)
  })
})

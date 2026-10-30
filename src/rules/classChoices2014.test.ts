import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import { CLASS_CHOICES_2014, classChoiceDefs, classChoices, classPickSlots, createCharacter, derive, registerClassOptions, type CharacterDraft } from './index'

const make = (over: Partial<CharacterDraft>, inventory: string[] = []): Character => {
  const c = createCharacter({
    name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
    raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 1 }],
    abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    freeAbilityBonuses: [], chosenSkills: ['athletics', 'perception'],
    ...over,
  })
  c.inventory = inventory.map((itemId, i) => ({ uid: String(i), itemId, qty: 1, equipped: true }))
  return c
}

describe('2014 class picks', () => {
  it('has unique choice ids per class and unique option ids per choice', () => {
    for (const [classId, list] of Object.entries(CLASS_CHOICES_2014)) {
      expect(new Set(list.map(c => c.id)).size, classId).toBe(list.length)
      for (const ch of list) expect(new Set(ch.options.map(o => o.id)).size, `${classId}.${ch.id}`).toBe(ch.options.length)
    }
  })

  it('offers Fighting Styles from the right level, with Tasha\'s styles, only in 2014', () => {
    const style = (classId: string, level: number) => classChoices({ classes: [{ classId, level }] }).find(x => x.choice.id === 'fightingStyle')
    expect(style('fighter', 1)?.choice.options.map(o => o.id)).toContain('blind-fighting')
    expect(style('paladin', 1)).toBeUndefined()
    expect(style('paladin', 2)?.choice.options.map(o => o.id)).toContain('blessed-warrior')
    expect(style('ranger', 2)?.choice.options.map(o => o.id)).toEqual(expect.arrayContaining(['archery', 'druidic-warrior', 'thrown-weapon-fighting']))
    expect(classChoiceDefs('fighter', '2024').find(c => c.id === 'fightingStyle')?.options.map(o => o.id)).not.toContain('superior-technique')
  })

  it('applies Archery, Defense and Blind Fighting to the sheet', () => {
    const base = make({}, ['longbow', 'leather'])
    const archer = make({ featureChoices: { 'fighter.fightingStyle': 'archery' } }, ['longbow', 'leather'])
    const bow = (c: Character) => derive(c).attacks.find(a => a.name === 'Longbow')!.bonus
    expect(bow(archer)).toBe(bow(base) + 2)
    expect(derive(make({ featureChoices: { 'fighter.fightingStyle': 'defense' } }, ['leather'])).armorClass.value).toBe(derive(make({}, ['leather'])).armorClass.value + 1)
    expect(derive(make({ featureChoices: { 'fighter.fightingStyle': 'defense' } })).armorClass.value).toBe(derive(make({})).armorClass.value)
    expect(derive(make({ featureChoices: { 'fighter.fightingStyle': 'blind-fighting' } })).senses.blindsight).toBe(10)
  })

  it('asks for more Favored Enemies and terrains unless Tasha\'s replacements are picked', () => {
    const ids = (featureChoices: Record<string, string>) => classChoices({ classes: [{ classId: 'ranger', level: 14 }], featureChoices }).map(x => x.choice.id)
    expect(ids({})).toEqual(expect.arrayContaining(['favoredEnemy2', 'favoredEnemy3', 'naturalExplorer2', 'naturalExplorer3']))
    const tashas = ids({ 'ranger.favoredEnemy': 'favored-foe', 'ranger.naturalExplorer': 'deft-explorer' })
    expect(tashas).not.toContain('favoredEnemy2')
    expect(tashas).not.toContain('naturalExplorer3')
  })

  it('gives Favored Foe uses and Deft Explorer speeds at 6th level', () => {
    const ranger = (level: number) => make({
      classes: [{ classId: 'ranger', level }], chosenSkills: ['survival', 'stealth', 'nature'],
      featureChoices: { 'ranger.favoredEnemy': 'favored-foe', 'ranger.naturalExplorer': 'deft-explorer', 'ranger.fightingStyle': 'archery' },
    })
    expect(derive(ranger(5)).resources.find(r => r.id === 'pick:ranger:favoredEnemy')).toMatchObject({ max: 3, recharge: 'long' })
    expect(derive(ranger(5)).speeds.climb).toBeUndefined()
    const six = derive(ranger(6))
    expect(six.speed).toBe(derive(ranger(5)).speed + 5)
    expect(six.speeds).toMatchObject({ climb: six.speed, swim: six.speed })
    expect(six.features.map(f => f.name)).toContain('Favored Enemy (Favored Foe)')
  })

  it('applies optional features: Primal Knowledge skill, Harness Divine Power uses, listed as features', () => {
    const barb = derive(make({ classes: [{ classId: 'barbarian', level: 3 }], featureChoices: { 'barbarian.primalKnowledge': 'nature' } }))
    expect(barb.skills.nature.proficient).toBe(true)
    const cleric = (level: number) => derive(make({ classes: [{ classId: 'cleric', level, subclassId: 'life' }], chosenSkills: ['history', 'medicine'], featureChoices: { 'cleric.harnessDivinePower': 'use' } }))
    expect(cleric(2).resources.find(r => r.id === 'pick:cleric:harnessDivinePower')?.max).toBe(1)
    expect(cleric(6).resources.find(r => r.id === 'pick:cleric:harnessDivinePower')?.max).toBe(2)
    expect(cleric(2).features.map(f => f.name)).toContain('Harness Divine Power')
    const skipped = derive(make({ classes: [{ classId: 'cleric', level: 2, subclassId: 'life' }], chosenSkills: ['history', 'medicine'], featureChoices: { 'cleric.harnessDivinePower': 'phb' } }))
    expect(skipped.features.map(f => f.name)).not.toContain('Harness Divine Power')
  })

  it('lists registered fighting styles (homebrew) in the pool', () => {
    registerClassOptions('homebrew', [{ id: 'hb:test:mariner', kind: 'fightingStyle', name: 'Mariner', text: 'Swim and climb.', classIds: ['fighter'], effects: [{ kind: 'ac', value: 1 }] }])
    expect(classChoiceDefs('fighter').find(c => c.id === 'fightingStyle')?.options.map(o => o.id)).toContain('hb:test:mariner')
    expect(classChoiceDefs('ranger').find(c => c.id === 'fightingStyle')?.options.map(o => o.id)).not.toContain('hb:test:mariner')
    expect(derive(make({ featureChoices: { 'fighter.fightingStyle': 'hb:test:mariner' } })).armorClass.value).toBe(derive(make({})).armorClass.value + 1)
    registerClassOptions('homebrew', [])
  })
  it('asks for Bard and Rogue Expertise, and Deft Explorer expertise only with Deft Explorer', () => {
    const ids = (classId: string, level: number, featureChoices?: Record<string, string>) => classPickSlots({ classes: [{ classId, level }], featureChoices }).map(s => `${s.pick.id}:${s.pick.count}`)
    expect(ids('bard', 2)).toEqual([])
    expect(ids('bard', 10)).toEqual(['expertise:2', 'expertise10:2'])
    expect(ids('rogue', 6)).toEqual(['expertise:2', 'expertise6:2'])
    expect(ids('ranger', 1)).toEqual([])
    expect(ids('ranger', 1, { 'ranger.naturalExplorer': 'deft-explorer' })).toEqual(['deftExplorer:1', 'deftExplorerLanguages:2'])
    const rogue = derive(make({ classes: [{ classId: 'rogue', level: 1 }], chosenSkills: ['stealth', 'acrobatics', 'deception', 'perception'], classPicks: { 'rogue.expertise': ['stealth', 'perception'] } }))
    expect(rogue.skills.stealth).toMatchObject({ expertise: true, bonus: rogue.skills.acrobatics.bonus + rogue.proficiencyBonus })
  })
})

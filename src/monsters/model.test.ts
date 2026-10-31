import { describe, expect, it } from 'vitest'
import {
  averageOf, blankMonster, hitPointsRollFor, monsterIssues, perceptionFromSkills, proficiencyForCr, proficientSave, proficientSkill, sanitizeMonsterBlock,
  toLibraryMonster, xpForCr, XP_BY_CR, CR_STEPS,
} from './model'

describe('monster tables', () => {
  it('matches the SRD XP and proficiency by challenge rating', () => {
    expect(xpForCr(0)).toBe(10)
    expect(xpForCr(0.5)).toBe(100)
    expect(xpForCr(5)).toBe(1800)
    expect(xpForCr(17)).toBe(18000)
    expect(xpForCr(30)).toBe(155000)
    expect(CR_STEPS.every(cr => cr in XP_BY_CR)).toBe(true)
    expect([0, 4, 5, 8, 9, 12, 13, 17, 21, 30].map(proficiencyForCr)).toEqual([2, 2, 3, 3, 4, 4, 5, 6, 7, 9])
  })

  it('does hit point and bonus arithmetic like a stat block', () => {
    expect(hitPointsRollFor(19, 'Huge', 25)).toBe('19d12+133')
    expect(averageOf('19d12+133')).toBe(256)
    expect(hitPointsRollFor(2, 'Medium', 8)).toBe('2d8-2')
    expect(averageOf('nonsense')).toBe(0)
    const m = { ...blankMonster(), abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 }, proficiencyBonus: 6 }
    expect(proficientSave(m, 'con')).toBe(13)
    expect(proficientSkill(m, 'perception')).toBe(7)
    expect(proficientSkill(m, 'perception', true)).toBe(13)
    expect(perceptionFromSkills({ ...m, skills: { perception: 13 } })).toBe(23)
    expect(perceptionFromSkills(m)).toBe(11)
  })
})

describe('monster validation', () => {
  it('needs a name, dice that parse and a legendary action when legendary', () => {
    const m = blankMonster()
    expect(monsterIssues(m)).toEqual(['Give the monster a name.'])
    m.name = 'Bog Hag'
    expect(monsterIssues(m)).toEqual([])
    m.actions.push({ name: 'Claw', description: '', damage: [{ dice: 'lots', type: 'slashing' }] })
    expect(monsterIssues(m)).toHaveLength(1)
    m.actions[0].damage[0].dice = '2d6+3'
    m.legendary = { actions: 3 }
    expect(monsterIssues(m)).toContain('A legendary creature needs at least one legendary action.')
    m.legendaryActions.push({ name: 'Detect', description: 'Looks.', damage: [] })
    expect(monsterIssues(m)).toEqual([])
  })
})

describe('sanitizeMonsterBlock', () => {
  it('rebuilds a full stat block and drops junk', () => {
    const raw = {
      id: 'ignored', name: 'Adult Red Dragon', sizes: ['Huge', 'Colossal'], type: 'Dragon', alignment: 'chaotic evil',
      armorClass: [{ value: 19, type: 'natural', extra: 1 }], hitPoints: 256, hitDice: '19d12', hitPointsRoll: '19d12+133',
      speed: { walk: '40 ft.', fly: '80 ft.', teleport: '10 ft.', hover: 'yes' },
      abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
      savingThrows: { dex: 6, con: 13, luck: 4 }, skills: { perception: 13, stealth: 6, cooking: 9 },
      damageImmunities: ['fire', 'fire'], conditionImmunities: [], senses: { blindsight: '60 ft.', darkvision: '120 ft.', passive_perception: 23, smell: 'x' },
      languages: 'Common, Draconic', challengeRating: 17, xp: 18000, proficiencyBonus: 6,
      traits: [{ name: 'Legendary Resistance', description: 'Succeeds instead.', damage: [], usage: { type: 'per day', times: 3 } }],
      actions: [
        { name: 'Bite', description: 'Chomp.', attackBonus: 14, damage: [{ dice: '2d10+8', type: 'piercing' }, { dice: '2d6', type: 'fire' }] },
        { name: 'Fire Breath', description: 'Cone.', damage: [{ dice: '18d6', type: 'fire' }], save: { ability: 'dex', dc: 21, onSuccess: 'half' }, usage: { type: 'recharge', dice: '1d6', minimum: 5 } },
        'not an action',
      ],
      legendaryActions: [{ name: 'Detect', description: 'Perception check.', damage: [] }],
      legendary: { actions: 3, resistance: 3 },
      lairActions: [{ name: 'Tremor', description: 'DC 15 DEX or prone.', damage: [], save: { ability: 'dex', dc: 15 } }],
      spellcasting: { ability: 'cha', saveDc: 19, groups: [{ label: 'At will', spells: ['Detect Magic', ''] }, { label: 'Empty', spells: [] }], note: 'innate' },
      secret: 'dropped',
    }
    const m = sanitizeMonsterBlock(raw, 'hb:pack:adult-red-dragon')
    expect(m.id).toBe('hb:pack:adult-red-dragon')
    expect(m.sizes).toEqual(['Huge'])
    expect(m.type).toBe('dragon')
    expect(m.armorClass).toEqual([{ value: 19, type: 'natural' }])
    expect(m.speed).toEqual({ walk: '40 ft.', fly: '80 ft.' })
    expect(m.savingThrows).toEqual({ dex: 6, con: 13 })
    expect(m.skills).toEqual({ perception: 13, stealth: 6 })
    expect(m.damageImmunities).toEqual(['fire'])
    expect(m.senses).toEqual({ blindsight: '60 ft.', darkvision: '120 ft.', passive_perception: 23 })
    expect(m.actions).toHaveLength(2)
    expect(m.actions[0].attackBonus).toBe(14)
    expect(m.actions[1].usage).toEqual({ type: 'recharge', dice: '1d6', minimum: 5 })
    expect(m.actions[1].save).toEqual({ ability: 'dex', dc: 21, onSuccess: 'half' })
    expect(m.traits[0].usage).toEqual({ type: 'per day', times: 3 })
    expect(m.legendary).toEqual({ actions: 3, resistance: 3 })
    expect(m.lairActions?.[0].save).toEqual({ ability: 'dex', dc: 15, onSuccess: 'none' })
    expect(m.spellcasting).toEqual({ ability: 'cha', saveDc: 19, groups: [{ label: 'At will', spells: ['Detect Magic'] }], note: 'innate' })
    expect('secret' in m).toBe(false)
    expect(monsterIssues(m)).toEqual([])
  })

  it('fills XP, proficiency and hit points from what it has', () => {
    const m = sanitizeMonsterBlock({ name: 'Ooze', challengeRating: 9, hitPointsRoll: '10d10+30' }, 'hb:p:ooze')
    expect(m.xp).toBe(5000)
    expect(m.proficiencyBonus).toBe(4)
    expect(m.hitPoints).toBe(85)
    expect(m.hitDice).toBe('10d10')
    expect(m.speed).toEqual({ walk: '30 ft.' })
    expect(sanitizeMonsterBlock({ challengeRating: 1.5 }, 'x').challengeRating).toBe(0)
    expect(sanitizeMonsterBlock(null, 'x').name).toBe('Unnamed monster')
  })

  it('stamps a block as a library monster', () => {
    const m = toLibraryMonster({ ...blankMonster(), id: 'hb:p:x', name: 'X' }, 'hb:p')
    expect(m.source).toBe('hb:p')
    expect(m.edition).toBe('2014')
  })
})

describe('monster editor styles', () => {
  it('uses logical properties and design tokens only', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(new URL('./form.css', import.meta.url), 'utf8')
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right|top|bottom):|(^|[\s;{])(width|height):/m)
    expect(css).not.toMatch(/#fff\b|rgba?\(\s*255/i)
  })
})

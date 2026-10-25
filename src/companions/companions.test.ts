import { describe, expect, it } from 'vitest'
import { parseNotation as parse } from '../dice'
import { makeCharacter } from '../sheet/fixtures'
import { CREATURES, creatureById } from './data/creatures'
import {
  canWildShapeInto, damageCompanion, familiarForms, formAbilities, formatCr, healCompanion, newCompanion, restoreCompanion,
  setMaxHp, tempHpCompanion, wildShapeForms, wildShapeLimits, wildShapeUses,
} from './rules'

const now = new Date('2026-10-25T00:00:00Z')
const druid = (level: number) => makeCharacter({ classes: [{ classId: 'druid', level }] })
const wolf = creatureById('wolf')!

describe('SRD creature data', () => {
  it('has unique ids and dice notation the roller accepts', () => {
    expect(new Set(CREATURES.map(c => c.id)).size).toBe(CREATURES.length)
    for (const c of CREATURES) {
      expect(() => parse(c.hitDice), c.id).not.toThrow()
      for (const a of c.actions) if (a.damage) expect(() => parse(a.damage!), `${c.id} ${a.name}`).not.toThrow()
    }
  })
})

describe('familiars', () => {
  it('offers the Find Familiar list to anyone', () => {
    const ids = familiarForms(makeCharacter()).map(c => c.id)
    expect(ids).toContain('owl')
    expect(ids).toContain('poisonous-snake')
    expect(ids).not.toContain('imp')
  })
  it('adds Pact of the Chain forms for a warlock 3+', () => {
    const ids = familiarForms(makeCharacter({ classes: [{ classId: 'warlock', level: 3 }] })).map(c => c.id)
    expect(ids).toEqual(expect.arrayContaining(['imp', 'pseudodragon', 'quasit', 'sprite']))
  })
})

describe('wild shape', () => {
  it('follows the SRD beast shapes table', () => {
    expect(wildShapeLimits(1)).toBeUndefined()
    expect(wildShapeLimits(2)).toEqual({ maxCr: 0.25, fly: false, swim: false, hours: 1 })
    expect(wildShapeLimits(4)).toEqual({ maxCr: 0.5, fly: false, swim: true, hours: 2 })
    expect(wildShapeLimits(8)).toEqual({ maxCr: 1, fly: true, swim: true, hours: 4 })
  })
  it('filters forms by CR and movement', () => {
    const l2 = wildShapeLimits(2)!
    expect(canWildShapeInto(wolf, l2)).toBe(true)
    expect(canWildShapeInto(creatureById('owl')!, l2)).toBe(false) // flies
    expect(canWildShapeInto(creatureById('poisonous-snake')!, l2)).toBe(false) // swims
    expect(canWildShapeInto(creatureById('black-bear')!, l2)).toBe(false) // CR 1/2
    expect(canWildShapeInto(creatureById('imp')!, wildShapeLimits(20)!)).toBe(false) // not a beast
    expect(wildShapeForms(druid(4)).map(c => c.id)).toContain('reef-shark')
    expect(wildShapeForms(druid(4)).map(c => c.id)).not.toContain('giant-eagle')
    expect(wildShapeForms(druid(8)).map(c => c.id)).toContain('giant-eagle')
    expect(wildShapeForms(makeCharacter())).toEqual([])
  })
  it('keeps the druid\'s mental scores', () => {
    const d = druid(2)
    const form = newCompanion({ kind: 'wildShape', name: 'Wolf', creature: wolf, owner: d }, 'f', now)
    const a = formAbilities(wolf, form, d)
    expect(a.str).toBe(12)
    expect(a.wis).toBe(11) // human +1
    expect(a.int).toBe(15)
  })
  it('reads uses from the druid resource', () => {
    expect(wildShapeUses(druid(2))).toEqual({ max: 2, left: 2 })
    const used = druid(2)
    used.state.resources['wild-shape'] = { used: 1 }
    expect(wildShapeUses(used).left).toBe(1)
  })
})

describe('companion hit points', () => {
  const owner = makeCharacter()
  const base = newCompanion({ kind: 'companion', name: '  ', creature: wolf, owner }, 'w', now)

  it('starts at average HP and takes the creature name when unnamed', () => {
    expect(base).toMatchObject({ name: 'Wolf', maxHp: 11, currentHp: 11, characterId: owner.id, ownerId: owner.ownerId, creatureId: 'wolf' })
  })
  it('uses temp HP first and reports overflow past 0', () => {
    const t = tempHpCompanion(base, 3)
    const r = damageCompanion(t, 5)
    expect(r.companion).toMatchObject({ tempHp: 0, currentHp: 9 })
    expect(r.overflow).toBe(0)
    const big = damageCompanion(base, 15)
    expect(big.companion.currentHp).toBe(0)
    expect(big.overflow).toBe(4)
  })
  it('heals up to max, temp HP does not stack, restore resets', () => {
    const hurt = damageCompanion(base, 8).companion
    expect(healCompanion(hurt, 100).currentHp).toBe(11)
    expect(tempHpCompanion(tempHpCompanion(base, 5), 3).tempHp).toBe(5)
    expect(restoreCompanion({ ...hurt, tempHp: 2 })).toMatchObject({ currentHp: 11, tempHp: 0 })
  })
  it('clamps current HP when max HP drops', () => {
    expect(setMaxHp(base, 6)).toMatchObject({ maxHp: 6, currentHp: 6 })
  })
  it('stores a custom creature inline', () => {
    const custom = { ...wolf, id: 'custom', name: 'Giant ferret' }
    const c = newCompanion({ kind: 'summon', name: '', creature: custom, owner, maxHp: 7 }, 'c', now)
    expect(c).toMatchObject({ creatureId: 'custom', name: 'Giant ferret', maxHp: 7 })
    expect(c.custom?.name).toBe('Giant ferret')
  })
})

it('formats challenge ratings', () => {
  expect([0, 0.125, 0.25, 0.5, 1].map(formatCr)).toEqual(['0', '1/8', '1/4', '1/2', '1'])
})

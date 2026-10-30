// Feature buttons that do their effect (UX audit unit 11): Magical Cunning, Breath Weapon, Bardic Inspiration,
// Wild Shape, Fiendish Vigor, Eldritch Smite, Thirsting Blade and the pact weapon's damage type.
import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import type { Character } from '../model/character'
import { breathArea, castsAtMax, derive, featureUseContext, getItemSpells, getResources, maxOfDice, planUse, wildShapeLimit } from '../rules'
import { summonPactWeapon } from '../inventory'
import { effectToggles } from './combat/combat'
import { makeCharacter } from './fixtures'
import { spendResource, withForm } from './uses'
import { beastAllowed, beastForm } from './wildShape'

const warlock = (over: Partial<Character> = {}) => makeCharacter({
  rulesEdition: '2024', classes: [{ classId: 'warlock', level: 7 }], baseAbilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 16 }, ...over,
})
const blade = [
  { kind: 'invocation' as const, id: 'pact-of-the-blade-2024', classId: 'warlock' },
  { kind: 'invocation' as const, id: 'eldritch-smite-2024', classId: 'warlock' },
  { kind: 'invocation' as const, id: 'thirsting-blade-2024', classId: 'warlock' },
]

describe('feature uses that do their effect', () => {
  it('Magical Cunning brings back half the pact slots, rounded up', () => {
    const c = warlock({ state: { ...warlock().state, pactSlotsUsed: 2 } })
    const plan = planUse('magical-cunning', 'Magical Cunning', featureUseContext(c, 'magical-cunning'))
    expect(plan.pactSlots).toBe(1)
    const used = spendResource(c, 'magical-cunning', plan)
    expect(used.state.pactSlotsUsed).toBe(1)
    expect(used.state.resources['magical-cunning'].used).toBe(1)
  })

  it('Breath Weapon rolls its damage with the ancestry, save DC and area', () => {
    const c = makeCharacter({ raceId: 'dragonborn', traitChoices: { draconicAncestry: 'blue' }, classes: [{ classId: 'bard', level: 3 }] })
    expect(getResources(c).some(r => r.id === 'race:breath-weapon')).toBe(true)
    const plan = planUse('race:breath-weapon', 'Breath Weapon', featureUseContext(c, 'race:breath-weapon'))
    // CON 14 (+2) +1 race = 15 (+2); PB 2 → DC 12
    expect(plan).toMatchObject({ hit: { dice: '2d6', type: 'lightning' }, save: { dc: 12, ability: 'dex' }, area: { line: [5, 30] } })
  })

  it('2024 Breath Weapon: PB uses per long rest, 1d10 to 4d10, cone or line', () => {
    const c = makeCharacter({ rulesEdition: '2024', raceId: 'dragonborn', traitChoices: { draconicAncestry: 'green' }, classes: [{ classId: 'fighter', level: 5 }] })
    const r = getResources(c).find(x => x.id === 'race:breath-weapon')
    expect(r).toMatchObject({ max: 3, recharge: 'long' })
    const plan = planUse('race:breath-weapon', 'Breath Weapon', featureUseContext(c, 'race:breath-weapon'))
    expect(plan).toMatchObject({ hit: { dice: '2d10', type: 'poison' }, area: { cone: 15, line: [5, 30] } })
    expect(breathArea('15 ft. cone (CON save)')).toEqual({ cone: 15 })
  })

  it('Bardic Inspiration gives the die for the bard level', () => {
    expect(planUse('bardic-inspiration', 'Bardic Inspiration', { edition: '2014', classLevel: 3 }).give).toBe('1d6')
    expect(planUse('bardic-inspiration', 'Bardic Inspiration', { edition: '2024', classLevel: 10 }).give).toBe('1d10')
  })

  it('Wild Shape picks a beast within the limits; 2024 gives temp HP equal to the druid level', async () => {
    expect(wildShapeLimit('2014', 2)).toEqual({ maxCr: 0.25, fly: false, swim: false })
    expect(wildShapeLimit('2024', 4)).toEqual({ maxCr: 0.5, fly: false, swim: true })
    expect(wildShapeLimit('2014', 9, true).maxCr).toBe(3)
    const c = makeCharacter({ rulesEdition: '2024', classes: [{ classId: 'druid', level: 4 }] })
    const plan = planUse('wild-shape', 'Wild Shape', featureUseContext(c, 'wild-shape'))
    expect(plan).toMatchObject({ tempHp: '4', form: { maxCr: 0.5 } })
    const beasts = (await loadKind('monsters', { edition: '2024' })).filter(m => m.type === 'beast')
    const wolf = beasts.find(m => m.id === 'wolf')!
    expect(beastAllowed(wolf, plan.form!)).toBe(true)
    expect(beasts.filter(m => m.speed.fly && beastAllowed(m, plan.form!))).toEqual([])
    const form = beastForm(wolf)
    expect(form).toMatchObject({ name: 'Wolf', ac: 12, attacks: [{ name: 'Bite', bonus: 4 }] })
    const shaped = spendResource(c, 'wild-shape', withForm(plan, form), { tempHp: 4 })
    expect(shaped.state.tempHp).toBe(4)
    expect(shaped.state.effects?.[0].form?.name).toBe('Wolf')
  })

  it('2024 Fiendish Vigor casts False Life at its maximum', () => {
    const c = warlock({ classOptions: [{ kind: 'invocation', id: 'fiendish-vigor-2024', classId: 'warlock' }] })
    const s = getItemSpells(c).find(x => x.spell === 'False Life')
    expect(castsAtMax(s?.note)).toBe(true)
    expect(maxOfDice('2d4+4')).toBe(12)
    expect(maxOfDice('1d4+4-1')).toBe(7)
  })

  it('Eldritch Smite switch spends a pact slot for force damage on the pact weapon only', () => {
    const c = summonPactWeapon(warlock({ classOptions: blade }), { itemId: 'longsword' })
    const smite = effectToggles(c, derive(c)).find(e => e.id === 'feature:eldritch-smite')
    // Warlock 7: 4th level pact slots → 5d8
    expect(smite).toMatchObject({ damage: '5d8', damageType: 'force', pactOnly: true, slot: { source: 'pact', level: 4 } })
  })

  it('Thirsting Blade gives the pact weapon two attacks; the pact weapon can deal psychic', () => {
    let c = summonPactWeapon(warlock({ classOptions: blade }), { itemId: 'longsword' })
    const pact = c.inventory.find(e => e.pact)!
    expect(derive(c).attacks.find(a => a.pact)).toMatchObject({ attacks: 2, damageType: 'slashing' })
    c = { ...c, inventory: c.inventory.map(e => (e.uid === pact.uid ? { ...e, damageType: 'psychic' } : e)) }
    expect(derive(c).attacks.find(a => a.pact)?.damageType).toBe('psychic')
    // A new pact weapon keeps the chosen type.
    c = summonPactWeapon(c, { itemId: 'rapier' })
    expect(derive(c).attacks.find(a => a.pact)).toMatchObject({ name: 'Rapier', damageType: 'psychic' })
    // Extra Attack counts too.
    expect(derive(makeCharacter({ inventory: [{ uid: 'a', itemId: 'longsword', qty: 1, equipped: true }] })).attacks[0].attacks).toBe(2)
  })
})

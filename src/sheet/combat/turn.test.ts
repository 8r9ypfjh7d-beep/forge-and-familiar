import { describe, expect, it } from 'vitest'
import { loadKind } from '../../content'
import { spellSourcesFor } from '../../spellbook/access'
import { castingKind, derive, featureActionKind, planUse } from '../../rules'
import { summonPactWeapon } from '../../inventory'
import { makeCharacter } from '../fixtures'
import { turnActions, type TurnRow } from './turn'

const names = (rows: TurnRow[]) => rows.map(r => (r.type === 'spell' ? r.spell.name : r.type === 'resource' ? r.resource.label : r.type === 'feature' ? r.name : 'pact'))

describe('turn action lists', () => {
  it('reads the group from a casting time in both editions', () => {
    expect(castingKind('1 action')).toBe('action')
    expect(castingKind('Action')).toBe('action')
    expect(castingKind('Bonus Action, right after you hit')).toBe('bonus')
    expect(castingKind('1 reaction, which you take when you are hit')).toBe('reaction')
    expect(castingKind('1 minute')).toBe('other')
    expect(featureActionKind('Lay on Hands (HP pool)', '2014')).toBe('action')
    expect(featureActionKind('Lay on Hands (HP pool)', '2024')).toBe('bonus')
    expect(featureActionKind('Fireball', '2014')).toBeUndefined()
  })

  it('hides a filled-in row the player wrote as their own action, and action uses', () => {
    const c = makeCharacter({
      classes: [{ classId: 'fighter', level: 3 }], spells: [],
      customActions: [{ id: 'sw', kind: 'bonus', name: 'Second Wind' }, { id: 'od', kind: 'bonus', name: 'Overdrive', uses: { count: 1, recharge: 'long' } }],
    })
    const turn = turnActions(c, derive(c), { spells: [] })
    const all = Object.values(turn).flat().map(r => names([r])[0])
    expect(all).not.toContain('Second Wind')
    expect(all).not.toContain('Overdrive')
  })

  it('fills a fighter rogue turn with Second Wind, Action Surge and Cunning Action', () => {
    const c = makeCharacter({ classes: [{ classId: 'fighter', level: 3 }, { classId: 'rogue', level: 5 }], spells: [] })
    const turn = turnActions(c, derive(c), { spells: [] })
    expect(names(turn.bonus)).toEqual(expect.arrayContaining(['Second Wind', 'Cunning Action']))
    expect(names(turn.free)).toContain('Action Surge')
    expect(names(turn.reaction)).toContain('Uncanny Dodge')
    // Cunning Action is a reminder: nothing to spend.
    const cunning = turn.bonus.find(r => r.type === 'feature' && r.name === 'Cunning Action')
    expect(cunning).not.toHaveProperty('spend')
  })

  it('puts warlock spells under their casting time and leaves table spells in the table', async () => {
    const spells = await loadKind('spells', { sources: spellSourcesFor('2014') })
    const c = makeCharacter({
      classes: [{ classId: 'warlock', level: 5 }], spellEdition: '2014',
      spells: ['eldritch-blast', 'hex', 'hellish-rebuke', 'armor-of-agathys', 'mage-hand'].map(id => ({ id, classId: 'warlock' })),
    })
    const turn = turnActions(c, derive(c), { spells, inTable: new Set(['eldritch blast']) })
    expect(names(turn.bonus)).toContain('Hex')
    expect(names(turn.reaction)).toContain('Hellish Rebuke')
    expect(names(turn.action)).toEqual(expect.arrayContaining(['Armor of Agathys', 'Mage Hand']))
    expect(names(turn.action)).not.toContain('Eldritch Blast')
  })

  it("gives Dark One's Blessing a Use and Pact of the Blade a summon row", () => {
    const c = makeCharacter({
      classes: [{ classId: 'warlock', level: 5, subclassId: 'fiend' }], spells: [],
      baseAbilities: { str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 16 },
      classOptions: [{ kind: 'pactBoon', id: 'pact-of-the-blade', classId: 'warlock' }],
    })
    const d = derive(c)
    const turn = turnActions(c, d, { spells: [] })
    const blessing = turn.free.find(r => r.type === 'feature' && r.name === "Dark One's Blessing")
    expect(blessing).toMatchObject({ use: 'dark-ones-blessing' })
    expect(turn.action.some(r => r.type === 'pact')).toBe(true)
    // CHA +3 (16) + warlock level 5
    expect(planUse('dark-ones-blessing', "Dark One's Blessing", { edition: '2014', classLevel: 5, mods: d.mods }).tempHp).toBe(String(d.mods.cha + 5))
  })

  it('summons a pact weapon: one of yours, or a conjured one, in hand', () => {
    let c = makeCharacter({ inventory: [{ uid: 'a', itemId: 'longsword', qty: 1, equipped: false }] })
    c = summonPactWeapon(c, { uid: 'a' })
    expect(c.inventory.find(e => e.uid === 'a')).toMatchObject({ pact: true, equipped: true })
    c = summonPactWeapon(c, { itemId: 'greataxe' })
    expect(c.inventory.filter(e => e.pact).map(e => e.itemId)).toEqual(['greataxe'])
    expect(c.inventory.find(e => e.itemId === 'greataxe')?.equipped).toBe(true)
  })
})

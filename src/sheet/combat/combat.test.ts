import { describe, expect, it } from 'vitest'
import { loadKind } from '../../content'
import { derive, xpForNextLevel } from '../../rules'
import { makeCharacter } from '../fixtures'
import { actionRoll, actionsOf, addAction, effectToggles, resolveDice, masteryLimit, removeAction, spellAttackRows, updateAction } from './combat'

const warlock = (over = {}) => makeCharacter({
  classes: [{ classId: 'warlock', level: 7 }],
  baseAbilities: { str: 15, dex: 13, con: 15, int: 9, wis: 10, cha: 17 },
  spells: [{ id: 'eldritch-blast', classId: 'warlock' }, { id: 'charm-person', classId: 'warlock' }, { id: 'hex', classId: 'warlock' }],
  spellEdition: '2024',
  ...over,
})

describe('combat page helpers', () => {
  it('xp for the next level follows the SRD table', () => {
    expect(xpForNextLevel(1)).toBe(300)
    expect(xpForNextLevel(7)).toBe(34000)
    expect(xpForNextLevel(20)).toBeUndefined()
  })

  it('lists attack and save spells with range, bonus or DC, and scaled damage', async () => {
    const spells = await loadKind('spells', { sources: ['srd-5.2'] })
    const c = warlock()
    const rows = spellAttackRows(c, derive(c), spells)
    const blast = rows.find(r => r.name === 'Eldritch Blast')
    expect(blast).toMatchObject({ kind: 'attack', value: derive(c).spellcasting?.attackBonus, level: 0 })
    expect(blast?.range).toMatch(/120/)
    expect(blast?.damage).toBe('2d10')
    expect(rows.find(r => r.name === 'Charm Person')).toMatchObject({ kind: 'save', save: 'wis', value: derive(c).spellcasting?.saveDc })
  })

  it('adds pinned typed-in spells that are not in the library', () => {
    const c = warlock({ spells: [], quickCast: [{ id: 'q', kind: 'spell', name: 'Charm Monster', level: 4, roll: 'save', save: 'wis' }] })
    expect(spellAttackRows(c, derive(c), []).map(r => r.name)).toEqual(['Charm Monster'])
  })

  it('offers Hex as an effect when known, and Rage/Sneak Attack only to those classes', () => {
    const c = warlock()
    expect(effectToggles(c, derive(c), { hex: 'Hex' })).toEqual([{ id: 'hex', name: 'Hex', damage: '1d6', damageType: 'necrotic' }])
    const rogue = makeCharacter({ classes: [{ classId: 'rogue', level: 5 }], inventory: [{ uid: 'd', itemId: 'dagger', qty: 1, equipped: true }] })
    expect(effectToggles(rogue, derive(rogue)).map(e => e.id)).toEqual(['sneakAttack'])
  })

  it('keeps the player\'s own actions by group, and edits and removes them', () => {
    let c = warlock()
    c = addAction(c, { id: 'a1', kind: 'bonus', name: '  Curse Another ', description: ' ' })
    c = addAction(c, { id: 'a2', kind: 'action', name: '' })
    expect(c.customActions).toEqual([{ id: 'a1', kind: 'bonus', name: 'Curse Another', description: undefined }])
    c = updateAction(c, 'a1', { kind: 'reaction', description: 'Move the curse' })
    expect(actionsOf(c, 'bonus')).toEqual([])
    expect(actionsOf(c, 'reaction')[0]).toMatchObject({ name: 'Curse Another', description: 'Move the curse' })
    expect(removeAction(c, 'a1').customActions).toEqual([])
  })

  it('weapon mastery needs the 2024 rules and a martial class', () => {
    expect(masteryLimit({ classes: [{ classId: 'warlock', level: 7 }], spellEdition: '2024' })).toBe(0)
    expect(masteryLimit({ classes: [{ classId: 'fighter', level: 4 }], spellEdition: '2024' })).toBe(4)
    expect(masteryLimit({ classes: [{ classId: 'fighter', level: 4 }] })).toBe(0)
  })

  it('weapon attacks carry reach and range for the table', () => {
    const c = makeCharacter({ inventory: [{ uid: 'd', itemId: 'dagger', qty: 1, equipped: true }] })
    const dagger = derive(c).attacks.find(a => a.name === 'Dagger')
    expect(dagger).toMatchObject({ itemId: 'dagger', reach: 5, range: '20/60' })
    expect(derive(c).attacks.at(-1)).toMatchObject({ name: 'Unarmed Strike', reach: 5 })
  })

  it('fills STR…CHA, PROF and LEVEL into an action\'s dice', () => {
    const d = { ...derive(warlock()), mods: { str: 2, dex: 1, con: 2, int: -1, wis: 0, cha: 3 } }
    expect(resolveDice('1d8+CHA', d)).toBe('1d8+3')
    expect(resolveDice('1d8 + int', d)).toBe('1d8-1')
    expect(resolveDice('1d8-INT', d)).toBe('1d8+1')
    expect(resolveDice('2d6+PROF', d)).toBe('2d6+3')
    expect(resolveDice('LEVEL', d)).toBe('7')
    expect(resolveDice('', d)).toBeUndefined()
    expect(resolveDice('lots', d)).toBeUndefined()
  })

  it('rolls an action as an attack or a save DC, and lists its effect as a toggle', () => {
    let c = warlock({ spells: [] })
    c = addAction(c, { id: 'a', kind: 'action', name: 'Oil Flask', roll: { check: 'save', ability: 'dex', save: 'dex', dice: '5' } })
    c = addAction(c, { id: 'b', kind: 'bonus', name: 'Smite', roll: { check: 'attack', ability: 'cha', dice: '1d8+CHA', type: 'force' }, effect: { damage: '1d4', type: 'psychic' } })
    const d = { ...derive(c), mods: { str: 2, dex: 1, con: 2, int: -1, wis: 0, cha: 3 }, proficiencyBonus: 3 }
    expect(actionRoll(c.customActions![0], d)).toEqual({ dc: 12, save: 'dex', dice: '5' })
    expect(actionRoll(c.customActions![1], d)).toEqual({ attackBonus: 6, dice: '1d8+3' })
    expect(effectToggles(c, d)).toEqual([{ id: 'act:b', name: 'Smite', damage: '1d4', damageType: 'psychic' }])
  })
})

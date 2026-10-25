import { describe, expect, it } from 'vitest'
import { loadKind } from '../../content'
import { derive, xpForNextLevel } from '../../rules'
import { makeCharacter } from '../fixtures'
import { actionGroups, castingKind, effectToggles, featureKind, masteryLimit, spellAttackRows } from './combat'

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

  it('reads casting times and feature text into action kinds', () => {
    expect(castingKind('1 bonus action')).toBe('bonus')
    expect(castingKind('1 reaction, which you take when you are hit')).toBe('reaction')
    expect(castingKind('1 action')).toBe('action')
    expect(castingKind('1 minute')).toBeUndefined()
    expect(featureKind('As a bonus action, you can conjure a pact weapon.')).toBe('bonus')
    expect(featureKind('you can use your reaction to halve the damage')).toBe('reaction')
    expect(featureKind('You can use your action to present your holy symbol')).toBe('action')
    expect(featureKind('Your speed increases by 10 feet.')).toBeUndefined()
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

  it('groups standard actions with bonus-action spells', async () => {
    const spells = await loadKind('spells', { sources: ['srd-5.2'] })
    const c = warlock()
    const g = actionGroups(c, derive(c), spells, [])
    expect(g.action.map(l => l.id)).toContain('dodge')
    expect(g.reaction.map(l => l.id)).toContain('opportunity')
    expect(g.bonus.map(l => l.id)).toContain('hex')
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
})

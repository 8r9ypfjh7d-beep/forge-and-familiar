/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadKind } from '../../content'
import { derive, xpForNextLevel } from '../../rules'
import { makeCharacter } from '../fixtures'
import { actionRoll, actionsOf, addAction, effectToggles, effectsUsed, masteredWeapons, resolveDice, setActionActive, masteryLimit, removeAction, spellAttackRows, updateAction } from './combat'

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

  it('lists the masteries the player picked, falling back to attack weapons on older saves', () => {
    const fighter = { classes: [{ classId: 'fighter', level: 1 }], rulesEdition: '2024' as const }
    expect(masteredWeapons({ ...fighter, weaponMasteries: ['greatsword', 'longbow', 'dagger', 'maul'] })).toEqual([
      { itemId: 'greatsword', mastery: 'graze' }, { itemId: 'longbow', mastery: 'slow' }, { itemId: 'dagger', mastery: 'nick' },
    ])
    expect(masteredWeapons(fighter, ['longsword'])).toEqual([{ itemId: 'longsword', mastery: 'sap' }])
  })

  it('adds WIS to cleric cantrip damage with Potent Spellcasting', async () => {
    const spells = await loadKind('spells', { sources: ['srd-5.2'] })
    const cleric = (pick: string) => makeCharacter({
      rulesEdition: '2024', classes: [{ classId: 'cleric', level: 7 }], featureChoices: { 'cleric.blessedStrikes': pick },
      baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }, spells: [{ id: 'sacred-flame', classId: 'cleric' }],
    })
    const flame = (pick: string) => { const c = cleric(pick); return spellAttackRows(c, derive(c), spells).find(r => r.name === 'Sacred Flame')?.damage }
    const base = flame('divine-strike')
    expect(base).toMatch(/^2d8$/)
    expect(flame('potent-spellcasting')).toBe(`${base}+${derive(cleric('x')).mods.wis}`)
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

  it('applies an action\'s stat changes only while it is switched on', () => {
    const c0 = addAction(warlock({ spells: [], inventory: [{ uid: 'd', itemId: 'dagger', qty: 1, equipped: true }] }), {
      id: 'r', kind: 'bonus', name: 'Battle Stance',
      stats: [{ kind: 'ac', value: 2 }, { kind: 'attack', value: 1 }, { kind: 'damage', value: 2 }, { kind: 'saves', value: 1 }, { kind: 'ability', ability: 'str', value: 2, max: 20 }, { kind: 'initiative', value: 5 }, { kind: 'speed', value: 10 }],
    })
    const off = derive(c0)
    const on = derive(setActionActive(c0, 'r', true))
    expect(on.armorClass.value).toBe(off.armorClass.value + 2)
    expect(on.abilities.str).toBe(off.abilities.str + 2)
    expect(on.saves.wis.bonus).toBe(off.saves.wis.bonus + 1)
    expect(on.initiative).toBe(off.initiative + 5)
    expect(on.speed).toBe(off.speed + 10)
    const dagger = (d: typeof on) => d.attacks.find(a => a.name === 'Dagger')!
    // +1 STR mod from the ability bump can't matter for a finesse dagger with DEX higher, so only the flat bonuses show.
    expect(dagger(on).bonus - dagger(off).bonus).toBeGreaterThanOrEqual(1)
    expect(effectToggles(c0, off).find(e => e.id === 'act:r')?.stats).toHaveLength(7)
    expect(derive(setActionActive(setActionActive(c0, 'r', true), 'r', false))).toEqual(off)
  })

  it('names the effects that went into a roll and only the stats that touch it', () => {
    const active = [
      { id: 'hex', name: 'Hex', damage: '1d6', damageType: 'necrotic' },
      { id: 'act:s', name: 'Battle Stance', stats: [{ kind: 'ac' as const, value: 2 }, { kind: 'attack' as const, value: 1 }] },
      { id: 'act:z', name: 'Ward', stats: [{ kind: 'ac' as const, value: 1 }] },
    ]
    expect(effectsUsed(active, ['hex'], f => f.kind === 'attack')).toEqual([
      { id: 'hex', name: 'Hex', damage: '1d6', damageType: 'necrotic', stats: [] },
      { id: 'act:s', name: 'Battle Stance', stats: [{ kind: 'attack', value: 1 }] },
    ])
    // A miss rolls no damage, so Hex isn't listed.
    expect(effectsUsed(active, [], f => f.kind === 'attack').map(e => e.name)).toEqual(['Battle Stance'])
  })
})

describe('combat page styles', () => {
  // The combat-only part of combat.css follows the Liquid Glass standard (src/design/DESIGN.md).
  const css = readFileSync(new URL('./combat.css', import.meta.url), 'utf8')
  const own = css.slice(css.indexOf('/* ---- Combat-only parts'))

  it('builds its surfaces from glass tokens, with no hard-coded backdrop blur', () => {
    expect(own).toMatch(/var\(--glass-/)
    expect(own).not.toMatch(/backdrop-filter:\s*blur/)
  })

  it('uses logical properties only, so RTL needs no overrides', () => {
    expect(own).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
  })

  it('gives high contrast an edge where state is shown by fill', () => {
    expect(own).toMatch(/:root\[data-contrast="high"\] \.cs-tablist button\.on/)
    expect(own).toMatch(/:root\[data-contrast="high"\] \.cs-switch input/)
  })
})

/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadKind } from '../../content'
import { BOOK_SUBCLASSES, BOOK_SUBCLASSES_2024, CLASSES, CLASSES_2024, SUBCLASSES, SUBCLASSES_2024, derive, xpForNextLevel } from '../../rules'
import { en } from '../../i18n/locales/en'
import { makeCharacter } from '../fixtures'
import { actionRoll, actionsOf, addAction, effectToggles, effectsUsed, featureDescription, masteredWeapons, resolveDice, setActionActive, masteryLimit, removeAction, spellAttackRows, updateAction } from './combat'

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
    expect(blast).toMatchObject({ damage: '1d10', beams: 2 })
    // Agonizing Blast adds CHA to each beam.
    const ag = warlock({ classOptions: [{ kind: 'invocation', id: 'agonizing-blast', classId: 'warlock' }] })
    expect(spellAttackRows(ag, derive(ag), spells).find(r => r.name === 'Eldritch Blast')).toMatchObject({ damage: `1d10+${derive(ag).mods.cha}`, beams: 2 })
    expect(rows.find(r => r.name === 'Charm Person')).toMatchObject({ kind: 'save', save: 'wis', value: derive(c).spellcasting?.saveDc })
  })

  it('adds pinned typed-in spells that are not in the library', () => {
    const c = warlock({ spells: [], quickCast: [{ id: 'q', kind: 'spell', name: 'Charm Monster', level: 4, roll: 'save', save: 'wis' }] })
    expect(spellAttackRows(c, derive(c), []).map(r => r.name)).toEqual(['Charm Monster'])
  })

  it('offers Hex as an effect when known, and Rage/Sneak Attack only to those classes', async () => {
    const spells = await loadKind('spells', { sources: ['srd-5.2'] })
    const c = warlock()
    const hex = effectToggles(c, derive(c), spells)
    expect(hex).toHaveLength(1)
    expect(hex[0]).toMatchObject({ id: 'spell:hex', name: 'Hex', damage: '1d6', damageType: 'necrotic', start: { concentration: true, level: 4 }, slot: { source: 'pact', level: 4 } })
    // Switching it on casts the spell itself (Effects.tsx hands it to Cast).
    expect(hex[0].spell?.id).toBe('hex')
    // Once running, the switch reads the saved effect.
    const on = { ...c, state: { ...c.state, effects: [{ ...hex[0].start!, on: true }] } }
    expect(effectToggles(on, derive(on), spells)[0].live?.on).toBe(true)
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
    // A 2014 Fighter has no Weapon Mastery, so the Combat tab shows no mastery box.
    expect(masteryLimit({ classes: [{ classId: 'fighter', level: 3 }], spellEdition: '2014' })).toBe(0)
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

// Same-name subclass features whose rules really are the same, so they may share a summary.
const SAME_RULES: Record<string, string[]> = {
  'Bonus Proficiency': ['life', 'nature'],
  'Bonus Proficiencies': ['tempest', 'twilight', 'war'],
  'Channel Divinity: Guided Strike': ['war', 'conquest'],
  'Potent Spellcasting': ['arcana', 'grave', 'knowledge', 'light', 'peace'],
  'Extra Attack': ['armorer-dreadnaught', 'armorer-guardian', 'armorer-infiltrator', 'battle-smith', 'swords', 'valor', 'college-of-valor', 'bladesinger'],
}
// Versions of one subclass (genie-dao, armorer-guardian) share their features.
const family = (id: string) => id.replace(/-(dao|djinni|efreeti|marid|dreadnaught|guardian|infiltrator)$/, '')

describe('feature text on the sheet', () => {
  const editions = [
    ['2014', [...SUBCLASSES, ...BOOK_SUBCLASSES], CLASSES],
    ['2024', [...SUBCLASSES_2024, ...BOOK_SUBCLASSES_2024], CLASSES_2024],
  ] as const
  const texts = async (edition: '2014' | '2024') => {
    const [, subclasses, classes] = editions.find(e => e[0] === edition)!
    const lib = await loadKind('features', { edition })
    return subclasses.flatMap(s => s.features.map(f => ({
      sub: s.id, name: f.name,
      text: featureDescription(lib, { name: f.name, className: classes.find(c => c.id === s.classId)?.name ?? s.classId, subclassId: s.id }, k => en[k]),
    })))
  }

  it('shows each subclass its own text, not another subclass\'s SRD entry', async () => {
    const t14 = await texts('2014')
    const text = (sub: string, name: string) => t14.find(f => f.sub === sub && f.name === name)?.text
    expect(text('valor', 'Bonus Proficiencies')).toBe(en['why.subfeature.valor.Bonus Proficiencies'])
    expect(text('order', 'Bonus Proficiencies')).toBe(en['why.subfeature.order.Bonus Proficiencies'])
    expect(text('lore', 'Bonus Proficiencies')).toMatch(/^When you join the College of Lore/)
    expect(text('valor', 'Extra Attack')).toBe(en['why.feature.Extra Attack'])
  })

  it('gives no two subclasses the same text for a shared name unless the rules match', async () => {
    for (const [edition] of editions) {
      const byText = new Map<string, Set<string>>()
      for (const f of await texts(edition)) {
        expect(f.text, `${edition} ${f.sub}: ${f.name}`).toBeTruthy()
        const k = `${f.name}\n${f.text}`
        byText.set(k, (byText.get(k) ?? new Set()).add(f.sub))
      }
      const clashes = [...byText].flatMap(([k, subs]) => {
        const name = k.slice(0, k.indexOf('\n'))
        const left = [...subs].filter(s => !SAME_RULES[name]?.includes(s))
        return new Set(left.map(family)).size > 1 ? [`${edition} ${name}: ${left.join(', ')}`] : []
      })
      expect(clashes).toEqual([])
    }
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

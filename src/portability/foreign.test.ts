import { describe, expect, it } from 'vitest'
import { getAbilityScores, getMaxHp } from '../rules'
import { parseAnyFile } from './actions'
import { exportCharacter } from './file'
import { NOT_A_CHARACTER, detectForeign, parseForeign, readDicecloud, readFoundry } from './foreign'

const NOW = new Date('2026-10-29T08:00:00Z')
const spellIds = new Map([['magic missile', 'magic-missile'], ['shield', 'shield']])

/** A dnd5e 3.x actor export, trimmed to what the importer reads. */
const foundry = () => ({
  name: 'Elara Moonwhisper',
  type: 'character',
  img: 'worlds/x/elara.webp',
  system: {
    abilities: { str: { value: 8 }, dex: { value: 14 }, con: { value: 13 }, int: { value: 17 }, wis: { value: 12 }, cha: { value: 10 } },
    attributes: { hp: { value: 99, temp: 3 } },
    details: { alignment: 'Neutral Good', xp: { value: 900 }, biography: { value: '<p>Raised in a <b>library</b>.</p>' } },
    skills: { arc: { value: 1 }, his: { value: 2 }, prc: { value: 1 }, ath: { value: 0 } },
    traits: { languages: { value: ['common', 'elvish', 'draconic'], custom: 'Thieves Cant; Elderspeak' } },
    currency: { pp: 1, gp: 12, ep: 2, sp: 3, cp: 4 },
  },
  items: [
    { type: 'race', name: 'High Elf', system: {} },
    { type: 'background', name: 'Sage', system: {} },
    { type: 'class', name: 'Wizard', system: { identifier: 'wizard', levels: 3 } },
    { type: 'subclass', name: 'School of Evocation', system: { classIdentifier: 'wizard' } },
    { type: 'weapon', name: 'Quarterstaff', system: { quantity: 1, equipped: true } },
    { type: 'consumable', name: 'Potion of Healing', system: { quantity: 2 } },
    { type: 'spell', name: 'Magic Missile', system: {} },
    { type: 'spell', name: 'Shield', system: { sourceClass: 'wizard' } },
    { type: 'spell', name: 'Unwritten Hex', system: {} },
    { type: 'feat', name: 'Arcane Recovery', system: {} },
  ],
})

/** A Dicecloud v2 /api/creature response, trimmed. */
const dicecloud = () => ({
  creatures: [{ name: 'Brakka', alignment: 'Chaotic Neutral' }],
  creatureVariables: [{
    strength: { value: 17 }, dexterity: { value: 12 }, constitution: { value: 16 },
    intelligence: { value: 8 }, wisdom: { value: 10 }, charisma: { value: 10 },
    hitPoints: { value: 20 },
    athletics: { proficiency: 1 }, intimidation: { proficiency: 1 }, survival: { proficiency: 2 },
  }],
  creatureProperties: [
    { _id: 'r', type: 'folder', name: 'Half-Orc', tags: ['race'] },
    { _id: 'c', type: 'class', name: 'Barbarian', variableName: 'barbarian' },
    { type: 'classLevel', variableName: 'barbarian', level: 1 },
    { type: 'classLevel', variableName: 'barbarian', level: 2 },
    { type: 'item', name: 'Greataxe', quantity: 1, equipped: true },
    { type: 'item', name: 'Gold piece', quantity: 15 },
    { type: 'item', name: 'Lucky Rock', quantity: 1 },
    { type: 'item', name: 'Old Shield', quantity: 1, removed: true },
    { type: 'note', name: 'Backstory', summary: { text: 'Left the clan.' } },
  ],
})

describe('detectForeign', () => {
  it('tells the formats apart', () => {
    expect(detectForeign(foundry())).toBe('foundry')
    expect(detectForeign(dicecloud())).toBe('dicecloud')
    expect(detectForeign({ format: 'forge-and-familiar/character' })).toBeNull()
    expect(detectForeign([1, 2])).toBeNull()
  })
})

describe('Foundry VTT', () => {
  it('reads the actor', () => {
    const s = readFoundry(foundry())
    expect(s.classes).toEqual([{ name: 'wizard', level: 3, subclass: 'School of Evocation' }])
    expect(s.race).toEqual(['High Elf'])
    expect(s.skills).toEqual(['arcana', 'history', 'perception'])
    expect(s.expertise).toEqual(['history'])
    expect(s.notes).toBe('Raised in a library.')
  })

  it('maps onto SRD ids and keeps final scores', () => {
    const r = parseForeign(foundry(), { spellIds }, NOW)
    if (!r.ok) throw new Error(r.error)
    const c = r.file.character
    expect(c).toMatchObject({ name: 'Elara Moonwhisper', raceId: 'elf', subraceId: 'high-elf', alignment: 'Neutral Good', xp: 900 })
    expect(c.classes).toEqual([{ classId: 'wizard', level: 3, subclassId: 'evocation' }])
    // High Elf gives +2 DEX, +1 INT: the stored base is lower, the final score matches Foundry.
    expect(c.baseAbilities).toMatchObject({ dex: 12, int: 16 })
    expect(getAbilityScores(c)).toMatchObject({ str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 })
    // Perception comes from the elf, so it is not a chosen skill.
    expect(c.chosenSkills).toEqual(['arcana', 'history'])
    expect(c.chosenLanguages).toEqual(['Draconic', "Thieves' Cant"])
    expect(c.coins).toEqual({ gp: 22, sp: 13, cp: 4 })
    expect(c.spells).toEqual([{ id: 'magic-missile', classId: 'wizard' }, { id: 'shield', classId: 'wizard' }])
    expect(c.inventory.find(i => i.itemId === 'quarterstaff')?.equipped).toBe(true)
    expect(c.inventory.find(i => i.itemId === 'potion-healing')?.qty).toBe(2)
    expect(c.state.currentHp).toBe(getMaxHp(c))
    expect(c.state.tempHp).toBe(3)
    expect(c.notes).toContain('Imported from Foundry VTT on 2026-10-29.')
    for (const miss of ['Spell: Unwritten Hex', 'Expertise: History', 'Language: Elderspeak']) expect(c.notes).toContain(miss)
  })

  it('reads older actors that use data and text race', () => {
    const { system, ...rest } = foundry()
    const old = { ...rest, data: { ...system, details: { ...system.details, race: 'Hill Dwarf', background: 'Acolyte' } }, items: rest.items.filter(i => i.type === 'class') }
    const r = parseForeign(old, {}, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.file.character).toMatchObject({ raceId: 'dwarf', subraceId: 'hill-dwarf', backgroundId: 'acolyte' })
  })

  it('refuses a class the app does not know', () => {
    const f = foundry()
    f.items = f.items.map(i => (i.type === 'class' ? { ...i, name: 'Blood Hunter', system: { identifier: 'blood-hunter', levels: 2 } } : i))
    expect(parseForeign(f)).toEqual({ ok: false, error: 'Class "blood-hunter" is not in the SRD, so Forge & Familiar cannot import it.' })
  })

  it('imports an Artificer', () => {
    const f = foundry()
    f.items = f.items.map(i => (i.type === 'class' ? { ...i, name: 'Artificer', system: { identifier: 'artificer', levels: 2 } } : i))
    const r = parseForeign(f, {}, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.file.character.classes[0]).toMatchObject({ classId: 'artificer', level: 2 })
  })

  it('imports an unknown race as Human and says so', () => {
    const f = foundry()
    f.items = f.items.map(i => (i.type === 'race' ? { ...i, name: 'Moonfolk Wobbler' } : i))
    const r = parseForeign(f, {}, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.file.character.raceId).toBe('human')
    expect(r.file.character.notes).toContain('Race: Moonfolk Wobbler (imported as Human')
  })
})

describe('Dicecloud', () => {
  it('reads the creature', () => {
    const s = readDicecloud(dicecloud())
    expect(s.classes).toEqual([{ name: 'Barbarian', level: 2 }])
    expect(s.coins.gp).toBe(15)
    expect(s.items.map(i => i.name)).toEqual(['Greataxe', 'Lucky Rock'])
    expect(s.notes).toBe('Backstory\nLeft the clan.')
  })

  it('maps onto SRD ids', () => {
    const r = parseForeign(dicecloud(), {}, NOW)
    if (!r.ok) throw new Error(r.error)
    const c = r.file.character
    expect(c).toMatchObject({ name: 'Brakka', raceId: 'half-orc', alignment: 'Chaotic Neutral', coins: { gp: 15, sp: 0, cp: 0 } })
    expect(c.classes).toEqual([{ classId: 'barbarian', level: 2 }])
    expect(getAbilityScores(c)).toMatchObject({ str: 17, con: 16, int: 8 })
    // Half-Orc grants Intimidation.
    expect(c.chosenSkills).toEqual(['athletics', 'survival'])
    expect(c.state.currentHp).toBe(Math.min(20, getMaxHp(c)))
    expect(c.inventory.map(i => i.itemId)).toEqual(['greataxe', 'import-lucky-rock'])
  })
})

describe('parseAnyFile', () => {
  it('still reads Forge & Familiar files', async () => {
    const r = parseForeign(foundry(), {}, NOW)
    if (!r.ok) throw new Error(r.error)
    const again = await parseAnyFile(exportCharacter(r.file.character))
    expect(again.ok && again.file.character.name).toBe('Elara Moonwhisper')
  })

  it('matches spells against the SRD library', async () => {
    const r = await parseAnyFile(JSON.stringify(foundry()))
    if (!r.ok) throw new Error(r.error)
    expect(r.file.character.spells?.map(s => s.id)).toEqual(['magic-missile', 'shield'])
  })

  it('names all three formats when it reads none of them', async () => {
    expect(await parseAnyFile('{"hello":1}')).toEqual({ ok: false, error: NOT_A_CHARACTER })
  })
})

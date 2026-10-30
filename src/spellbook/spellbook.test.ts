/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getEntry, loadKind, type Edition } from '../content'
import type { Character } from '../model/character'
import type { Abilities } from '../rules/types'
import { availableSpells, sourceFor, spellAccess } from './access'
import { addSpell, removeSpell, spellsOf, isPinned, isPrepared, pinnedSpells, setPrepared, toQuickCast, toggleSpellPin, unpreparedIds, upcastStep } from './spellbook'

const scores: Abilities = { str: 10, dex: 14, con: 12, int: 16, wis: 14, cha: 16 }

async function lib(edition: Edition) {
  const sources = [sourceFor(edition)]
  const [spells, classes, subclasses] = await Promise.all([loadKind('spells', { sources }), loadKind('classes', { sources }), loadKind('subclasses', { sources })])
  return { spells, classes, subclasses }
}

const access = async (edition: Edition, classes: Character['classes']) => {
  const l = await lib(edition)
  return { list: spellAccess({ classes }, l.classes, l.subclasses, scores), spells: l.spells }
}

describe('spell access', () => {
  it('gives a level 7 warlock 4th-level spells in both editions', async () => {
    const old = await access('2014', [{ classId: 'warlock', level: 7 }])
    expect(old.list[0]).toMatchObject({ maxLevel: 4, cantrips: 3, kind: 'known', limit: 8 })
    const now = await access('2024', [{ classId: 'warlock', level: 7 }])
    expect(now.list[0]).toMatchObject({ maxLevel: 4, cantrips: 3, kind: 'prepared', limit: 8 })
    const avail = availableSpells(now.spells, now.list[0])
    expect(avail.length).toBeGreaterThan(40)
    expect(avail.every(s => s.classes.includes('warlock') && s.level <= 4)).toBe(true)
    expect(avail.map(s => s.id)).toEqual(expect.arrayContaining(['eldritch-blast', 'hex', 'hellish-rebuke', 'banishment']))
    expect(avail.some(s => s.level === 5)).toBe(false)
  })

  it('adds Mystic Arcanum levels for high-level warlocks', async () => {
    expect((await access('2024', [{ classId: 'warlock', level: 11 }])).list[0].maxLevel).toBe(6)
    expect((await access('2014', [{ classId: 'warlock', level: 17 }])).list[0].maxLevel).toBe(9)
  })

  it('counts 2014 prepared spells from the ability modifier and level', async () => {
    const { list } = await access('2014', [{ classId: 'wizard', level: 1 }])
    expect(list[0]).toMatchObject({ kind: 'prepared', limit: 4, maxLevel: 1, cantrips: 3 })
    const pal = await access('2014', [{ classId: 'paladin', level: 5 }])
    expect(pal.list[0]).toMatchObject({ limit: 5, maxLevel: 2, cantrips: 0 })
  })

  it('leaves out non-casters and casters below their first spell level', async () => {
    expect((await access('2014', [{ classId: 'fighter', level: 5 }])).list).toEqual([])
    expect((await access('2014', [{ classId: 'paladin', level: 1 }])).list).toEqual([])
  })

  it('puts 2014 Fiend expanded spells on the warlock list, not known for free', async () => {
    const { list, spells } = await access('2014', [{ classId: 'warlock', level: 5, subclassId: 'fiend' }])
    expect(list[0].alwaysPrepared).toEqual([])
    expect(list[0].listed).toEqual(expect.arrayContaining(['burning-hands', 'scorching-ray', 'fireball']))
    expect(availableSpells(spells, list[0]).map(s => s.id)).toEqual(expect.arrayContaining(['burning-hands', 'command', 'fireball']))
  })

  it('lists each spellcasting class of a multiclass character, with subclass spells always prepared', async () => {
    const { list, spells } = await access('2014', [{ classId: 'cleric', level: 3, subclassId: 'life' }, { classId: 'rogue', level: 2 }, { classId: 'wizard', level: 2 }])
    expect(list.map(a => a.classId)).toEqual(['cleric', 'wizard'])
    expect(list[0].alwaysPrepared).toEqual(expect.arrayContaining(['bless', 'cure-wounds', 'lesser-restoration', 'spiritual-weapon']))
    expect(availableSpells(spells, list[0]).map(s => s.id)).toContain('spiritual-weapon')
  })
})

describe('chosen spells', () => {
  it('adds once per class, removes, and keeps the edition choice', () => {
    let c = { id: 'c1', classes: [{ classId: 'warlock', level: 7 }] } as Character
    c = addSpell(addSpell(c, 'warlock', 'hex'), 'warlock', 'hex')
    c = addSpell(c, 'warlock', 'eldritch-blast')
    expect(spellsOf(c, 'warlock').map(s => s.id)).toEqual(['hex', 'eldritch-blast'])
    expect(spellsOf(removeSpell(c, 'warlock', 'hex')).map(s => s.id)).toEqual(['eldritch-blast'])
  })
})

describe('pinned spells', () => {
  it('story and combat share the quick-cast list: pin adds an entry, pin again removes it', async () => {
    const detect = await getEntry('spells', 'detect-magic')
    const missile = await getEntry('spells', 'magic-missile')
    if (!detect || !missile) throw new Error('library spells missing')
    let c = { id: 'c1', quickCast: [{ id: 'a', kind: 'attack', name: 'Longsword' }] } as Character
    c = toggleSpellPin(toggleSpellPin(c, detect), missile)
    expect(pinnedSpells(c).map(e => e.name)).toEqual(['Detect Magic', 'Magic Missile'])
    expect(isPinned(c, 'Detect Magic')).toBe(true)
    c = toggleSpellPin(c, detect)
    expect(pinnedSpells(c).map(e => e.name)).toEqual(['Magic Missile'])
    expect(c.quickCast?.[0]).toEqual({ id: 'a', kind: 'attack', name: 'Longsword' })
  })
})

describe('quick-cast from the library', () => {
  it('works out the upcast step', () => {
    expect(upcastStep('8d6', '9d6')).toBe('1d6')
    expect(upcastStep('3d4 + 3', '4d4 + 4')).toBe('1d4+1')
    expect(upcastStep('1d8', '1d10')).toBeUndefined()
  })

  it('turns attack, save, healing and cantrip spells into pin entries', async () => {
    const get = async (id: string) => (await getEntry('spells', id, { sources: ['srd-5.1'] }))!
    expect(toQuickCast(await get('fireball'))).toEqual({ name: 'Fireball', level: 3, roll: 'save', save: 'dex', damage: '8d6', damageType: 'fire', upcast: '1d6' })
    expect(toQuickCast(await get('fire-bolt'))).toMatchObject({ level: 0, roll: 'attack', damage: '1d10', damageType: 'fire', cantripScaling: true })
    expect(toQuickCast(await get('cure-wounds'))).toMatchObject({ roll: 'none', damage: '1d8', damageType: 'healing', addMod: true, upcast: '1d8' })
    expect(toQuickCast(await get('shield'))).toEqual({ name: 'Shield', level: 1, roll: 'none' })
  })

  it('fills spells whose library entry lacks numbers, and adds MOD to damage', async () => {
    const get = async (id: string, source: string) => (await getEntry('spells', id, { sources: [source] }))!
    expect(toQuickCast(await get('spiritual-weapon', 'srd-5.1'))).toMatchObject({ roll: 'attack', damage: '1d8', damageType: 'force', addMod: true })
    expect(toQuickCast(await get('spiritual-weapon', 'srd-5.2'))).toMatchObject({ roll: 'attack', damage: '1d8', damageType: 'force', addMod: true })
    expect(toQuickCast(await get('spirit-guardians', 'srd-5.1'))).toMatchObject({ roll: 'save', save: 'wis', damage: '3d8', upcast: '1d8' })
    expect(toQuickCast(await get('spirit-guardians', 'srd-5.2'))).toMatchObject({ roll: 'save', save: 'wis', damage: '3d8', damageType: 'radiant' })
  })
})

describe('styles', () => {
  it('uses logical properties only, so RTL needs no overrides', () => {
    const css = readFileSync(new URL('./spellbook.css', import.meta.url), 'utf8')
    expect(css).not.toMatch(/(margin|padding|border)-(left|right|top|bottom)|\b(left|right):/)
  })
})

describe('wizard prepared spells', () => {
  it('book spells are prepared unless marked; unpreparing keeps them in the book', () => {
    let c = addSpell(addSpell({ spells: [] } as unknown as Character, 'wizard', 'magic-missile'), 'wizard', 'shield')
    expect(unpreparedIds(c).size).toBe(0)
    c = setPrepared(c, 'wizard', 'shield', false)
    expect([...unpreparedIds(c)]).toEqual(['shield'])
    expect(spellsOf(c).map(k => k.id)).toEqual(['magic-missile', 'shield'])
    expect(spellsOf(c).filter(isPrepared).map(k => k.id)).toEqual(['magic-missile'])
    c = setPrepared(c, 'wizard', 'shield', true)
    expect(spellsOf(c).find(k => k.id === 'shield')).toEqual({ id: 'shield', classId: 'wizard' })
  })

  it('a spell prepared through another class still counts as prepared', () => {
    const c = { spells: [{ id: 'shield', classId: 'wizard', prepared: false }, { id: 'shield', classId: 'sorcerer' }] } as unknown as Character
    expect(unpreparedIds(c).size).toBe(0)
  })

  it('Magic Missile pins as an always-hitting spell with one dart of damage', async () => {
    const { spells } = await lib('2024')
    expect(toQuickCast(spells.find(s => s.id === 'magic-missile')!)).toMatchObject({ roll: 'auto', damage: '1d4+1', damageType: 'force' })
  })
})

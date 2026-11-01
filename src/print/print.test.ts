import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import type { Character } from '../model/character'
import { derive } from '../rules'
import { makeCharacter } from '../sheet/fixtures'
import { spellSourcesFor } from '../spellbook/access'
import { buildPrintSheet } from './sheetData'
import { hasSpellPage, printSpells } from './spells'

const played = () => {
  const c = makeCharacter({ inventory: [{ uid: 'a', itemId: 'longsword', qty: 1, equipped: true }] })
  return { ...c, state: { ...c.state, currentHp: 12, tempHp: 4, spellSlotsUsed: [1, 0, 0, 0, 0, 0, 0, 0, 0], conditions: ['poisoned' as const], deathSaves: { successes: 2, failures: 1 } } }
}

async function lib(edition: '2014' | '2024') {
  const sources = spellSourcesFor(edition)
  const [spells, classes, subclasses] = await Promise.all([loadKind('spells', { sources }), loadKind('classes', { sources }), loadKind('subclasses', { sources })])
  return { spells, classes, subclasses }
}

describe('buildPrintSheet', () => {
  it('fills header, abilities, saves and skills from the engine', () => {
    const s = buildPrintSheet(makeCharacter(), { withPlayState: false })
    expect(s.classes).toEqual([{ classId: 'fighter', level: 5 }, { classId: 'wizard', level: 2 }])
    expect(s.level).toBe(7)
    expect(s.proficiencyBonus).toBe('+3')
    expect(s.abilities).toHaveLength(6)
    expect(s.saves.find(x => x.id === 'str')).toEqual({ id: 'str', bonus: '+6', proficient: true })
    expect(s.skills).toHaveLength(18)
    expect(s.skills.find(x => x.id === 'stealth')?.ability).toBe('dex')
  })

  it('lists equipped weapons as attacks and shows inventory with weight', () => {
    const s = buildPrintSheet(played(), { withPlayState: false })
    expect(s.attacks.find(a => a.name === 'Longsword')).toMatchObject({ damageType: 'slashing', versatile: expect.any(String) })
    expect(s.equipment).toEqual([{ itemId: 'longsword', name: 'Longsword', qty: 1, equipped: true, weight: 3 }])
  })

  it('leaves play state blank for pencil play', () => {
    const s = buildPrintSheet(played(), { withPlayState: false })
    expect(s.currentHp).toBeUndefined()
    expect(s.tempHp).toBeUndefined()
    expect(s.spellSlots[0]).toMatchObject({ level: 1, used: 0 })
    expect(s.conditions).toEqual([])
    expect(s.deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('fills play state when asked', () => {
    const s = buildPrintSheet(played(), { withPlayState: true })
    expect(s.currentHp).toBe(12)
    expect(s.tempHp).toBe(4)
    expect(s.spellSlots[0].used).toBe(1)
    expect(s.conditions).toEqual(['poisoned'])
    expect(s.deathSaves).toEqual({ successes: 2, failures: 1 })
  })

  it('includes class resources and custom trackers', () => {
    const c = makeCharacter()
    const s = buildPrintSheet(
      { ...c, state: { ...c.state, counters: [{ id: 'k', label: 'Arrows', max: 20, used: 3, recharge: 'none' }] } },
      { withPlayState: true },
    )
    expect(s.resources.find(r => r.id === 'second-wind' || r.label === 'Second Wind')).toBeDefined()
    expect(s.resources.find(r => r.label === 'Arrows')).toEqual({ label: 'Arrows', max: 20, used: 3, recharge: undefined })
  })

  it('prints inspiration with play state and the DM\'s charms and blessings', () => {
    const c = makeCharacter()
    const given = { ...c, state: { ...c.state, inspiration: true, boons: [
      { id: 'g1', name: 'Charm of Luck', kind: 'charm' as const, uses: 3, used: 1, from: 'Noa', at: '2026-11-01' },
      { id: 'g2', name: 'Blessing of Health', kind: 'blessing' as const, at: '2026-11-01' },
    ] } }
    expect(buildPrintSheet(given, { withPlayState: false }).inspiration).toBe(false)
    const s = buildPrintSheet(given, { withPlayState: true })
    expect(s.inspiration).toBe(true)
    expect(s.boons).toEqual([
      { name: 'Charm of Luck', kind: 'charm', uses: 3, used: 1, from: 'Noa' },
      { name: 'Blessing of Health', kind: 'blessing', uses: 0, used: 0 },
    ])
  })

  it('prints pact slots apart from regular slots', () => {
    const c = makeCharacter({ classes: [{ classId: 'warlock', level: 7 }] })
    const s = buildPrintSheet(c, { withPlayState: false })
    expect(s.spellSlots).toEqual([{ level: 4, max: 2, used: 0, pact: true }])
  })
})

describe('printSpells', () => {
  it('lists a wizard\'s spells by level with prepared marks and the class DC', async () => {
    const c: Character = makeCharacter({
      classes: [{ classId: 'wizard', level: 3 }],
      spells: [
        { id: 'fire-bolt', classId: 'wizard' }, { id: 'shield', classId: 'wizard' },
        { id: 'magic-missile', classId: 'wizard', prepared: false }, { id: 'misty-step', classId: 'wizard' },
      ],
    })
    const p = printSpells(c, await lib('2014'))
    expect(p.classes).toHaveLength(1)
    const w = p.classes[0]
    expect(w).toMatchObject({ classId: 'wizard', ability: 'int', spellbook: expect.any(Number) })
    const d = derive(c)
    expect(w.saveDc).toBe(8 + d.proficiencyBonus + d.mods.int)
    expect(w.attack).toBe(d.proficiencyBonus + d.mods.int)
    expect(w.rows.map(r => r.spell.id)).toEqual(['fire-bolt', 'magic-missile', 'shield', 'misty-step'])
    expect(w.rows.find(r => r.spell.id === 'magic-missile')?.prepared).toBe(false)
    expect(w.rows.find(r => r.spell.id === 'shield')?.prepared).toBe(true)
    expect(p.all.map(s => s.id)).toEqual(['fire-bolt', 'magic-missile', 'shield', 'misty-step'])
    expect(hasSpellPage(p, 2)).toBe(true)
  })

  it('marks subclass spells as always prepared', async () => {
    const c = makeCharacter({ classes: [{ classId: 'cleric', level: 3, subclassId: 'life' }], spells: [] })
    const p = printSpells(c, await lib('2014'))
    const always = p.classes[0].rows.filter(r => r.always).map(r => r.spell.id)
    expect(always).toContain('bless')
    expect(always).toContain('cure-wounds')
  })

  it('gives a fighter no spell page and lists race spells under other', async () => {
    const fighter = makeCharacter({ classes: [{ classId: 'fighter', level: 3 }] })
    const none = printSpells(fighter, await lib('2014'))
    expect(hasSpellPage(none, 0)).toBe(false)

    const tiefling = makeCharacter({ raceId: 'tiefling', classes: [{ classId: 'fighter', level: 3 }] })
    const p = printSpells(tiefling, await lib('2014'))
    expect(p.other.map(o => o.spell?.id)).toContain('thaumaturgy')
    expect(hasSpellPage(p, 0)).toBe(true)
  })
})

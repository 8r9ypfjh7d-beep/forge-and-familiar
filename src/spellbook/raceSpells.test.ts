import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import { allRaces, derive, getResources } from '../rules'
import { makeCharacter } from '../sheet/fixtures'
import { spellAttackRows } from '../sheet/combat/combat'
import { spellSourcesFor } from './access'
import { grantedSpells } from './extra'

// Race, subrace and lineage spells: what the builder lists must be castable on the sheet, with its daily limit.
const tiefling = (classId: string, level: number) =>
  makeCharacter({ rulesEdition: '2024', raceId: 'tiefling', subraceId: 'infernal', classes: [{ classId, level }] })

describe('race spells on the sheet', () => {
  it('lets a 2024 Infernal Tiefling cast Thaumaturgy, Fire Bolt, Hellish Rebuke and Darkness', () => {
    const c = tiefling('druid', 5)
    const d = derive(c)
    expect(d.itemSpells.map(s => s.spell)).toEqual(['Thaumaturgy', 'Fire Bolt', 'Hellish Rebuke', 'Darkness'])
    expect(d.defenses.resistances).toContain('fire')
    const res = getResources(c)
    expect(res.find(r => r.id === 'spell:hellish-rebuke:infernal')).toMatchObject({ max: 1, recharge: 'long' })
    expect(res.find(r => r.id === 'spell:darkness:infernal')).toMatchObject({ max: 1, recharge: 'long' })
    expect(res.some(r => r.id.startsWith('spell:fire-bolt'))).toBe(false)
  })

  it('unlocks the 3rd and 5th level legacy spells with character level', () => {
    expect(derive(tiefling('druid', 1)).itemSpells.map(s => s.spell)).toEqual(['Thaumaturgy', 'Fire Bolt'])
    expect(derive(tiefling('druid', 3)).itemSpells.map(s => s.spell)).toEqual(['Thaumaturgy', 'Fire Bolt', 'Hellish Rebuke'])
  })

  it('gives a Forest Gnome Speak with Animals proficiency bonus times per long rest', () => {
    const c = makeCharacter({ rulesEdition: '2024', raceId: 'gnome', subraceId: 'forest-gnome', classes: [{ classId: 'rogue', level: 5 }] })
    expect(getResources(c).find(r => r.id === 'spell:speak-with-animals:forest-gnome')).toMatchObject({ max: 3, recharge: 'long' })
  })

  it('puts a race attack cantrip in Attacks, even without a casting class', async () => {
    const lib = await loadKind('spells', { sources: spellSourcesFor('2024') })
    const druid = tiefling('druid', 5)
    expect(spellAttackRows(druid, derive(druid), lib).map(r => r.name)).toContain('Fire Bolt')
    const fighter = makeCharacter({ ...tiefling('fighter', 5), baseAbilities: { str: 15, dex: 14, con: 13, int: 10, wis: 8, cha: 16 } })
    const d = derive(fighter)
    const row = spellAttackRows(fighter, d, lib).find(r => r.name === 'Fire Bolt')
    expect(row).toMatchObject({ kind: 'attack', value: d.proficiencyBonus + d.mods.cha, damage: '2d10' })
  })

  it('makes every race spell the builder lists castable, in both editions', async () => {
    for (const edition of ['2014', '2024'] as const) {
      const spells = await loadKind('spells', { sources: spellSourcesFor(edition) })
      for (const r of allRaces(edition)) {
        for (const sub of [undefined, ...(r.subraces ?? [])]) {
          const c = makeCharacter({ ...(edition === '2024' ? { rulesEdition: edition } : {}), raceId: r.id, subraceId: sub?.id, classes: [{ classId: 'fighter', level: 20 }] })
          const castable = derive(c).itemSpells.map(s => s.spell.toLowerCase().replace(/\s*\(.*\)$/, ''))
          for (const g of grantedSpells(c, spells)) expect(castable, `${edition} ${r.id} ${sub?.id ?? ''}`).toContain(g.spell.name.toLowerCase())
        }
      }
    }
  })

  it('lists 2014 tiefling variants with their own legacy spells, not Infernal Legacy', async () => {
    const spells = await loadKind('spells', { sources: spellSourcesFor('2014') })
    const c = makeCharacter({ raceId: 'tiefling', subraceId: 'tiefling-fierna', classes: [{ classId: 'fighter', level: 5 }] })
    expect(grantedSpells(c, spells).map(g => g.spell.id)).toEqual(['friends', 'charm-person', 'suggestion'])
  })
})

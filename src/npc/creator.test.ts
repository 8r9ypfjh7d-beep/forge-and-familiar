/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { loadKind } from '../content'
import { perDayGroups, spellSlots } from '../monsters/block'
import { newNpc } from './engine'
import { makeBlock } from './fixtures'
import { randomNpcPick } from './random'
import { parseSpellcasting, spellAttackBonus, spellSaveDc, spellSlug, spellcastingText } from './spellcasting'
import { averageHp, blankBlock } from './ui/NpcBuilder'
import { stashNpcPrefill, takeNpcPrefill } from './ui/prefill'

describe('NPC creator: spellcasting prefill', () => {
  it('reads the SRD 5.1 Mage trait into slots, ability, DC and spell ids', async () => {
    const mage = (await loadKind('monsters', { sources: ['srd-5.1'] })).find(m => m.id === 'mage')!
    const sc = parseSpellcasting(mage)!
    expect(sc.ability).toBe('int')
    expect(sc.saveDc).toBe(14)
    expect(sc.attackBonus).toBe(6)
    expect(sc.groups[0]).toEqual({ label: 'Cantrips (at will)', spells: ['fire-bolt', 'light', 'mage-hand', 'prestidigitation'] })
    expect(spellSlots({ ...mage, spellcasting: sc }).slice(0, 5)).toEqual([4, 3, 3, 3, 1])
  })

  it('maps parsed spell names onto library spell ids', async () => {
    const spells = new Set((await loadKind('spells', { sources: ['srd-5.1'] })).map(s => s.id))
    const mage = (await loadKind('monsters', { sources: ['srd-5.1'] })).find(m => m.id === 'mage')!
    const ids = parseSpellcasting(mage)!.groups.flatMap(g => g.spells)
    expect(ids.filter(id => !spells.has(id))).toEqual([])
  })

  it('keeps a structured field and gives nothing without a trait', () => {
    const b = makeBlock()
    expect(parseSpellcasting(b)).toBe(b.spellcasting)
    expect(parseSpellcasting(blankBlock('2014'))).toBeUndefined()
  })

  it('reads per-day groups', () => {
    const b = { ...blankBlock('2014'), traits: [{ name: 'Innate Spellcasting', damage: [], description: 'Its innate spellcasting ability is Charisma (spell save DC 13). It can innately cast:\n- At will: mage hand\n- 1/day each: darkness, faerie fire' }] }
    const sc = parseSpellcasting(b)!
    expect(sc.ability).toBe('cha')
    expect(perDayGroups({ ...b, spellcasting: sc })).toEqual({ '1/day each': 1 })
  })

  it('works out DC and attack from the block, and writes the trait text back', () => {
    const b = { ...blankBlock('2014'), abilities: { ...blankBlock('2014').abilities, wis: 16 } }
    expect(spellSaveDc(b, 'wis')).toBe(13)
    expect(spellAttackBonus(b, 'wis')).toBe(5)
    const text = spellcastingText(b, { ability: 'wis', groups: [{ label: 'At will', spells: ['sacred-flame'] }] }, id => id.replace(/-/g, ' '))
    expect(text).toContain('Wisdom (spell save DC 13, +5 to hit')
    expect(text).toContain('- At will: sacred flame')
    expect(spellSlug("Tasha's Hideous Laughter")).toBe('tashas-hideous-laughter')
  })
})

describe('NPC creator: helpers', () => {
  it('averages hit dice like the book', () => {
    expect(averageHp('9d8')).toBe(40)
    expect(averageHp('10d8+20')).toBe(65)
    expect(averageHp('1d4-3')).toBe(1)
    expect(averageHp('lots')).toBeUndefined()
  })

  it('starts from scratch as a valid sheet', () => {
    const npc = newNpc({ id: 'n', ownerId: 'dm', name: 'Nobody', block: blankBlock('2024') })
    expect(npc.state.currentHp).toBe(4)
    expect(npc.block.edition).toBe('2024')
  })

  it('rolls a humanoid at a sensible CR', async () => {
    const all = await loadKind('monsters', { sources: ['srd-5.1'] })
    let i = 0
    const pick = (n: number) => (i++ * 7) % n
    for (let k = 0; k < 20; k++) {
      const r = randomNpcPick(all, pick)!
      expect(r.monster.type.toLowerCase()).toContain('humanoid')
      expect(r.monster.challengeRating).toBeLessThanOrEqual(5)
      expect(r.name).toMatch(/\w+ \w+/)
    }
    expect(randomNpcPick([])).toBeUndefined()
  })

  it('hands a prefill over once', () => {
    const mem = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) })
    stashNpcPrefill({ monster: { source: 'srd-5.1', id: 'mage' }, partyId: 'p' })
    expect(takeNpcPrefill()).toEqual({ monster: { source: 'srd-5.1', id: 'mage' }, partyId: 'p' })
    expect(takeNpcPrefill()).toBeUndefined()
    vi.unstubAllGlobals()
  })
})

describe('NPC creator styles', () => {
  const css = readFileSync(new URL('./ui/npc-builder.css', import.meta.url), 'utf8')
  it('uses logical properties only', () => {
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right|top|bottom):|(^|[\s;{])(width|height):/m)
  })
  it('paints with glass tokens, not hard-coded colours', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(\s*255/i)
  })
})

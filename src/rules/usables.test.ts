/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { loadKind } from '../content'
import { rollAttack, rollSave } from '../dice'
import { makeCharacter } from '../sheet/fixtures'
import { derive, endsOn, getRollMode, planCast, SPELL_TEMPLATES, tempHpFromText, wornArmor, type SpellInfo } from '.'
import type { Character, LiveEffect } from '../model/character'

const ctx = { edition: '2014' as const, mod: 3, speed: 30 }
const spell = (over: Partial<SpellInfo>): SpellInfo => ({ id: 'x', name: 'X', level: 1, duration: 'Instantaneous', concentration: false, ...over })
const running = (c: Character, ...effects: Omit<LiveEffect, 'on'>[]): Character => ({ ...c, state: { ...c.state, effects: effects.map(e => ({ ...e, on: true })) } })
const all = async () => [
  ...await loadKind('spells', { sources: ['srd-5.1', 'books-2014'] }),
  ...await loadKind('spells', { sources: ['srd-5.2', 'books-2024'] }),
]

describe('casting plans', () => {
  it('Armor of Agathys gives 5 temp HP per slot level and lasts while they do', () => {
    const aoa = spell({ id: 'armor-of-agathys', name: 'Armor of Agathys', duration: '1 hour' })
    expect(planCast(aoa, 1, ctx)).toMatchObject({ tempHp: '5', effect: { id: 'spell:armor-of-agathys', level: 1, whileTempHp: true, ends: 'short', reflect: { damage: '5', type: 'cold' } } })
    expect(planCast(aoa, 3, ctx).tempHp).toBe('15')
  })

  it('False Life rolls by edition and grows with the slot', () => {
    const fl = spell({ id: 'false-life', duration: '1 hour' })
    expect(planCast(fl, 1, ctx).tempHp).toBe('1d4+4')
    expect(planCast(fl, 3, { ...ctx, edition: '2024' }).tempHp).toBe('2d4+4+10')
  })

  it('smites ride on the next hit in 2014 and roll at once in 2024', () => {
    const s = spell({ id: 'searing-smite', duration: '1 minute', concentration: true })
    expect(planCast(s, 2, ctx).effect).toMatchObject({ damage: '2d6', damageType: 'fire', once: true, weaponOnly: true, concentration: true })
    expect(planCast(s, 2, { ...ctx, edition: '2024' }).hit).toEqual({ dice: '2d6', type: 'fire' })
  })

  it('reads temporary hit points from book text it has no numbers for', () => {
    expect(tempHpFromText('You gain 1d4 + 4 temporary hit points.')).toBe('1d4+4')
    expect(planCast(spell({ id: 'new', description: 'You gain 10 temporary hit points.' }), 1, ctx).tempHp).toBe('10')
  })

  it('tracks anything with a duration, even without numbers, and nothing for instant spells', () => {
    expect(planCast(spell({ id: 'fog', name: 'Fog Cloud', duration: 'Up to 1 hour', concentration: true }), 1, ctx).effect).toMatchObject({ concentration: true, ends: 'short' })
    expect(planCast(spell({ id: 'magic-missile' }), 1, ctx)).toEqual({})
  })

  it('maps durations to the rest that ends them', () => {
    expect(endsOn('Instantaneous')).toBeUndefined()
    expect(endsOn('1 round')).toBe('short')
    expect(endsOn('Up to 1 hour')).toBe('short')
    expect(endsOn('8 hours')).toBe('long')
    expect(endsOn('24 hours')).toBe('never')
    expect(endsOn('Until dispelled')).toBe('never')
  })

  it('has numbers only for spells the library has, and plans every library spell', async () => {
    const spells = await all()
    const ids = new Set(spells.map(s => s.id))
    expect(Object.keys(SPELL_TEMPLATES).filter(id => !ids.has(id))).toEqual([])
    for (const s of spells) {
      const plan = planCast(s, s.level, ctx)
      if (endsOn(s.duration)) expect(plan.effect, s.id).toBeDefined()
    }
  })
})

describe('running effects in the rules', () => {
  const wizard = () => makeCharacter({ classes: [{ classId: 'wizard', level: 5 }], baseAbilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } })

  it('Mage Armor sets unarmored AC, Barkskin a floor, Shield of Faith adds', () => {
    const c = wizard()
    expect(derive(c).armorClass.value).toBe(12)
    expect(derive(running(c, { id: 'spell:mage-armor', name: 'Mage Armor', from: 'spell', acBase: 13 })).armorClass.value).toBe(15)
    expect(derive(running(c, { id: 'spell:barkskin', name: 'Barkskin', from: 'spell', acMin: 16 })).armorClass.value).toBe(16)
    expect(derive(running(c, { id: 'spell:sof', name: 'Shield of Faith', from: 'spell', stats: [{ kind: 'ac', value: 2 }] })).armorClass.value).toBe(14)
  })

  it('Mage Armor needs no body armor: wornArmor names what to take off', () => {
    const mage = { id: 'spell:mage-armor', name: 'Mage Armor', from: 'spell' as const, acBase: 13 }
    const c = { ...wizard(), inventory: [{ uid: 'la', itemId: 'leather', qty: 1, equipped: true }, { uid: 'sh', itemId: 'shield', qty: 1, equipped: true }] }
    expect(wornArmor(c)).toEqual({ uid: 'la', name: 'Leather Armor' })
    expect(derive(running(c, mage)).armorClass.value).toBe(15)
    const off = { ...c, inventory: c.inventory.map(e => (e.uid === 'la' ? { ...e, equipped: false } : e)) }
    expect(wornArmor(off)).toBeUndefined()
    expect(derive(running(off, mage)).armorClass.value).toBe(17)
  })

  it('switched-off effects keep tracking without changing numbers', () => {
    const c = wizard()
    const off = { ...c, state: { ...c.state, effects: [{ id: 'spell:sof', name: 'Shield of Faith', from: 'spell' as const, on: false, stats: [{ kind: 'ac' as const, value: 2 }] }] } }
    expect(derive(off).armorClass.value).toBe(12)
  })

  it('Bless adds 1d4 to attack rolls and saves; Foresight gives advantage on attacks', () => {
    const c = running(wizard(), { id: 'spell:bless', name: 'Bless', from: 'spell', rollDice: { attack: '1d4', save: '1d4' } })
    const ones = () => 1
    const hit = rollAttack({ name: 'Dagger', bonus: 2 }, { character: c, rng: ones })
    expect(hit.total).toBe(4)
    expect(hit.label).toMatch(/Bless/)
    expect(rollSave(derive(c), 'wis', { character: c, rng: ones }).total).toBe(1 + derive(c).saves.wis.bonus + 1)
    const fore = running(wizard(), { id: 'spell:foresight', name: 'Foresight', from: 'spell', stats: [{ kind: 'advantage', on: 'attacks' }] })
    expect(getRollMode(fore, 'attack')).toBe('advantage')
  })
})

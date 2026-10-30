import { describe, expect, it } from 'vitest'
import { rollSkill } from '../dice'
import type { Character } from '../model/character'
import { dawn, longRest, normalize, setResourceUsed, shortRest } from '../sheet/engine'
import { createCharacter, derive, getResources, getSpellSlots, isUsefulEffect, MAGIC_ITEM_STATS, sanitizeEffect, type CharacterDraft, type ItemEffect } from '.'

const make = (classId = 'fighter', level = 5): Character => {
  const c = createCharacter({
    name: 'T', ownerId: 'u', playerName: '', alignment: 'True Neutral', raceId: 'human', backgroundId: 'acolyte',
    classes: [{ classId, level }], abilityMethod: 'standard',
    baseAbilities: { str: 14, dex: 14, con: 12, int: 10, wis: 12, cha: 16 }, freeAbilityBonuses: [], chosenSkills: [],
  } satisfies CharacterDraft)
  c.inventory = []
  return c
}

const wearing = (c: Character, effects: ItemEffect[], equipped = true): Character =>
  normalize({ ...c, inventory: [...c.inventory, { uid: `i${c.inventory.length}`, itemId: 'trinket', name: 'Trinket', qty: 1, equipped, effects }] })

describe('item effects', () => {
  it('adds spell slots, even to a non-caster, and pact slots to a warlock', () => {
    const fighter = wearing(make(), [{ kind: 'spellSlot', level: 3, value: 1 }])
    expect(getSpellSlots(fighter).slots[2]).toBe(1)
    const warlock = make('warlock', 7)
    expect(getSpellSlots(wearing(warlock, [{ kind: 'pactSlot', value: 1 }])).pact?.count).toBe(getSpellSlots(warlock).pact!.count + 1)
    const wizard = make('wizard', 5)
    expect(getSpellSlots(wearing(wizard, [{ kind: 'spellSlot', level: 1, value: 2 }])).slots[0]).toBe(6)
  })

  it('does nothing while unequipped', () => {
    const c = wearing(make(), [{ kind: 'spellSlot', level: 1, value: 1 }, { kind: 'hp', value: 10 }], false)
    expect(getSpellSlots(c).slots[0]).toBe(0)
    expect(derive(c).maxHp).toBe(derive(make()).maxHp)
  })

  it('tracks charges as resources that come back on rests or at dawn', () => {
    let c = wearing(make(), [{ kind: 'charges', value: 7, recharge: 'dawn', regain: '1d6+1' }, { kind: 'charges', value: 2, recharge: 'short' }])
    const [wand, ring] = getResources(c).filter(r => r.id.startsWith('item:'))
    expect(wand).toMatchObject({ label: 'Trinket', max: 7, recharge: 'dawn', regain: '1d6+1' })
    expect(ring).toMatchObject({ max: 2, recharge: 'short' })
    c = setResourceUsed(setResourceUsed(c, wand.id, 5), ring.id, 2)
    c = longRest(c)
    expect(c.state.resources[wand.id].used).toBe(5)
    expect(c.state.resources[ring.id].used).toBe(0)
    c = dawn(c, { [wand.id]: 3 })
    expect(c.state.resources[wand.id].used).toBe(2)
    expect(shortRest(c).state.resources[wand.id].used).toBe(2)
  })

  it('gives save and skill bonuses, proficiency and expertise', () => {
    const base = derive(make())
    const d = derive(wearing(make(), [
      { kind: 'save', ability: 'wis', value: 2 }, { kind: 'saveProficiency', ability: 'cha' },
      { kind: 'skill', skill: 'stealth', value: 3 }, { kind: 'skillProficiency', skill: 'arcana', expertise: true },
      { kind: 'skillProficiency', skill: 'history' }, { kind: 'passivePerception', value: 5 }, { kind: 'hp', value: 10 },
    ]))
    expect(d.saves.wis.bonus).toBe(base.saves.wis.bonus + 2)
    expect(d.saves.cha).toMatchObject({ proficient: true, bonus: base.saves.cha.bonus + d.proficiencyBonus })
    expect(d.skills.stealth.bonus).toBe(base.skills.stealth.bonus + 3)
    expect(d.skills.arcana).toMatchObject({ proficient: true, expertise: true, bonus: base.skills.arcana.bonus + 2 * d.proficiencyBonus })
    expect(d.skills.history.bonus).toBe(base.skills.history.bonus + d.proficiencyBonus)
    expect(d.passivePerception).toBe(base.passivePerception + 5)
    expect(d.maxHp).toBe(base.maxHp + 10)
  })

  it('rolls advantage it always gives, and only lists situational advantage', () => {
    const d = derive(wearing(make(), [
      { kind: 'advantage', on: 'skill:stealth' }, { kind: 'advantage', on: 'initiative' },
      { kind: 'advantage', on: 'saves', when: 'against spells' }, { kind: 'advantage', on: 'save:con' },
    ]))
    expect(d.skills.stealth.advantage).toBe(true)
    expect(d.skills.perception.advantage).toBeUndefined()
    expect(d.initiativeAdvantage).toBe(true)
    expect(d.saves.con.advantage).toBe(true)
    expect(d.saves.wis.advantage).toBeUndefined()
    expect(d.advantages).toContainEqual({ on: 'saves', when: 'against spells', source: 'Trinket' })
    expect(rollSkill(d, 'stealth').d20?.mode).toBe('advantage')
    expect(rollSkill(d, 'perception').d20?.mode).toBe('normal')
  })

  it('lists resistances, immunities, speeds and senses', () => {
    const d = derive(wearing(make(), [
      { kind: 'resistance', damage: 'Fire' }, { kind: 'resistance', damage: 'cold' }, { kind: 'immunity', damage: 'cold' },
      { kind: 'conditionImmunity', condition: 'poisoned' },
      { kind: 'moveSpeed', mode: 'fly', value: 0 }, { kind: 'moveSpeed', mode: 'swim', value: 40 },
      { kind: 'sense', sense: 'darkvision', value: 60 }, { kind: 'sense', sense: 'darkvision', value: 120 },
    ]))
    expect(d.defenses).toEqual({ resistances: ['fire'], immunities: ['cold'], conditionImmunities: ['poisoned'] })
    expect(d.speeds).toEqual({ fly: d.speed, swim: 40 })
    expect(d.senses).toEqual({ darkvision: 120 })
  })

  it('lists spells from items and splits melee and ranged weapon bonuses', () => {
    const c = make()
    c.inventory = [{ uid: 'b', itemId: 'longbow', qty: 1, equipped: true }, { uid: 's', itemId: 'shortsword', qty: 1, equipped: true }]
    const plain = derive(c).attacks
    const d = derive(wearing(c, [{ kind: 'damage', value: 2, only: 'ranged' }, { kind: 'spell', spell: 'Fireball', note: '1 charge' }]))
    expect(d.attacks.find(a => a.itemId === 'longbow')!.damage).not.toBe(plain.find(a => a.itemId === 'longbow')!.damage)
    expect(d.attacks.find(a => a.itemId === 'shortsword')!.damage).toBe(plain.find(a => a.itemId === 'shortsword')!.damage)
    expect(d.itemSpells).toEqual([{ spell: 'Fireball', note: '1 charge', source: 'Trinket' }])
  })

  it('reads effects from outside safely', () => {
    expect(sanitizeEffect({ kind: 'spellSlot', level: 12, value: 1 })).toEqual({ kind: 'spellSlot', level: 9, value: 1 })
    expect(sanitizeEffect({ kind: 'advantage', on: 'skill:stealth', when: 'quietly' })).toEqual({ kind: 'advantage', on: 'skill:stealth', when: 'quietly' })
    expect(sanitizeEffect({ kind: 'advantage', on: 'skill:hacking' })).toBeUndefined()
    expect(sanitizeEffect({ kind: 'conditionImmunity', condition: 'bored' })).toBeUndefined()
    expect(sanitizeEffect({ kind: 'charges', value: 7, recharge: 'whenever' })).toEqual({ kind: 'charges', value: 7, recharge: 'long' })
    expect(sanitizeEffect('ac')).toBeUndefined()
    expect(isUsefulEffect({ kind: 'spell', spell: ' ' })).toBe(false)
    expect(isUsefulEffect({ kind: 'moveSpeed', mode: 'fly', value: 0 })).toBe(true)
  })

  it('knows the SRD wands, rings and armor', () => {
    expect(MAGIC_ITEM_STATS['wand-of-fireballs'].effects).toEqual([
      { kind: 'charges', value: 7, recharge: 'dawn', regain: '1d6+1' }, { kind: 'spell', spell: 'Fireball' },
    ])
    expect(MAGIC_ITEM_STATS['ring-of-resistance-fire'].effects).toEqual([{ kind: 'resistance', damage: 'fire' }])
    expect(MAGIC_ITEM_STATS['dragon-scale-mail-red']).toMatchObject({ magicBonus: 1, effects: [{ kind: 'resistance', damage: 'fire' }, { kind: 'advantage', on: 'saves' }] })
    for (const stats of Object.values(MAGIC_ITEM_STATS)) for (const f of stats.effects ?? []) expect(sanitizeEffect(f)).toEqual(f)
  })
})

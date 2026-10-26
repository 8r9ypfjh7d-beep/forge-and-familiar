// What SRD magic items do to a character's numbers, keyed by content library id (src/content, both editions).
// Only always-on effects; anything situational (vs. dragons, once a day) stays in the item's notes.
// The inventory copies these onto the entry, where the player can edit them.
import type { Ability, ItemEffect } from '../types'

export interface MagicItemStats {
  effects?: ItemEffect[]
  /** +N to attack and damage (weapons) or AC (armor and shields). */
  magicBonus?: number
  extraDamage?: string
}

const set = (ability: Ability, value: number): ItemEffect => ({ kind: 'abilitySet', ability, value })
const plus2 = (ability: Ability): ItemEffect => ({ kind: 'ability', ability, value: 2, max: 20 })
const protection: ItemEffect[] = [{ kind: 'ac', value: 1 }, { kind: 'saves', value: 1 }]
const luck: ItemEffect[] = [{ kind: 'checks', value: 1 }, { kind: 'saves', value: 1 }]
const spellAttack = (value: number): ItemEffect[] => [{ kind: 'spellAttack', value }]

export const MAGIC_ITEM_STATS: Record<string, MagicItemStats> = {
  'ring-of-protection': { effects: protection },
  'cloak-of-protection': { effects: protection },
  'bracers-of-defense': { effects: [{ kind: 'ac', value: 2, unarmored: true }] },
  'ioun-stone-of-protection': { effects: [{ kind: 'ac', value: 1 }] },
  'stone-of-good-luck-luckstone': { effects: luck },
  'stone-of-good-luck-(luckstone)': { effects: luck },

  'gauntlets-of-ogre-power': { effects: [set('str', 19)] },
  'headband-of-intellect': { effects: [set('int', 19)] },
  'amulet-of-health': { effects: [set('con', 19)] },
  // The plain belt (2024 has only this one) starts as a Hill Giant belt; the player can change the score.
  'belt-of-giant-strength': { effects: [set('str', 21)] },
  'belt-of-giant-strength-hill': { effects: [set('str', 21)] },
  'belt-of-giant-strength-stone': { effects: [set('str', 23)] },
  'belt-of-giant-strength-frost': { effects: [set('str', 23)] },
  'belt-of-giant-strength-fire': { effects: [set('str', 25)] },
  'belt-of-giant-strength-cloud': { effects: [set('str', 27)] },
  'belt-of-giant-strength-storm': { effects: [set('str', 29)] },
  'belt-of-dwarvenkind': { effects: [plus2('con')] },
  'ioun-stone-of-strength': { effects: [plus2('str')] },
  'ioun-stone-of-agility': { effects: [plus2('dex')] },
  'ioun-stone-of-fortitude': { effects: [plus2('con')] },
  'ioun-stone-of-intellect': { effects: [plus2('int')] },
  'ioun-stone-of-insight': { effects: [plus2('wis')] },
  'ioun-stone-of-leadership': { effects: [plus2('cha')] },

  'robe-of-the-archmagi': { effects: [{ kind: 'ac', value: 5, unarmored: true }, { kind: 'spellAttack', value: 2 }, { kind: 'spellDc', value: 2 }] },
  'staff-of-power': { effects: [{ kind: 'ac', value: 2 }, { kind: 'saves', value: 2 }, { kind: 'spellAttack', value: 2 }] },
  'staff-of-the-magi': { effects: spellAttack(2) },
  'staff-of-the-woodlands': { effects: spellAttack(2) },
  'wand-of-the-war-mage': { effects: spellAttack(1) },
  'wand-of-the-war-mage-1': { effects: spellAttack(1) },
  'wand-of-the-war-mage-2': { effects: spellAttack(2) },
  'wand-of-the-war-mage-3': { effects: spellAttack(3) },

  'defender': { magicBonus: 3 },
  'holy-avenger': { magicBonus: 3 },
  'dwarven-thrower': { magicBonus: 3 },
  'vorpal-sword': { magicBonus: 3 },
  'staff-of-striking': { magicBonus: 3 },
  'nine-lives-stealer': { magicBonus: 2 },
  'scimitar-of-speed': { magicBonus: 2 },
  'sun-blade': { magicBonus: 2 },
  'dragon-slayer': { magicBonus: 1 },
  'giant-slayer': { magicBonus: 1 },
  'mace-of-smiting': { magicBonus: 1 },
  'luck-blade': { magicBonus: 1, effects: [{ kind: 'saves', value: 1 }] },
  'flame-tongue': { extraDamage: '2d6 fire' },
  'frost-brand': { extraDamage: '1d6 cold' },

  'elven-chain': { magicBonus: 1 },
  'dwarven-plate': { magicBonus: 2 },
  'dragon-scale-mail': { magicBonus: 1 },
  ...Object.fromEntries(['black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white']
    .map(color => [`dragon-scale-mail-${color}`, { magicBonus: 1 }])),
}

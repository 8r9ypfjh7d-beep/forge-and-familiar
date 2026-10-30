// What SRD magic items do to a character's numbers, keyed by content library id (src/content, both editions).
// Always-on numbers, resistances, senses, speeds, charges and the spells an item casts. Situational advantage
// carries a `when` so the sheet shows it without rolling it; anything else situational stays in the item's notes.
// The inventory copies these onto the entry, where the player can edit them.
import type { Ability, ItemEffect, SkillId } from '../types'
import { DAWN_ITEMS } from './dawnItems'

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
const resist = (damage: string): ItemEffect => ({ kind: 'resistance', damage })
const adv = (skill: SkillId, when?: string): ItemEffect => ({ kind: 'advantage', on: `skill:${skill}`, ...(when ? { when } : {}) })
const vsSpells: ItemEffect = { kind: 'advantage', on: 'saves', when: 'against spells' }
const tome = (ability: Ability): ItemEffect => ({ kind: 'ability', ability, value: 2, max: 24 })
const spells = (...names: string[]): ItemEffect[] => names.map(spell => ({ kind: 'spell', spell }))

const DRAGON_COLORS: Record<string, string> = {
  black: 'acid', blue: 'lightning', brass: 'fire', bronze: 'lightning', copper: 'acid',
  gold: 'fire', green: 'poison', red: 'fire', silver: 'cold', white: 'cold',
}
const RESISTANCE_TYPES = ['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder']

/** What the charged wands and staffs can cast; their charges come from DAWN_ITEMS. */
const CHARGED_SPELLS: Record<string, string[]> = {
  'wand-of-magic-missiles': ['Magic Missile'],
  'wand-of-fireballs': ['Fireball'],
  'wand-of-lightning-bolts': ['Lightning Bolt'],
  'wand-of-web': ['Web'],
  'wand-of-binding': ['Hold Monster', 'Hold Person'],
  'wand-of-fear': ['Command', 'Fear'],
  'wand-of-polymorph': ['Polymorph'],
  'wand-of-magic-detection': ['Detect Magic'],
  'staff-of-healing': ['Cure Wounds', 'Lesser Restoration', 'Mass Cure Wounds'],
  'staff-of-fire': ['Burning Hands', 'Fireball', 'Wall of Fire'],
  'staff-of-frost': ['Cone of Cold', 'Fog Cloud', 'Ice Storm', 'Wall of Ice'],
  'staff-of-charming': ['Charm Person', 'Command', 'Comprehend Languages'],
  'staff-of-swarming-insects': ['Giant Insect', 'Insect Plague'],
  'staff-of-the-woodlands': ['Animal Friendship', 'Awaken', 'Barkskin', 'Locate Animals or Plants', 'Speak with Animals', 'Speak with Plants', 'Wall of Thorns'],
}

const BASE: Record<string, MagicItemStats> = {
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
  'belt-of-dwarvenkind': {
    effects: [plus2('con'), { kind: 'sense', sense: 'darkvision', value: 60 }, resist('poison'), { kind: 'advantage', on: 'saves', when: 'against poison' }],
  },
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
  ...Object.fromEntries(Object.entries(DRAGON_COLORS).map(([color, damage]) => [`dragon-scale-mail-${color}`, {
    magicBonus: 1, effects: [resist(damage), { kind: 'advantage', on: 'saves', when: 'against dragon breath' }],
  }])),

  // Damage resistance and immunity
  ...Object.fromEntries(RESISTANCE_TYPES.map(damage => [`ring-of-resistance-${damage}`, { effects: [resist(damage)] }])),
  // The plain ring or armor starts with fire; the player picks the real type.
  'ring-of-resistance': { effects: [resist('fire')] },
  'armor-of-resistance': { effects: [resist('fire')] },
  'brooch-of-shielding': { effects: [resist('force')] },
  'boots-of-the-winterlands': { effects: [resist('cold')] },
  'ring-of-warmth': { effects: [resist('cold')] },
  'periapt-of-proof-against-poison': { effects: [{ kind: 'immunity', damage: 'poison' }, { kind: 'conditionImmunity', condition: 'poisoned' }] },

  // Advantage
  'boots-of-elvenkind': { effects: [adv('stealth', 'moving silently')] },
  'cloak-of-elvenkind': { effects: [adv('stealth')] },
  'cloak-of-the-bat': { effects: [adv('stealth')] },
  'eyes-of-the-eagle': { effects: [adv('perception', 'that rely on sight')] },
  'rod-of-alertness': { effects: [adv('perception'), { kind: 'advantage', on: 'initiative' }] },
  'mantle-of-spell-resistance': { effects: [vsSpells] },
  'spellguard-shield': { effects: [vsSpells] },
  'scarab-of-protection': { effects: [vsSpells, { kind: 'charges', value: 12, recharge: 'none' }] },

  // Senses and movement
  'goggles-of-night': { effects: [{ kind: 'sense', sense: 'darkvision', value: 60 }] },
  'robe-of-eyes': { effects: [{ kind: 'sense', sense: 'darkvision', value: 120 }, adv('perception', 'that rely on sight')] },
  'winged-boots': { effects: [{ kind: 'moveSpeed', mode: 'fly', value: 0 }] },
  'wings-of-flying': { effects: [{ kind: 'moveSpeed', mode: 'fly', value: 60 }] },
  'broom-of-flying': { effects: [{ kind: 'moveSpeed', mode: 'fly', value: 50 }] },
  'cloak-of-the-manta-ray': { effects: [{ kind: 'moveSpeed', mode: 'swim', value: 60 }] },
  'ring-of-swimming': { effects: [{ kind: 'moveSpeed', mode: 'swim', value: 40 }] },
  'slippers-of-spider-climbing': { effects: [{ kind: 'moveSpeed', mode: 'climb', value: 0 }] },
  'gloves-of-swimming-and-climbing': { effects: [{ kind: 'moveSpeed', mode: 'climb', value: 0 }, { kind: 'moveSpeed', mode: 'swim', value: 0 }] },

  // Weapons
  'bracers-of-archery': { effects: [{ kind: 'damage', value: 2, only: 'ranged' }] },

  // Manuals and tomes: +2 to a score, up to 24.
  'manual-of-bodily-health': { effects: [tome('con')] },
  'manual-of-gainful-exercise': { effects: [tome('str')] },
  'manual-of-quickness-of-action': { effects: [tome('dex')] },
  'tome-of-clear-thought': { effects: [tome('int')] },
  'tome-of-leadership-and-influence': { effects: [tome('cha')] },
  'tome-of-understanding': { effects: [tome('wis')] },

  // Charges that are not on a dawn wand or staff
  'pearl-of-power': { effects: [{ kind: 'charges', value: 1, recharge: 'dawn' }] },
  'ring-of-evasion': { effects: [{ kind: 'charges', value: 3, recharge: 'dawn', regain: '1d3' }] },
  'ring-of-shooting-stars': { effects: [{ kind: 'charges', value: 6, recharge: 'dawn', regain: '1d6' }] },
}

/** Every item above, plus each dawn-charged wand and staff with its charges and spells. */
export const MAGIC_ITEM_STATS: Record<string, MagicItemStats> = { ...BASE }
for (const item of DAWN_ITEMS) {
  const charged: ItemEffect[] = [{ kind: 'charges', value: item.charges, recharge: 'dawn', ...(item.regain ? { regain: item.regain } : {}) }, ...spells(...(CHARGED_SPELLS[item.id] ?? []))]
  const own = MAGIC_ITEM_STATS[item.id]
  MAGIC_ITEM_STATS[item.id] = { ...own, effects: [...(own?.effects ?? []), ...charged] }
}

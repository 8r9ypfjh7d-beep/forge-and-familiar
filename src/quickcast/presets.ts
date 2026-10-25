// A few common SRD 5.1 spells to pin in one tap. Stopgap until the spell compendium exists,
// after which entries can point at compendium ids instead.
import type { SpellEntry } from './types'

export type SpellPreset = Omit<SpellEntry, 'id' | 'kind'>

export const SPELL_PRESETS: SpellPreset[] = [
  { name: 'Fire Bolt', level: 0, roll: 'attack', damage: '1d10', damageType: 'fire', cantripScaling: true },
  { name: 'Ray of Frost', level: 0, roll: 'attack', damage: '1d8', damageType: 'cold', cantripScaling: true },
  { name: 'Sacred Flame', level: 0, roll: 'save', save: 'dex', damage: '1d8', damageType: 'radiant', cantripScaling: true },
  { name: 'Vicious Mockery', level: 0, roll: 'save', save: 'wis', damage: '1d4', damageType: 'psychic', cantripScaling: true },
  { name: 'Bless', level: 1, roll: 'none' },
  { name: 'Shield', level: 1, roll: 'none' },
  { name: 'Magic Missile', level: 1, roll: 'none', damage: '3d4+3', damageType: 'force', upcast: '1d4+1' },
  { name: 'Burning Hands', level: 1, roll: 'save', save: 'dex', damage: '3d6', damageType: 'fire', upcast: '1d6' },
  { name: 'Thunderwave', level: 1, roll: 'save', save: 'con', damage: '2d8', damageType: 'thunder', upcast: '1d8' },
  { name: 'Guiding Bolt', level: 1, roll: 'attack', damage: '4d6', damageType: 'radiant', upcast: '1d6' },
  { name: 'Cure Wounds', level: 1, roll: 'none', damage: '1d8', damageType: 'healing', upcast: '1d8', addMod: true },
  { name: 'Healing Word', level: 1, roll: 'none', damage: '1d4', damageType: 'healing', upcast: '1d4', addMod: true },
  { name: 'Hold Person', level: 2, roll: 'save', save: 'wis' },
  { name: 'Shatter', level: 2, roll: 'save', save: 'con', damage: '3d8', damageType: 'thunder', upcast: '1d8' },
  { name: 'Fireball', level: 3, roll: 'save', save: 'dex', damage: '8d6', damageType: 'fire', upcast: '1d6' },
  { name: 'Lightning Bolt', level: 3, roll: 'save', save: 'dex', damage: '8d6', damageType: 'lightning', upcast: '1d6' },
]

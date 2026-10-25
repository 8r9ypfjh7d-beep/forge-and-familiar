// Turns a compendium spell into the fields of a pinned quick-cast spell.
import { SPELLS, type Spell } from '../rules'
import type { SpellEntry } from './types'

export type SpellPreset = Omit<SpellEntry, 'id' | 'kind'>

export function spellPreset(s: Spell): SpellPreset {
  return {
    name: s.name, level: s.level, roll: s.roll,
    ...(s.save && { save: s.save }),
    ...(s.damage && { damage: s.damage }),
    ...(s.damageType && { damageType: s.damageType }),
    ...(s.addMod && { addMod: true }),
    ...(s.upcast && { upcast: s.upcast }),
    ...(s.cantripScaling && { cantripScaling: true }),
  }
}

/** Every SRD 5.1 spell, ready to pin. */
export const SPELL_PRESETS: SpellPreset[] = SPELLS.map(spellPreset)

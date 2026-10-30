// Spellcasting ability for spells from outside a class. 2024 lineages (Elven Lineage, Gnomish Lineage, Fiendish Legacy)
// and 2024 Magic Initiate let the player pick Intelligence, Wisdom or Charisma; the pick is saved in Character.spellAbilities.
import type { Character } from '../model/character'
import { getAbilityMods, getAbilityScores } from './abilities'
import { rulesEdition } from './edition'
import { itemBonus } from './itemEffects'
import { raceProfile } from './race'
import type { Ability } from './types'

export const MENTAL_ABILITIES: Ability[] = ['int', 'wis', 'cha']

/** Character.spellAbilities key for the race's spells. Spell feats use their slot (`bg`, `origin`, `asi-…`). */
export const RACE_SPELL_KEY = 'race'

/** Feats whose spells let the player pick the ability, by edition. */
const CHOOSING_FEATS: Record<string, string[]> = { '2024': ['magic-initiate'], '2014': [] }

type Owner = Parameters<typeof raceProfile>[0] & Parameters<typeof getAbilityScores>[0] & Partial<Pick<Character, 'spellAbilities' | 'classes'>>

/** Whether the race's spells use a picked ability (2024 Elf, Gnome, Tiefling). */
export const raceChoosesSpellAbility = (c: Owner) => {
  const p = raceProfile(c)
  return !!p.race?.spellAbilityChoice && p.spells.length > 0
}

/** Whether a spell feat lets the player pick its ability (2024 Magic Initiate). */
export const featChoosesSpellAbility = (c: Pick<Character, 'rulesEdition'> | Partial<Pick<Character, 'rulesEdition'>>, featId: string) =>
  (CHOOSING_FEATS[rulesEdition(c)] ?? []).includes(featId)

/** The best of Intelligence, Wisdom and Charisma: the default pick. */
export function bestMentalAbility(c: Owner): Ability {
  const mods = getAbilityMods(getAbilityScores(c))
  return MENTAL_ABILITIES.reduce((best, a) => (mods[a] > mods[best] ? a : best), 'int' as Ability)
}

/** The ability picked for a key, else the best of INT, WIS and CHA. */
export const chosenSpellAbility = (c: Owner, key: string): Ability => c.spellAbilities?.[key] ?? bestMentalAbility(c)

/** Save DC and spell attack bonus with one ability (item bonuses to spell DC and attack included). */
export function castingWith(c: Owner & Parameters<typeof itemBonus>[0], ability: Ability): { ability: Ability; saveDc: number; attackBonus: number } {
  const mod = getAbilityMods(getAbilityScores(c))[ability]
  const level = Math.max(1, (c.classes ?? []).reduce((n, cl) => n + cl.level, 0))
  const prof = 2 + Math.floor((level - 1) / 4)
  return { ability, saveDc: 8 + prof + mod + itemBonus(c, 'spellDc'), attackBonus: prof + mod + itemBonus(c, 'spellAttack') }
}

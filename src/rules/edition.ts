import type { Character } from '../model/character'
import type { RulesEdition } from './types'

/** The character's rules edition: '2024' (SRD 5.2) or '2014' (SRD 5.1, also every save from before the option). */
export const rulesEdition = (c: Partial<Pick<Character, 'rulesEdition'>>): RulesEdition => c.rulesEdition ?? '2014'

/** 2024 spell-style rules (pact weapon with CHA) apply: a 2024 character, or an older save that switched its spells to 2024. */
export const uses2024Spells = (c: Partial<Pick<Character, 'rulesEdition' | 'spellEdition'>>) =>
  (c.spellEdition ?? rulesEdition(c)) === '2024'

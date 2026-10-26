// Topics for the builder's "why?" tips. The text lives in i18n/locales as why.<topic>.title / .text,
// plus a pitch per SRD race and class (why.race.<id>, why.class.<id>) and per 2024 species (why.race2024.<id>).
import { en, type MessageKey } from '../i18n/locales/en'

export const WHY_TOPICS = [
  'step.race', 'step.class', 'step.abilities', 'step.skills', 'step.equipment', 'step.details',
  'edition', 'originFeat', 'bgBonus',
  'subrace', 'traits', 'languages',
  'level', 'savingThrows', 'proficiencies', 'features',
  'method.standard', 'method.pointBuy', 'method.manual', 'suggest', 'racial', 'modifier', 'freeBonus',
  'background', 'skills',
  'kit',
  'alignment',
] as const

export type WhyId = (typeof WHY_TOPICS)[number]

/** Message key for why a new player might pick this race or class; none for homebrew. */
export function pitchKey(kind: 'race' | 'race2024' | 'class', id: string): MessageKey | undefined {
  const key = `why.${kind}.${id}`
  return key in en ? (key as MessageKey) : undefined
}

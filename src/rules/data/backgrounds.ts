import type { Character } from '../../model/character'
import type { Background, RulesEdition } from '../types'
import { BOOK_BACKGROUNDS_2024 } from './books/backgrounds2024'
import { BACKGROUNDS_2024 } from './srd52/backgrounds'
import { BOOK_BACKGROUNDS } from './books/backgrounds'

// 2014 backgrounds: the SRD 5.1's Acolyte, then every background from the official books.
export const BACKGROUNDS: Background[] = [
  {
    id: 'acolyte',
    name: 'Acolyte',
    skillProficiencies: ['insight', 'religion'],
    languageChoices: 2,
    feature: 'Shelter of the Faithful',
    equipment: ['holy-symbol', 'prayer-book', 'incense', 'vestments', 'clothes-common', 'pouch'],
    gold: 15,
  },
  ...BOOK_BACKGROUNDS,
]

export const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
]

/** A homebrew background and the editions it is offered in. */
export type HomebrewBackgroundDef = Background & { editions: RulesEdition[] }

// Homebrew backgrounds registered at runtime (ids namespaced `hb:<packId>:<slug>`).
let homebrew: HomebrewBackgroundDef[] = []

/** Replace the registered homebrew backgrounds. SRD ids always win. */
export function registerHomebrewBackgrounds(list: HomebrewBackgroundDef[]): void {
  const srd = new Set([...BACKGROUNDS, ...BACKGROUNDS_2024, ...BOOK_BACKGROUNDS_2024].map(b => b.id))
  homebrew = list.filter(b => !srd.has(b.id) && b.id !== CUSTOM_BACKGROUND)
}

/** Backgrounds of an edition: the SRD ones, the books' (2024), then homebrew ones offered in it. */
export const backgroundsFor = (edition: RulesEdition = '2014'): Background[] => [
  ...(edition === '2024' ? [...BACKGROUNDS_2024, ...BOOK_BACKGROUNDS_2024] : BACKGROUNDS),
  // 2014 has no background ability scores or Origin feat, so a two-edition homebrew background drops them there.
  ...homebrew.filter(b => b.editions.includes(edition)).map(b => (edition === '2024' ? b : { ...b, abilityScores: undefined, feat: undefined })),
]

export const backgroundById = (id: string, edition: RulesEdition = '2014') => backgroundsFor(edition).find(b => b.id === id)

/** Id of the PHB custom background (any two skills, two tools or languages). */
export const CUSTOM_BACKGROUND = 'custom'

/** The character's background, including a custom one built in the builder (2014 only). */
export function getBackground(c: Pick<Character, 'backgroundId' | 'customBackground'> & Partial<Pick<Character, 'rulesEdition'>>): Background | undefined {
  if (c.backgroundId !== CUSTOM_BACKGROUND || c.rulesEdition === '2024') return backgroundById(c.backgroundId, c.rulesEdition)
  const cb = c.customBackground
  if (!cb) return undefined
  return {
    id: CUSTOM_BACKGROUND,
    name: cb.name.trim() || 'Custom background',
    skillProficiencies: cb.skills,
    toolProficiencies: cb.tools,
    languages: cb.languages,
    feature: cb.feature.trim() || 'Custom feature',
    equipment: [],
  }
}

import type { Character } from '../../model/character'
import type { Background } from '../types'

// The SRD 5.1 includes only one background.
export const BACKGROUNDS: Background[] = [
  {
    id: 'acolyte',
    name: 'Acolyte',
    skillProficiencies: ['insight', 'religion'],
    languageChoices: 2,
    feature: 'Shelter of the Faithful',
    equipment: ['holy-symbol', 'prayer-book', 'vestments'],
  },
]

export const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
]

export const backgroundById = (id: string) => BACKGROUNDS.find(b => b.id === id)

/** Id of the PHB custom background (any two skills, two tools or languages). */
export const CUSTOM_BACKGROUND = 'custom'

/** The character's background, including a custom one built in the builder. */
export function getBackground(c: Pick<Character, 'backgroundId' | 'customBackground'>): Background | undefined {
  if (c.backgroundId !== CUSTOM_BACKGROUND) return backgroundById(c.backgroundId)
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

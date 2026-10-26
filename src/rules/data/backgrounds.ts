import type { Character } from '../../model/character'
import type { Background, RulesEdition } from '../types'
import { BACKGROUNDS_2024 } from './srd52/backgrounds'

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

/** SRD backgrounds of an edition. */
export const backgroundsFor = (edition: RulesEdition = '2014'): Background[] => (edition === '2024' ? BACKGROUNDS_2024 : BACKGROUNDS)

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

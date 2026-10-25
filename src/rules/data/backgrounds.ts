import type { Background } from '../types'

// The SRD 5.1 includes only one background.
export const BACKGROUNDS: Background[] = [
  {
    id: 'acolyte',
    name: 'Acolyte',
    skillProficiencies: ['insight', 'religion'],
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

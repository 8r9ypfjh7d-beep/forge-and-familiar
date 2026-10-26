import type { Background } from '../../types'
import { GAMING_SETS } from '../proficiencies'

// SRD 5.2 (2024) backgrounds: three abilities to raise, two skills, a tool, an Origin feat and gear (option A).
// Every 2024 character knows Common plus two languages of their choice; the background carries them.
const ORIGIN_LANGUAGES = { languages: ['Common'], languageChoices: 2 }

export const BACKGROUNDS_2024: Background[] = [
  {
    id: 'acolyte', name: 'Acolyte', abilityScores: ['int', 'wis', 'cha'],
    skillProficiencies: ['insight', 'religion'], toolProficiencies: ["Calligrapher's supplies"], ...ORIGIN_LANGUAGES,
    feat: { id: 'magic-initiate', note: 'Cleric' }, feature: 'Magic Initiate (Cleric)',
    equipment: ['calligraphers-supplies', 'book', 'holy-symbol', ...Array(10).fill('parchment'), 'robe'], gold: 8,
  },
  {
    id: 'criminal', name: 'Criminal', abilityScores: ['dex', 'con', 'int'],
    skillProficiencies: ['sleightOfHand', 'stealth'], toolProficiencies: ["Thieves' tools"], ...ORIGIN_LANGUAGES,
    feat: { id: 'alert' }, feature: 'Alert',
    equipment: ['dagger', 'dagger', 'thieves-tools', 'crowbar', 'pouch', 'pouch', 'clothes-travelers'], gold: 16,
  },
  {
    id: 'sage', name: 'Sage', abilityScores: ['con', 'int', 'wis'],
    skillProficiencies: ['arcana', 'history'], toolProficiencies: ["Calligrapher's supplies"], ...ORIGIN_LANGUAGES,
    feat: { id: 'magic-initiate', note: 'Wizard' }, feature: 'Magic Initiate (Wizard)',
    equipment: ['quarterstaff', 'calligraphers-supplies', 'book', ...Array(8).fill('parchment'), 'robe'], gold: 8,
  },
  {
    id: 'soldier', name: 'Soldier', abilityScores: ['str', 'dex', 'con'],
    skillProficiencies: ['athletics', 'intimidation'], toolChoices: { count: 1, from: GAMING_SETS }, ...ORIGIN_LANGUAGES,
    feat: { id: 'savage-attacker' }, feature: 'Savage Attacker',
    equipment: ['spear', 'shortbow', 'arrows', 'healers-kit', 'quiver', 'clothes-travelers'], gold: 14,
  },
]

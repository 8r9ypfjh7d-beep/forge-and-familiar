// Languages and tools the builder lets players choose from: the SRD lists plus the names of every other official
// language and tool (2014 and 2024 books, setting guides, monster tongues). Names only; explanations are ours.
import type { RulesEdition } from '../types'

/** 2014 standard languages. */
export const STANDARD_LANGUAGES = ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc']
/** 2014 exotic languages. */
export const EXOTIC_LANGUAGES = ['Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon']
/** 2024 standard languages: Draconic moved here and Common Sign Language joined. */
export const STANDARD_LANGUAGES_2024 = ['Common', 'Common Sign Language', 'Draconic', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc']
/** 2024 rare languages, including the two class languages. */
export const RARE_LANGUAGES_2024 = ['Abyssal', 'Celestial', 'Deep Speech', 'Druidic', 'Infernal', 'Primordial', 'Sylvan', "Thieves' Cant", 'Undercommon']
/** Taught only by a class (Druid, Rogue). Others may pick them with a warning. */
export const SECRET_LANGUAGES = ['Druidic', "Thieves' Cant"]
/** Primordial's four dialects; a speaker of one understands the others. */
export const PRIMORDIAL_DIALECTS = ['Aquan', 'Auran', 'Ignan', 'Terran']
export const SIGN_LANGUAGES = ['Common Sign Language', 'Drow Sign Language']
/** Languages of playable peoples from setting books (Ravnica, Theros, Eberron, Spelljammer...). */
export const SPECIES_LANGUAGES = [
  'Aarakocra', 'Gith', 'Grung', 'Kraul', 'Leonin', 'Loxodon', 'Merfolk', 'Minotaur', 'Quori', 'Thri-kreen', 'Vedalken',
]
/** Regional human tongues of the Forgotten Realms, Eberron and Exandria. */
export const SETTING_LANGUAGES = [
  'Aglarondan', 'Alzhedo', 'Chondathan', 'Damaran', 'Dambrathan', 'Durpari', 'Halruaan', 'Illuskan', 'Lantanese',
  'Loross', 'Midani', 'Mulhorandi', 'Nexalan', 'Olman', 'Rashemi', 'Serusan', 'Shaaran', 'Shou', 'Tashalan', 'Thorass',
  'Tuigan', 'Turmic', 'Uluik', 'Untheric', 'Riedran', 'Marquesian', 'Naush', 'Zemnian',
]
/** Monster tongues from the Monster Manual and other bestiaries. */
export const MONSTER_LANGUAGES = [
  'Blink Dog', 'Bullywug', 'Giant Eagle', 'Giant Elk', 'Giant Owl', 'Gnoll', 'Grell', 'Hook Horror', 'Ice Toad',
  'Ixitxachitl', 'Modron', 'Otyugh', 'Sahuagin', 'Slaad', 'Sphinx', 'Tlincalli', 'Troglodyte', 'Umber Hulk',
  'Vegepygmy', 'Winter Wolf', 'Worg', 'Yeti',
]
export const LANGUAGES = [...new Set([
  ...STANDARD_LANGUAGES_2024, ...EXOTIC_LANGUAGES, ...SECRET_LANGUAGES, ...PRIMORDIAL_DIALECTS, ...SIGN_LANGUAGES,
  ...SPECIES_LANGUAGES, ...SETTING_LANGUAGES, ...MONSTER_LANGUAGES,
])]

export type LanguageGroupId = 'standard' | 'exotic' | 'rare' | 'secret' | 'dialect' | 'sign' | 'species' | 'setting' | 'monster'

/** Languages in picker order for an edition: the book's table first, then everything else official. */
export function languageGroups(edition: RulesEdition = '2014'): { id: LanguageGroupId; languages: string[] }[] {
  const book = edition === '2024'
    ? [{ id: 'standard' as const, languages: STANDARD_LANGUAGES_2024 }, { id: 'rare' as const, languages: RARE_LANGUAGES_2024 }]
    : [{ id: 'standard' as const, languages: STANDARD_LANGUAGES }, { id: 'exotic' as const, languages: EXOTIC_LANGUAGES }, { id: 'secret' as const, languages: SECRET_LANGUAGES }]
  const inBook = book.flatMap(g => g.languages)
  return [
    ...book,
    { id: 'dialect', languages: PRIMORDIAL_DIALECTS },
    { id: 'sign', languages: SIGN_LANGUAGES.filter(l => !inBook.includes(l)) },
    { id: 'species', languages: SPECIES_LANGUAGES },
    { id: 'setting', languages: SETTING_LANGUAGES },
    { id: 'monster', languages: MONSTER_LANGUAGES },
  ]
}

/** The edition's standard and exotic/rare table without class languages: what random characters pick from. */
export const tableLanguages = (edition: RulesEdition = '2014') =>
  languageGroups(edition).filter(g => g.id === 'standard' || g.id === 'exotic' || g.id === 'rare')
    .flatMap(g => g.languages).filter(l => !SECRET_LANGUAGES.includes(l))

export const ARTISAN_TOOLS = [
  "Alchemist's supplies", "Brewer's supplies", "Calligrapher's supplies", "Carpenter's tools", "Cartographer's tools",
  "Cobbler's tools", "Cook's utensils", "Glassblower's tools", "Jeweler's tools", "Leatherworker's tools",
  "Mason's tools", "Painter's supplies", "Potter's tools", "Smith's tools", "Tinker's tools", "Weaver's tools",
  "Woodcarver's tools",
]
export const GAMING_SETS = ['Dice set', 'Dragonchess set', 'Playing card set', 'Three-Dragon Ante set']
/** SRD instruments, then the Forgotten Realms ones from the Sword Coast guide. */
export const MUSICAL_INSTRUMENTS = [
  'Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Lute', 'Lyre', 'Horn', 'Pan flute', 'Shawm', 'Viol',
  'Birdpipes', 'Glaur', 'Hand drum', 'Longhorn', 'Songhorn', 'Tantan', 'Thelarr', 'Tocken', 'Wargong', 'Yarting', 'Zulkoon',
]
export const OTHER_TOOLS = [
  'Disguise kit', 'Forgery kit', 'Herbalism kit', "Navigator's tools", "Poisoner's kit", "Thieves' tools",
  'Vehicles (land)', 'Vehicles (water)', 'Vehicles (air)', 'Vehicles (space)',
]
export const TOOLS = [...ARTISAN_TOOLS, ...GAMING_SETS, ...MUSICAL_INSTRUMENTS, ...OTHER_TOOLS]

export type ToolGroupId = 'artisan' | 'gaming' | 'instrument' | 'other'
export const TOOL_GROUPS: { id: ToolGroupId; tools: string[] }[] = [
  { id: 'artisan', tools: ARTISAN_TOOLS },
  { id: 'gaming', tools: GAMING_SETS },
  { id: 'instrument', tools: MUSICAL_INSTRUMENTS },
  { id: 'other', tools: OTHER_TOOLS },
]

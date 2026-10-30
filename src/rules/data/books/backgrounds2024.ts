import type { Ability, Background, SkillId } from '../../types'
import { ARTISAN_TOOLS, GAMING_SETS, MUSICAL_INSTRUMENTS } from '../proficiencies'
import { PHB24 } from './helpers'

// 2024-rules backgrounds from the official books outside the SRD. Only names and mechanics live here: what each
// background is about is a short original summary in src/i18n/locales/explain.backgrounds.*.ts (never rulebook text).
// Every one also offers 50 GP instead of its gear (option B); the gear listed is option A.

export const HOF = 'Forgotten Realms: Heroes of Faerûn'
export const EFA = 'Eberron: Forge of the Artificer'
export const ABH = "Astarion's Book of Hungers"
export const RHW = 'Ravenloft: The Horrors Within'
export const AUL = 'Arcana Unleashed'
export const LFL = 'Lorwyn: First Light'
export const DDB = 'D&D Beyond (May 2026)'

/** A tool the background picks from a group; the gear then holds the matching "(your pick)" item. */
type Tool = string | 'artisan' | 'gaming' | 'instrument'
const PICKS: Record<string, string[]> = { artisan: ARTISAN_TOOLS, gaming: GAMING_SETS, instrument: MUSICAL_INSTRUMENTS }

type Feat = string | { id: string; name?: string; note?: string }
const n = (count: number, id: string): string[] => Array(count).fill(id)
const ORIGIN_LANGUAGES = { languages: ['Common'], languageChoices: 2 }

function bg(
  id: string, name: string, source: string, abilities: Ability[], skills: SkillId[], tool: Tool, feat: Feat,
  equipment: string[], gold: number,
): Background {
  const f = typeof feat === 'string' ? { id: feat } : feat
  return {
    id, name, source, abilityScores: abilities, skillProficiencies: skills,
    ...(PICKS[tool] ? { toolChoices: { count: 1, from: PICKS[tool] } } : { toolProficiencies: [tool] }),
    ...ORIGIN_LANGUAGES,
    feat: f, feature: `${f.name ?? featName(f.id)}${f.note ? ` (${f.note})` : ''}`,
    equipment, gold,
  }
}

/** "tavern-brawler" → "Tavern Brawler", for the summary line until the feat itself is defined. */
const featName = (id: string) => id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

const MI = (list: string) => ({ id: 'magic-initiate', note: list })
const DARK_GIFT = { id: 'dark-gift', name: 'A Dark Gift feat' }

export const BOOK_BACKGROUNDS_2024: Background[] = [
  // ---------- Player's Handbook (2024), the ones outside the SRD ----------
  bg('artisan', 'Artisan', PHB24, ['str', 'dex', 'int'], ['investigation', 'persuasion'], 'artisan', 'crafter',
    ['artisans-tools', ...n(2, 'pouch'), 'clothes-travelers'], 32),
  bg('charlatan', 'Charlatan', PHB24, ['dex', 'con', 'cha'], ['deception', 'sleightOfHand'], 'Forgery kit', 'skilled',
    ['forgery-kit', 'costume', 'clothes-fine'], 15),
  bg('entertainer', 'Entertainer', PHB24, ['str', 'dex', 'cha'], ['acrobatics', 'performance'], 'instrument', 'musician',
    ['musical-instrument', ...n(2, 'costume'), 'mirror', 'perfume', 'clothes-travelers'], 11),
  bg('farmer', 'Farmer', PHB24, ['str', 'con', 'wis'], ['animalHandling', 'nature'], "Carpenter's tools", 'tough',
    ['sickle', 'carpenters-tools', 'healers-kit', 'iron-pot', 'shovel', 'clothes-travelers'], 30),
  bg('guard', 'Guard', PHB24, ['str', 'int', 'wis'], ['athletics', 'perception'], 'gaming', 'alert',
    ['spear', 'light-crossbow', 'bolts', 'gaming-set', 'lantern-hooded', 'manacles', 'quiver', 'clothes-travelers'], 12),
  bg('guide', 'Guide', PHB24, ['dex', 'con', 'wis'], ['stealth', 'survival'], "Cartographer's tools", MI('Druid'),
    ['shortbow', 'arrows', 'cartographers-tools', 'bedroll', 'quiver', 'tent', 'clothes-travelers'], 3),
  bg('hermit', 'Hermit', PHB24, ['con', 'wis', 'cha'], ['medicine', 'religion'], 'Herbalism kit', 'healer',
    ['quarterstaff', 'herbalism-kit', 'bedroll', 'book', 'lamp', ...n(3, 'oil'), 'clothes-travelers'], 16),
  bg('merchant', 'Merchant', PHB24, ['con', 'int', 'cha'], ['animalHandling', 'persuasion'], "Navigator's tools", 'lucky',
    ['navigators-tools', ...n(2, 'pouch'), 'clothes-travelers'], 22),
  bg('noble', 'Noble', PHB24, ['str', 'int', 'cha'], ['history', 'persuasion'], 'gaming', 'skilled',
    ['gaming-set', 'clothes-fine', 'perfume'], 29),
  bg('sailor', 'Sailor', PHB24, ['str', 'dex', 'wis'], ['acrobatics', 'perception'], "Navigator's tools", 'tavern-brawler',
    ['dagger', 'navigators-tools', 'rope', 'clothes-travelers'], 20),
  bg('scribe', 'Scribe', PHB24, ['dex', 'int', 'wis'], ['investigation', 'perception'], "Calligrapher's supplies", 'skilled',
    ['calligraphers-supplies', 'clothes-fine', 'lamp', ...n(3, 'oil'), ...n(12, 'parchment')], 23),
  bg('wayfarer', 'Wayfarer', PHB24, ['dex', 'wis', 'cha'], ['insight', 'stealth'], "Thieves' tools", 'lucky',
    [...n(2, 'dagger'), 'thieves-tools', 'gaming-set', 'bedroll', ...n(2, 'pouch'), 'clothes-travelers'], 16),

  // ---------- Forgotten Realms: Heroes of Faerûn ----------
  bg('chondathan-freebooter', 'Chondathan Freebooter', HOF, ['str', 'dex', 'wis'], ['athletics', 'sleightOfHand'], "Weaver's tools", 'skilled',
    ['dagger', 'weavers-tools', 'backpack', 'ball-bearings', 'basket', 'bedroll', 'bucket', 'rations', 'rope', 'signal-whistle', 'clothes-travelers'], 38),
  bg('dead-magic-dweller', 'Dead Magic Dweller', HOF, ['str', 'con', 'wis'], ['medicine', 'survival'], "Leatherworker's tools", 'healer',
    ['greatclub', 'leatherworkers-tools', 'bedroll', 'blanket', 'healers-kit', 'pole', 'rations', 'tent', 'tinderbox', 'torch', 'clothes-travelers', 'waterskin'], 32),
  bg('dragon-cultist', 'Dragon Cultist', HOF, ['dex', 'con', 'int'], ['deception', 'stealth'], "Calligrapher's supplies", 'cult-of-the-dragon-initiate',
    ['calligraphers-supplies', 'dagger', 'glass-bottle', 'lamp', 'manacles', ...n(5, 'oil'), ...n(2, 'pouch'), 'robe', 'rope'], 30),
  bg('emerald-enclave-caretaker', 'Emerald Enclave Caretaker', HOF, ['con', 'int', 'wis'], ['nature', 'survival'], 'Herbalism kit', 'emerald-enclave-fledgling',
    ['shortbow', 'arrows', 'herbalism-kit', 'bedroll', 'blanket', 'pouch', 'tent', 'clothes-travelers'], 13),
  bg('flaming-fist-mercenary', 'Flaming Fist Mercenary', HOF, ['str', 'con', 'cha'], ['intimidation', 'perception'], "Smith's tools", 'tough',
    ['mace', 'smiths-tools', 'clothes-fine', 'manacles', 'portable-ram'], 4),
  bg('genie-touched', 'Genie Touched', HOF, ['dex', 'wis', 'cha'], ['perception', 'persuasion'], "Glassblower's tools", MI('Wizard'),
    ['light-hammer', 'glassblowers-tools', 'clothes-fine', 'lamp', ...n(3, 'oil'), 'waterskin'], 2),
  bg('harper', 'Harper', HOF, ['dex', 'int', 'cha'], ['performance', 'sleightOfHand'], 'Disguise kit', 'harper-agent',
    ['disguise-kit', 'bedroll', 'costume', 'grappling-hook', 'rope', 'clothes-travelers'], 14),
  bg('ice-fisher', 'Ice Fisher', HOF, ['str', 'dex', 'con'], ['animalHandling', 'athletics'], "Woodcarver's tools", 'alert',
    ['woodcarvers-tools', 'basket', 'block-and-tackle', 'bucket', 'chain', 'hunting-trap', 'net', 'pole', 'rations', 'rope', 'clothes-travelers'], 32),
  bg('knight-of-the-gauntlet', 'Knight of the Gauntlet', HOF, ['str', 'int', 'wis'], ['athletics', 'medicine'], "Smith's tools", 'tyro-of-the-gauntlet',
    ['spear', 'smiths-tools', 'lantern-bullseye', 'holy-symbol', 'manacles', ...n(5, 'oil'), 'tinderbox', 'clothes-travelers'], 9),
  bg('lords-alliance-vassal', "Lords' Alliance Vassal", HOF, ['str', 'int', 'cha'], ['insight', 'persuasion'], "Calligrapher's supplies", { id: 'lords-alliance-agent', name: "Lords' Alliance Agent" },
    [...n(2, 'javelin'), 'calligraphers-supplies', 'clothes-fine', 'ink', ...n(5, 'ink-pen'), ...n(9, 'parchment')], 13),
  bg('moonwell-pilgrim', 'Moonwell Pilgrim', HOF, ['con', 'wis', 'cha'], ['nature', 'performance'], "Painter's supplies", MI('Druid'),
    ['quarterstaff', 'painters-supplies', 'bedroll', 'bell', 'pouch', 'robe', 'string', 'clothes-travelers', 'waterskin'], 34),
  bg('mulhorandi-tomb-raider', 'Mulhorandi Tomb Raider', HOF, ['dex', 'con', 'int'], ['investigation', 'religion'], "Mason's tools", 'lucky',
    ['dagger', 'light-hammer', 'masons-tools', 'backpack', 'bedroll', 'crowbar', 'ladder', 'pole', ...n(2, 'pouch'), 'rope', 'string', 'tinderbox', 'torch', 'clothes-travelers', 'waterskin'], 26),
  bg('mythalkeeper', 'Mythalkeeper', HOF, ['int', 'wis', 'cha'], ['arcana', 'history'], "Jeweler's tools", 'crafter',
    ['quarterstaff', 'jewelers-tools', 'perfume', 'pouch', 'robe', 'shovel', 'string', 'waterskin'], 16),
  bg('purple-dragon-squire', 'Purple Dragon Squire', HOF, ['str', 'wis', 'cha'], ['animalHandling', 'insight'], "Navigator's tools", 'purple-dragon-rook',
    ['spear', 'navigators-tools', 'clothes-fine'], 9),
  bg('rashemi-wanderer', 'Rashemi Wanderer', HOF, ['str', 'con', 'cha'], ['intimidation', 'perception'], "Cartographer's tools", 'tough',
    ['cartographers-tools', 'backpack', 'bedroll', 'lantern-hooded', ...n(3, 'oil'), 'rope', 'tinderbox', 'clothes-travelers', 'waterskin'], 23),
  bg('shadowmasters-exile', 'Shadowmasters Exile', HOF, ['dex', 'int', 'cha'], ['acrobatics', 'stealth'], "Thieves' tools", 'savage-attacker',
    [...n(2, 'dagger'), 'thieves-tools', 'caltrops', 'costume', 'grappling-hook', 'iron-spikes', 'mirror', ...n(2, 'pouch'), 'rope', 'clothes-travelers'], 3),
  bg('spellfire-initiate', 'Spellfire Initiate', HOF, ['con', 'int', 'cha'], ['arcana', 'perception'], 'gaming', 'spellfire-spark',
    ['gaming-set', 'arcane-focus', ...n(2, 'pouch'), 'clothes-travelers'], 36),
  bg('zhentarim-mercenary', 'Zhentarim Mercenary', HOF, ['str', 'dex', 'cha'], ['intimidation', 'perception'], 'Forgery kit', 'zhentarim-ruffian',
    ['club', 'dagger', 'forgery-kit', 'clothes-fine', 'lantern-hooded', ...n(3, 'oil'), ...n(2, 'pouch'), 'string', 'tinderbox'], 11),

  // ---------- Eberron: Forge of the Artificer ----------
  bg('aberrant-heir', 'Aberrant Heir', EFA, ['str', 'con', 'cha'], ['history', 'intimidation'], 'Disguise kit', 'aberrant-dragonmark',
    ['dagger', 'disguise-kit', 'costume', 'clothes-travelers'], 16),
  bg('archaeologist', 'Archaeologist', EFA, ['dex', 'int', 'wis'], ['history', 'survival'], "Cartographer's tools", 'skilled',
    ['cartographers-tools', 'lantern-bullseye', 'map', 'map-case', 'shovel', 'tent', 'clothes-travelers'], 17),
  bg('house-agent', 'House Agent', EFA, ['str', 'int', 'cha'], ['investigation', 'persuasion'], 'artisan', 'lucky',
    ['artisans-tools', 'clothes-fine'], 20),
  bg('house-cannith-heir', 'House Cannith Heir', EFA, ['str', 'dex', 'int'], ['investigation', 'sleightOfHand'], 'artisan', 'mark-of-making',
    ['artisans-tools', 'crowbar', 'clothes-fine', ...n(2, 'pouch')], 17),
  bg('house-deneith-heir', 'House Deneith Heir', EFA, ['str', 'con', 'wis'], ['insight', 'perception'], 'gaming', 'mark-of-sentinel',
    ['spear', 'shortbow', 'arrows', 'gaming-set', 'clothes-fine', 'healers-kit', 'quiver'], 1),
  bg('house-ghallanda-heir', 'House Ghallanda Heir', EFA, ['dex', 'wis', 'cha'], ['insight', 'persuasion'], "Cook's utensils", 'mark-of-hospitality',
    ['cooks-utensils', 'clothes-fine', 'iron-pot', 'lamp', ...n(5, 'oil'), 'perfume'], 26),
  bg('house-jorasco-heir', 'House Jorasco Heir', EFA, ['dex', 'con', 'wis'], ['medicine', 'stealth'], 'Herbalism kit', 'mark-of-healing',
    ['herbalism-kit', 'clothes-fine', 'healers-kit'], 25),
  bg('house-kundarak-heir', 'House Kundarak Heir', EFA, ['str', 'con', 'int'], ['arcana', 'investigation'], "Thieves' tools", 'mark-of-warding',
    ['thieves-tools', 'clothes-fine'], 10),
  bg('house-lyrandar-heir', 'House Lyrandar Heir', EFA, ['str', 'dex', 'cha'], ['acrobatics', 'nature'], "Navigator's tools", 'mark-of-storm',
    ['navigators-tools', 'clothes-fine'], 10),
  bg('house-medani-heir', 'House Medani Heir', EFA, ['dex', 'int', 'wis'], ['insight', 'investigation'], 'Disguise kit', 'mark-of-detection',
    ['disguise-kit', 'clothes-fine'], 10),
  bg('house-orien-heir', 'House Orien Heir', EFA, ['dex', 'con', 'int'], ['acrobatics', 'athletics'], "Cartographer's tools", 'mark-of-passage',
    ['cartographers-tools', 'clothes-fine', 'map', 'map-case'], 18),
  bg('house-phiarlan-heir', 'House Phiarlan Heir', EFA, ['dex', 'wis', 'cha'], ['deception', 'stealth'], 'Disguise kit', 'mark-of-shadow',
    ['disguise-kit', 'clothes-fine'], 10),
  bg('house-sivis-heir', 'House Sivis Heir', EFA, ['int', 'wis', 'cha'], ['history', 'perception'], "Calligrapher's supplies", 'mark-of-scribing',
    ['calligraphers-supplies', 'clothes-fine', 'ink', ...n(5, 'ink-pen'), ...n(30, 'paper'), ...n(9, 'parchment')], 8),
  bg('house-tharashk-heir', 'House Tharashk Heir', EFA, ['con', 'int', 'wis'], ['perception', 'survival'], 'gaming', 'mark-of-finding',
    ['gaming-set', 'climbers-kit', 'clothes-fine', 'hunting-trap', 'manacles'], 2),
  bg('house-thuranni-heir', 'House Thuranni Heir', EFA, ['dex', 'int', 'cha'], ['performance', 'stealth'], 'instrument', 'mark-of-shadow',
    ['musical-instrument', 'costume', 'clothes-fine'], 13),
  bg('house-vadalis-heir', 'House Vadalis Heir', EFA, ['con', 'wis', 'cha'], ['animalHandling', 'nature'], 'Herbalism kit', 'mark-of-handling',
    ['herbalism-kit', 'clothes-fine', 'net'], 29),
  bg('inquisitive', 'Inquisitive', EFA, ['con', 'int', 'cha'], ['insight', 'investigation'], "Thieves' tools", 'alert',
    ['thieves-tools', 'lantern-bullseye', 'crowbar', ...n(10, 'oil'), 'clothes-travelers'], 10),

  // ---------- Astarion's Book of Hungers ----------
  bg('carouser', 'Carouser', ABH, ['dex', 'int', 'cha'], ['deception', 'persuasion'], 'gaming', 'tireless-reveler',
    ['dagger', 'gaming-set', 'clothes-fine', 'glass-bottle', 'mirror', 'perfume', 'pouch', 'tinderbox'], 19),
  bg('vampire-devotee', 'Vampire Devotee', ABH, ['str', 'con', 'cha'], ['persuasion', 'stealth'], "Cook's utensils", { id: 'vampires-plaything', name: "Vampire's Plaything" },
    ['cooks-utensils', 'clothes-fine', ...n(2, 'glass-bottle'), 'healers-kit', 'perfume', 'lamp', ...n(3, 'oil'), 'waterskin'], 19),
  bg('vampire-survivor', 'Vampire Survivor', ABH, ['dex', 'con', 'wis'], ['insight', 'religion'], "Woodcarver's tools", 'vampire-hunter',
    ['woodcarvers-tools', 'crowbar', 'lantern-hooded', 'holy-symbol', 'holy-water', 'mirror', ...n(3, 'oil'), 'tinderbox', 'clothes-travelers', 'waterskin'], 4),

  // ---------- Ravenloft: The Horrors Within ----------
  bg('haunted-one', 'Haunted One', RHW, ['con', 'wis', 'cha'], ['arcana', 'survival'], 'gaming', { id: 'survivor', note: 'or a Dark Gift feat' },
    ['gaming-set', 'crowbar', 'holy-water', 'mirror', ...n(2, 'oil'), 'signal-whistle', 'tinderbox', 'clothes-travelers', 'torch', 'waterskin'], 14),
  bg('investigator', 'Investigator', RHW, ['int', 'wis', 'cha'], ['insight', 'investigation'], 'Disguise kit', { id: 'sharp-eye', note: 'or a Dark Gift feat' },
    ['disguise-kit', 'manacles', 'shovel', 'clothes-travelers', ...n(3, 'vial')], 16),
  bg('mist-wanderer', 'Mist Wanderer', RHW, ['dex', 'con', 'wis'], ['survival', 'stealth'], 'artisan', { ...DARK_GIFT, note: 'Mist Walker suggested' },
    ['artisans-tools', 'lamp', ...n(5, 'oil'), 'pouch', 'rope', 'tinderbox', 'clothes-travelers'], 30),
  bg('spirit-medium', 'Spirit Medium', RHW, ['con', 'int', 'wis'], ['insight', 'religion'], 'gaming', { ...DARK_GIFT, note: 'Gathered Whispers suggested' },
    ['dagger', 'gaming-set', 'basket', 'bell', ...n(8, 'candle'), 'ink', 'ink-pen', ...n(5, 'paper'), 'tinderbox', 'clothes-travelers'], 32),

  // ---------- Arcana Unleashed ----------
  bg('agent-of-the-ninth-quill', 'Agent of the Ninth Quill', AUL, ['dex', 'int', 'cha'], ['arcana', 'sleightOfHand'], "Thieves' tools", 'arcane-infiltrator',
    ['dagger', 'light-hammer', 'thieves-tools', 'iron-spikes', 'rope', 'clothes-travelers'], 17),
  bg('bejeweled-conclave-spy', 'Bejeweled Conclave Spy', AUL, ['dex', 'wis', 'cha'], ['deception', 'perception'], 'Disguise kit', 'arcane-eloquence',
    ['disguise-kit', 'clothes-fine', 'perfume'], 5),
  bg('cosmic-dawn-experiment', 'Cosmic Dawn Experiment', AUL, ['str', 'dex', 'con'], ['athletics', 'survival'], 'artisan', 'transmuted-anatomy',
    ['artisans-tools', 'backpack', 'robe', 'clothes-travelers'], 30),
  bg('covenant-of-the-grave-recruit', 'Covenant of the Grave Recruit', AUL, ['str', 'int', 'wis'], ['history', 'medicine'], 'Herbalism kit', 'arcane-undertaker',
    ['dagger', 'herbalism-kit', 'book', 'shovel'], 16),
  bg('crucible-storm-chaser', 'Crucible Storm Chaser', AUL, ['str', 'con', 'int'], ['athletics', 'nature'], "Glassblower's tools", 'arcane-overload',
    ['glassblowers-tools', 'backpack', 'rope', 'clothes-travelers'], 15),
  bg('familiar-trainer', 'Familiar Trainer', AUL, ['con', 'int', 'wis'], ['animalHandling', 'arcana'], 'gaming', 'familiar-friend',
    ['quarterstaff', 'gaming-set', 'bedroll', 'bell', 'string', 'tinderbox', 'clothes-travelers', 'waterskin'], 44),
  bg('horizon-weaver-initiate', 'Horizon Weaver Initiate', AUL, ['dex', 'con', 'wis'], ['acrobatics', 'survival'], "Weaver's tools", 'portal-jumper',
    ['shortbow', 'arrows', 'weavers-tools', 'map', 'quiver', 'rope', 'clothes-travelers'], 18),
  bg('phantasmic-circus-trouper', 'Phantasmic Circus Trouper', AUL, ['dex', 'con', 'cha'], ['deception', 'performance'], 'Disguise kit', 'arcane-artist',
    ['disguise-kit', 'gaming-set', 'costume', 'mirror', 'clothes-travelers'], 12),
  bg('seer-apprentice', 'Seer Apprentice', AUL, ['int', 'wis', 'cha'], ['history', 'insight'], "Navigator's tools", 'arcane-omens',
    ['navigators-tools', ...n(8, 'candle'), 'ink', 'ink-pen', ...n(9, 'parchment'), 'pouch', 'tinderbox', 'clothes-travelers'], 11),
  bg('ward-of-the-sheltering-hands', 'Ward of the Sheltering Hands', AUL, ['con', 'wis', 'cha'], ['insight', 'medicine'], "Cook's utensils", 'arcane-safeguard',
    ['cooks-utensils', 'blanket', 'healers-kit', 'lamp', ...n(3, 'oil'), 'tinderbox', 'clothes-travelers', 'waterskin'], 40),

  // ---------- Lorwyn: First Light ----------
  bg('lorwyn-expert', 'Lorwyn Expert', LFL, ['str', 'con', 'wis'], ['athletics', 'nature'], "Cartographer's tools", 'child-of-the-sun',
    ['quarterstaff', 'cartographers-tools', 'backpack', 'basket', ...n(4, 'parchment'), 'rope', 'clothes-travelers'], 29),
  bg('shadowmoor-expert', 'Shadowmoor Expert', LFL, ['dex', 'int', 'cha'], ['acrobatics', 'deception'], "Glassblower's tools", 'shadowmoor-hexer',
    ['dagger', 'glassblowers-tools', 'backpack', 'hunting-trap', 'lamp', ...n(3, 'oil'), 'clothes-travelers', 'waterskin'], 8),

  // ---------- D&D Beyond digital release ----------
  bg('pact-seeker', 'Pact Seeker', DDB, ['con', 'int', 'cha'], ['arcana', 'persuasion'], "Calligrapher's supplies", { id: 'planar-pact', name: 'A Planar Pact feat' },
    ['book', 'calligraphers-supplies', 'ink', 'ink-pen', ...n(10, 'parchment'), 'clothes-travelers'], 2),
]

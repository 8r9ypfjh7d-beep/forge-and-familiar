// 2014-rules backgrounds from the official books outside the SRD: names and mechanics only.
// What each one means is summarized in our own words in i18n/locales/explain.backgrounds.*.ts.
import type { Background, SkillId } from '../../types'
import { ARTISAN_TOOLS, GAMING_SETS, MUSICAL_INSTRUMENTS, TOOLS } from '../proficiencies'
import { PHB, SCAG, VRGR, EGW, MOT, BGG, DSDQ } from './helpers'

const COS = 'Curse of Strahd'
const TOA = 'Tomb of Annihilation'
const GGR = "Guildmasters' Guide to Ravnica"
const GOS = 'Ghosts of Saltmarsh'
const AI = 'Acquisitions Incorporated'
const BGDIA = "Baldur's Gate: Descent into Avernus"
const ERLW = 'Eberron: Rising from the Last War'
const SCC = 'Strixhaven: A Curriculum of Chaos'
const WBW = 'The Wild Beyond the Witchlight'
const SJ = 'Spelljammer: Adventures in Space'
const PAITM = 'Planescape: Adventures in the Multiverse'
const BMT = 'The Book of Many Things'

const tools = (...from: string[][]) => ({ count: 1, from: from.flat() })
const skills = (count: number, ...from: SkillId[]) => ({ count, from })
const MENTAL_SKILLS: SkillId[] = [
  'arcana', 'history', 'investigation', 'nature', 'religion',
  'animalHandling', 'insight', 'medicine', 'perception', 'survival',
  'deception', 'intimidation', 'performance', 'persuasion',
]
const ANY_SKILL: SkillId[] = [...MENTAL_SKILLS, 'athletics', 'acrobatics', 'sleightOfHand', 'stealth']
const STUDENT = { feat: { id: 'strixhaven-initiate' }, feature: 'Strixhaven Initiate' }

export const BOOK_BACKGROUNDS: Background[] = [
  // Player's Handbook, with its variants as their own entries
  {
    id: 'charlatan', name: 'Charlatan', source: PHB, skillProficiencies: ['deception', 'sleightOfHand'],
    toolProficiencies: ['Disguise kit', 'Forgery kit'], feature: 'False Identity',
    equipment: ['clothes-fine', 'disguise-kit', 'keepsake', 'pouch'], gold: 15,
  },
  {
    id: 'criminal', name: 'Criminal', source: PHB, skillProficiencies: ['deception', 'stealth'],
    toolProficiencies: ["Thieves' tools"], toolChoices: tools(GAMING_SETS), feature: 'Criminal Contact',
    equipment: ['crowbar', 'clothes-common', 'pouch'], gold: 15,
  },
  {
    id: 'spy', name: 'Spy', source: PHB, skillProficiencies: ['deception', 'stealth'],
    toolProficiencies: ["Thieves' tools"], toolChoices: tools(GAMING_SETS), feature: 'Criminal Contact',
    equipment: ['crowbar', 'clothes-common', 'pouch'], gold: 15,
  },
  {
    id: 'entertainer', name: 'Entertainer', source: PHB, skillProficiencies: ['acrobatics', 'performance'],
    toolProficiencies: ['Disguise kit'], toolChoices: tools(MUSICAL_INSTRUMENTS), feature: 'By Popular Demand',
    equipment: ['musical-instrument', 'keepsake', 'clothes-costume', 'pouch'], gold: 15,
  },
  {
    id: 'gladiator', name: 'Gladiator', source: PHB, skillProficiencies: ['acrobatics', 'performance'],
    toolProficiencies: ['Disguise kit'], toolChoices: tools(MUSICAL_INSTRUMENTS), feature: 'By Popular Demand',
    equipment: ['trident', 'keepsake', 'clothes-costume', 'pouch'], gold: 15,
  },
  {
    id: 'folk-hero', name: 'Folk Hero', source: PHB, skillProficiencies: ['animalHandling', 'survival'],
    toolProficiencies: ['Vehicles (land)'], toolChoices: tools(ARTISAN_TOOLS), feature: 'Rustic Hospitality',
    equipment: ['artisans-tools', 'shovel', 'iron-pot', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'guild-artisan', name: 'Guild Artisan', source: PHB, skillProficiencies: ['insight', 'persuasion'],
    toolChoices: tools(ARTISAN_TOOLS), languageChoices: 1, feature: 'Guild Membership',
    equipment: ['artisans-tools', 'letter', 'clothes-travelers', 'pouch'], gold: 15,
  },
  {
    id: 'guild-merchant', name: 'Guild Merchant', source: PHB, skillProficiencies: ['insight', 'persuasion'],
    toolChoices: tools(ARTISAN_TOOLS, ["Navigator's tools"]), languageChoices: 1, feature: 'Guild Membership',
    equipment: ['artisans-tools', 'letter', 'clothes-travelers', 'pouch'], gold: 15,
  },
  {
    id: 'hermit', name: 'Hermit', source: PHB, skillProficiencies: ['medicine', 'religion'],
    toolProficiencies: ['Herbalism kit'], languageChoices: 1, feature: 'Discovery',
    equipment: ['scroll-case', 'notes', 'blanket', 'clothes-common', 'herbalism-kit'], gold: 5,
  },
  {
    id: 'noble', name: 'Noble', source: PHB, skillProficiencies: ['history', 'persuasion'],
    toolChoices: tools(GAMING_SETS), languageChoices: 1, feature: 'Position of Privilege',
    equipment: ['clothes-fine', 'signet-ring', 'pedigree', 'pouch'], gold: 25,
  },
  {
    id: 'knight', name: 'Knight', source: PHB, skillProficiencies: ['history', 'persuasion'],
    toolChoices: tools(GAMING_SETS), languageChoices: 1, feature: 'Retainers',
    equipment: ['clothes-fine', 'signet-ring', 'pedigree', 'keepsake', 'pouch'], gold: 25,
  },
  {
    id: 'outlander', name: 'Outlander', source: PHB, skillProficiencies: ['athletics', 'survival'],
    toolChoices: tools(MUSICAL_INSTRUMENTS), languageChoices: 1, feature: 'Wanderer',
    equipment: ['quarterstaff', 'hunting-trap', 'trophy', 'clothes-travelers', 'pouch'], gold: 10,
  },
  {
    id: 'sage', name: 'Sage', source: PHB, skillProficiencies: ['arcana', 'history'],
    languageChoices: 2, feature: 'Researcher',
    equipment: ['ink', 'ink-pen', 'small-knife', 'letter', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'sailor', name: 'Sailor', source: PHB, skillProficiencies: ['athletics', 'perception'],
    toolProficiencies: ["Navigator's tools", 'Vehicles (water)'], feature: "Ship's Passage",
    equipment: ['club', 'rope-silk', 'keepsake', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'pirate', name: 'Pirate', source: PHB, skillProficiencies: ['athletics', 'perception'],
    toolProficiencies: ["Navigator's tools", 'Vehicles (water)'], feature: 'Bad Reputation',
    equipment: ['club', 'rope-silk', 'keepsake', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'soldier', name: 'Soldier', source: PHB, skillProficiencies: ['athletics', 'intimidation'],
    toolProficiencies: ['Vehicles (land)'], toolChoices: tools(GAMING_SETS), feature: 'Military Rank',
    equipment: ['insignia', 'trophy', 'gaming-set', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'urchin', name: 'Urchin', source: PHB, skillProficiencies: ['sleightOfHand', 'stealth'],
    toolProficiencies: ['Disguise kit', "Thieves' tools"], feature: 'City Secrets',
    equipment: ['small-knife', 'map', 'keepsake', 'clothes-common', 'pouch'], gold: 10,
  },

  // Sword Coast Adventurer's Guide
  {
    id: 'city-watch', name: 'City Watch', source: SCAG, skillProficiencies: ['athletics', 'insight'],
    languageChoices: 2, feature: "Watcher's Eye", equipment: ['uniform', 'horn', 'manacles', 'pouch'], gold: 10,
  },
  {
    id: 'clan-crafter', name: 'Clan Crafter', source: SCAG, skillProficiencies: ['history', 'insight'],
    toolChoices: tools(ARTISAN_TOOLS), languageChoices: 1, feature: 'Respect of the Stout Folk',
    equipment: ['artisans-tools', 'keepsake', 'clothes-travelers', 'gem', 'pouch'], gold: 5,
  },
  {
    id: 'cloistered-scholar', name: 'Cloistered Scholar', source: SCAG, skillProficiencies: ['history'],
    skillChoices: skills(1, 'arcana', 'nature', 'religion'), languageChoices: 2, feature: 'Library Access',
    equipment: ['robe', 'ink', 'ink-pen', 'parchment', 'book', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'courtier', name: 'Courtier', source: SCAG, skillProficiencies: ['insight', 'persuasion'],
    languageChoices: 2, feature: 'Court Functionary', equipment: ['clothes-fine', 'pouch'], gold: 5,
  },
  {
    id: 'faction-agent', name: 'Faction Agent', source: SCAG, skillProficiencies: ['insight'],
    skillChoices: skills(1, ...MENTAL_SKILLS.filter(s => s !== 'insight')), languageChoices: 2, feature: 'Safe Haven',
    equipment: ['badge', 'book', 'clothes-common', 'pouch'], gold: 15,
  },
  {
    id: 'far-traveler', name: 'Far Traveler', source: SCAG, skillProficiencies: ['insight', 'perception'],
    toolChoices: tools(MUSICAL_INSTRUMENTS, GAMING_SETS), languageChoices: 1, feature: 'All Eyes on You',
    equipment: ['clothes-travelers', 'musical-instrument', 'map', 'jewelry', 'pouch'], gold: 5,
  },
  {
    id: 'inheritor', name: 'Inheritor', source: SCAG, skillProficiencies: ['survival'],
    skillChoices: skills(1, 'arcana', 'history', 'religion'), toolChoices: tools(GAMING_SETS, MUSICAL_INSTRUMENTS),
    languageChoices: 1, feature: 'Inheritance', equipment: ['keepsake', 'clothes-travelers', 'pouch'], gold: 15,
  },
  {
    id: 'knight-of-the-order', name: 'Knight of the Order', source: SCAG, skillProficiencies: ['persuasion'],
    skillChoices: skills(1, 'arcana', 'history', 'nature', 'religion'), toolChoices: tools(GAMING_SETS, MUSICAL_INSTRUMENTS),
    languageChoices: 1, feature: 'Knightly Regard', equipment: ['clothes-travelers', 'signet-ring', 'pouch'], gold: 10,
  },
  {
    id: 'mercenary-veteran', name: 'Mercenary Veteran', source: SCAG, skillProficiencies: ['athletics', 'persuasion'],
    toolProficiencies: ['Vehicles (land)'], toolChoices: tools(GAMING_SETS), feature: 'Mercenary Life',
    equipment: ['uniform', 'insignia', 'gaming-set', 'pouch'], gold: 10,
  },
  {
    id: 'urban-bounty-hunter', name: 'Urban Bounty Hunter', source: SCAG, skillProficiencies: [],
    skillChoices: skills(2, 'deception', 'insight', 'persuasion', 'stealth'),
    toolChoices: { count: 2, from: [...GAMING_SETS, ...MUSICAL_INSTRUMENTS, "Thieves' tools"] }, feature: 'Ear to the Ground',
    equipment: ['clothes-common', 'pouch'], gold: 20,
  },
  {
    id: 'uthgardt-tribe-member', name: 'Uthgardt Tribe Member', source: SCAG, skillProficiencies: ['athletics', 'survival'],
    toolChoices: tools(MUSICAL_INSTRUMENTS, ARTISAN_TOOLS), languageChoices: 1, feature: 'Uthgardt Heritage',
    equipment: ['hunting-trap', 'keepsake', 'clothes-travelers', 'pouch'], gold: 10,
  },
  {
    id: 'waterdhavian-noble', name: 'Waterdhavian Noble', source: SCAG, skillProficiencies: ['history', 'persuasion'],
    toolChoices: tools(GAMING_SETS, MUSICAL_INSTRUMENTS), languageChoices: 1, feature: 'Kept in Style',
    equipment: ['clothes-fine', 'signet-ring', 'pedigree', 'wine-fine', 'pouch'], gold: 20,
  },

  // Gothic horror
  {
    id: 'haunted-one', name: 'Haunted One', source: COS, skillProficiencies: [],
    skillChoices: skills(2, 'arcana', 'investigation', 'religion', 'survival'), languageChoices: 2, feature: 'Heart of Darkness',
    equipment: ['notes', 'keepsake', 'clothes-common'], gold: 0,
  },
  {
    id: 'investigator', name: 'Investigator', source: VRGR, skillProficiencies: [],
    skillChoices: skills(2, 'insight', 'investigation', 'perception'), toolProficiencies: ['Disguise kit', "Thieves' tools"],
    feature: 'Official Inquiry', equipment: ['notes', 'clothes-common', 'pouch'], gold: 10,
  },

  // Adventure books
  {
    id: 'anthropologist', name: 'Anthropologist', source: TOA, skillProficiencies: ['insight', 'religion'],
    languageChoices: 2, feature: 'Adept Linguist', equipment: ['notes', 'keepsake', 'clothes-travelers', 'pouch'], gold: 10,
  },
  {
    id: 'archaeologist', name: 'Archaeologist', source: TOA, skillProficiencies: ['history', 'survival'],
    toolChoices: tools(["Cartographer's tools", "Navigator's tools"]), languageChoices: 1, feature: 'Historical Knowledge',
    equipment: ['scroll-case', 'lantern-hooded', 'shovel', 'trophy', 'clothes-travelers', 'pouch'], gold: 25,
  },
  {
    id: 'faceless', name: 'Faceless', source: BGDIA, skillProficiencies: ['deception', 'intimidation'],
    toolProficiencies: ['Disguise kit'], languageChoices: 1, feature: 'Dual Personalities',
    equipment: ['disguise-kit', 'clothes-costume', 'pouch'], gold: 10,
  },
  {
    id: 'fisher', name: 'Fisher', source: GOS, skillProficiencies: ['history', 'survival'],
    languageChoices: 1, feature: 'Harvest the Water', equipment: ['fishing-tackle', 'keepsake', 'clothes-travelers', 'pouch'], gold: 10,
  },
  {
    id: 'marine', name: 'Marine', source: GOS, skillProficiencies: ['athletics', 'survival'],
    toolProficiencies: ['Vehicles (land)', 'Vehicles (water)'], feature: 'Steady',
    equipment: ['dagger', 'insignia', 'clothes-travelers', 'pouch'], gold: 10,
  },
  {
    id: 'shipwright', name: 'Shipwright', source: GOS, skillProficiencies: ['history', 'perception'],
    toolProficiencies: ["Carpenter's tools", 'Vehicles (water)'], feature: "I'll Patch It!",
    equipment: ['carpenters-tools', 'notes', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'smuggler', name: 'Smuggler', source: GOS, skillProficiencies: ['athletics', 'deception'],
    toolProficiencies: ['Vehicles (water)'], feature: 'Down Low',
    equipment: ['clothes-fine', 'pouch'], gold: 15,
  },
  {
    id: 'celebrity-adventurers-scion', name: "Celebrity Adventurer's Scion", source: AI, skillProficiencies: ['perception', 'performance'],
    toolProficiencies: ['Disguise kit'], toolChoices: tools(MUSICAL_INSTRUMENTS), languageChoices: 1, feature: 'Name Dropping',
    equipment: ['clothes-fine', 'keepsake', 'pouch'], gold: 25,
  },
  {
    id: 'failed-merchant', name: 'Failed Merchant', source: AI, skillProficiencies: ['investigation', 'persuasion'],
    toolChoices: tools(ARTISAN_TOOLS), languageChoices: 1, feature: 'Supply Chain',
    equipment: ['keepsake', 'clothes-fine', 'pouch'], gold: 10,
  },
  {
    id: 'gambler', name: 'Gambler', source: AI, skillProficiencies: ['deception', 'insight'],
    toolChoices: tools(GAMING_SETS), languageChoices: 1, feature: 'Never Tell Me the Odds',
    equipment: ['gaming-set', 'clothes-fine', 'pouch'], gold: 15,
  },
  {
    id: 'plaintiff', name: 'Plaintiff', source: AI, skillProficiencies: ['medicine', 'persuasion'],
    languageChoices: 1, feature: 'Legalese', equipment: ['letter', 'clothes-fine', 'pouch'], gold: 20,
  },
  {
    id: 'rival-intern', name: 'Rival Intern', source: AI, skillProficiencies: ['history', 'investigation'],
    toolChoices: tools(ARTISAN_TOOLS), languageChoices: 1, feature: 'Inside Informant',
    equipment: ['notes', 'clothes-fine', 'pouch'], gold: 10,
  },

  // Campaign settings
  {
    id: 'grinner', name: 'Grinner', source: EGW, skillProficiencies: ['deception', 'performance'],
    toolProficiencies: ['Disguise kit'], toolChoices: tools(MUSICAL_INSTRUMENTS), feature: 'Ballad of the Grinning Fool',
    equipment: ['clothes-fine', 'disguise-kit', 'musical-instrument', 'badge', 'pouch'], gold: 15,
  },
  {
    id: 'volstrucker-agent', name: 'Volstrucker Agent', source: EGW, skillProficiencies: ['deception', 'stealth'],
    toolProficiencies: ["Poisoner's kit"], languageChoices: 1, feature: 'Shadow Network',
    equipment: ['clothes-common', 'poisoners-kit', 'pouch'], gold: 10,
  },
  {
    id: 'house-agent', name: 'House Agent', source: ERLW, skillProficiencies: ['investigation', 'persuasion'],
    toolChoices: { count: 2, from: TOOLS }, feature: 'House Connections',
    equipment: ['clothes-fine', 'signet-ring', 'badge', 'pouch'], gold: 20,
  },
  {
    id: 'athlete', name: 'Athlete', source: MOT, skillProficiencies: ['acrobatics', 'athletics'],
    toolProficiencies: ['Vehicles (land)'], languageChoices: 1, feature: 'Echoes of Victory',
    equipment: ['keepsake', 'trophy', 'clothes-travelers', 'pouch'], gold: 10,
  },
  { id: 'azorius-functionary', name: 'Azorius Functionary', source: GGR, skillProficiencies: ['insight', 'intimidation'], languageChoices: 2, feature: 'Legal Authority', equipment: ['badge', 'scroll-case', 'clothes-fine', 'pouch'], gold: 10 },
  { id: 'boros-legionnaire', name: 'Boros Legionnaire', source: GGR, skillProficiencies: ['athletics', 'intimidation'], toolChoices: tools(GAMING_SETS), languageChoices: 1, feature: 'Legion Station', equipment: ['badge', 'insignia', 'gaming-set', 'clothes-common', 'pouch'], gold: 2 },
  { id: 'dimir-operative', name: 'Dimir Operative', source: GGR, skillProficiencies: ['deception', 'stealth'], toolProficiencies: ['Disguise kit'], languageChoices: 1, feature: 'False Identity', equipment: ['badge', 'disguise-kit', 'clothes-common', 'pouch'], gold: 10 },
  { id: 'golgari-agent', name: 'Golgari Agent', source: GGR, skillProficiencies: ['nature', 'survival'], toolProficiencies: ["Poisoner's kit"], languageChoices: 1, feature: 'Undercity Paths', equipment: ['badge', 'poisoners-kit', 'clothes-common', 'pouch'], gold: 10 },
  { id: 'gruul-anarch', name: 'Gruul Anarch', source: GGR, skillProficiencies: ['animalHandling', 'athletics'], toolProficiencies: ['Herbalism kit'], languageChoices: 1, feature: 'Rubblebelt Refuge', equipment: ['badge', 'hunting-trap', 'herbalism-kit', 'clothes-travelers', 'pouch'], gold: 10 },
  { id: 'izzet-engineer', name: 'Izzet Engineer', source: GGR, skillProficiencies: ['arcana', 'investigation'], toolChoices: tools(ARTISAN_TOOLS), languageChoices: 1, feature: 'Urban Infrastructure', equipment: ['badge', 'artisans-tools', 'clothes-common', 'pouch'], gold: 5 },
  { id: 'orzhov-representative', name: 'Orzhov Representative', source: GGR, skillProficiencies: ['intimidation', 'religion'], languageChoices: 2, feature: 'Leverage', equipment: ['badge', 'clothes-fine', 'pouch'], gold: 10 },
  { id: 'rakdos-cultist', name: 'Rakdos Cultist', source: GGR, skillProficiencies: ['acrobatics', 'performance'], toolChoices: tools(MUSICAL_INSTRUMENTS), languageChoices: 1, feature: 'Fearsome Reputation', equipment: ['badge', 'musical-instrument', 'clothes-costume', 'pouch'], gold: 10 },
  { id: 'selesnya-initiate', name: 'Selesnya Initiate', source: GGR, skillProficiencies: ['nature', 'persuasion'], toolChoices: tools(ARTISAN_TOOLS, MUSICAL_INSTRUMENTS), languageChoices: 1, feature: "Conclave's Shelter", equipment: ['badge', 'robe', 'pouch'], gold: 5 },
  { id: 'simic-scientist', name: 'Simic Scientist', source: GGR, skillProficiencies: ['arcana', 'medicine'], languageChoices: 2, feature: 'Researcher', equipment: ['badge', 'notes', 'ink', 'ink-pen', 'clothes-common', 'pouch'], gold: 10 },
  { id: 'lorehold-student', name: 'Lorehold Student', source: SCC, skillProficiencies: ['history', 'religion'], languageChoices: 2, ...STUDENT, equipment: ['ink', 'ink-pen', 'book', 'clothes-common', 'pouch'], gold: 15 },
  { id: 'prismari-student', name: 'Prismari Student', source: SCC, skillProficiencies: ['acrobatics', 'performance'], toolChoices: tools(ARTISAN_TOOLS, MUSICAL_INSTRUMENTS), languageChoices: 1, ...STUDENT, equipment: ['ink', 'ink-pen', 'book', 'clothes-common', 'pouch'], gold: 10 },
  { id: 'quandrix-student', name: 'Quandrix Student', source: SCC, skillProficiencies: ['arcana', 'nature'], toolChoices: tools(ARTISAN_TOOLS), languageChoices: 1, ...STUDENT, equipment: ['ink', 'ink-pen', 'book', 'clothes-common', 'pouch'], gold: 15 },
  { id: 'silverquill-student', name: 'Silverquill Student', source: SCC, skillProficiencies: ['intimidation', 'persuasion'], languageChoices: 2, ...STUDENT, equipment: ['ink', 'ink-pen', 'book', 'clothes-common', 'pouch'], gold: 15 },
  { id: 'witherbloom-student', name: 'Witherbloom Student', source: SCC, skillProficiencies: ['nature', 'survival'], toolProficiencies: ['Herbalism kit'], languageChoices: 1, ...STUDENT, equipment: ['ink', 'ink-pen', 'book', 'herbalism-kit', 'clothes-common', 'pouch'], gold: 15 },
  {
    id: 'feylost', name: 'Feylost', source: WBW, skillProficiencies: ['deception', 'survival'],
    toolChoices: tools(MUSICAL_INSTRUMENTS), languageChoices: 1, feature: 'Feywild Connection',
    equipment: ['musical-instrument', 'keepsake', 'clothes-travelers', 'pouch'], gold: 8,
  },
  {
    id: 'witchlight-hand', name: 'Witchlight Hand', source: WBW, skillProficiencies: ['performance', 'sleightOfHand'],
    toolChoices: tools(['Disguise kit'], MUSICAL_INSTRUMENTS), languageChoices: 1, feature: 'Carnival Companion',
    equipment: ['disguise-kit', 'clothes-costume', 'keepsake', 'pouch'], gold: 8,
  },
  {
    id: 'astral-drifter', name: 'Astral Drifter', source: SJ, skillProficiencies: ['insight', 'religion'],
    languageChoices: 2, feat: { id: 'magic-initiate', note: 'Cleric' }, feature: 'Divine Contact',
    equipment: ['clothes-travelers', 'notes', 'pouch'], gold: 10,
  },
  {
    id: 'wildspacer', name: 'Wildspacer', source: SJ, skillProficiencies: ['athletics', 'survival'],
    toolProficiencies: ["Navigator's tools", 'Vehicles (space)'], feat: { id: 'tough' }, feature: 'Wildspace Adaptation',
    equipment: ['club', 'grappling-hook', 'clothes-travelers', 'pouch'], gold: 10,
  },
  {
    id: 'knight-of-solamnia', name: 'Knight of Solamnia', source: DSDQ, skillProficiencies: ['athletics', 'survival'],
    toolChoices: tools(GAMING_SETS), languageChoices: 1, feat: { id: 'squire-of-solamnia' }, feature: 'Squire of Solamnia',
    equipment: ['insignia', 'gaming-set', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'mage-of-high-sorcery', name: 'Mage of High Sorcery', source: DSDQ, skillProficiencies: ['arcana', 'history'],
    languageChoices: 2, feat: { id: 'initiate-of-high-sorcery' }, feature: 'Initiate of High Sorcery',
    equipment: ['badge', 'robe', 'ink', 'ink-pen', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'gate-warden', name: 'Gate Warden', source: PAITM, skillProficiencies: ['persuasion', 'survival'],
    languageChoices: 2, feat: { id: 'scion-of-the-outer-planes' }, feature: 'Scion of the Outer Planes',
    equipment: ['keepsake', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'planar-philosopher', name: 'Planar Philosopher', source: PAITM, skillProficiencies: ['arcana'],
    skillChoices: skills(1, ...ANY_SKILL.filter(s => s !== 'arcana')), languageChoices: 2,
    feat: { id: 'scion-of-the-outer-planes' }, feature: 'Scion of the Outer Planes',
    equipment: ['badge', 'notes', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'giant-foundling', name: 'Giant Foundling', source: BGG, skillProficiencies: ['intimidation', 'survival'],
    languages: ['Giant'], languageChoices: 1, feat: { id: 'strike-of-the-giants' }, feature: 'Strike of the Giants',
    equipment: ['keepsake', 'clothes-travelers', 'pouch'], gold: 10,
  },
  {
    id: 'rune-carver', name: 'Rune Carver', source: BGG, skillProficiencies: ['history', 'perception'],
    toolChoices: tools(ARTISAN_TOOLS), languages: ['Giant'], feat: { id: 'rune-shaper' }, feature: 'Rune Shaper',
    equipment: ['artisans-tools', 'small-knife', 'keepsake', 'clothes-common', 'pouch'], gold: 10,
  },
  {
    id: 'rewarded', name: 'Rewarded', source: BMT, skillProficiencies: ['insight', 'persuasion'],
    toolChoices: tools(GAMING_SETS), languageChoices: 1, feat: { id: 'lucky' }, feature: 'Fortune\'s Favor',
    equipment: ['ink', 'ink-pen', 'letter', 'clothes-fine', 'pouch'], gold: 18,
  },
  {
    id: 'ruined', name: 'Ruined', source: BMT, skillProficiencies: ['stealth', 'survival'],
    toolChoices: tools(GAMING_SETS), languageChoices: 1, feat: { id: 'alert' }, feature: 'Still Standing',
    equipment: ['keepsake', 'gaming-set', 'clothes-travelers', 'pouch'], gold: 13,
  },
]

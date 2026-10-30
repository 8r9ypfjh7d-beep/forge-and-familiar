// 2014 races from setting books and one-off releases: Eberron (with dragonmarks), Ravnica, Theros, Spelljammer,
// Van Richten's lineages, Verdan, Locathah, Grung and Kender. Names and mechanics only: what each trait does
// is our own summary in i18n/locales/explain.settings.*.ts (why.trait.<name>).
import type { AdvantageOn, ItemEffect, Race, RaceEffect, SkillId, Subrace, TraitChoice } from '../../types'
import { TOOLS, ARTISAN_TOOLS, MUSICAL_INSTRUMENTS } from '../proficiencies'
import { dark, move, resist, skillProf } from './helpers'

const ERLW = 'Eberron: Rising from the Last War'
const GGR = "Guildmasters' Guide to Ravnica"
const MOT = 'Mythic Odysseys of Theros'
const AAG = "Spelljammer: Astral Adventurer's Guide"
const VRGR = "Van Richten's Guide to Ravenloft"
const AI = 'Acquisitions Incorporated'
const LR = 'Locathah Rising'
const OGA = 'One Grung Above'
const DSDQ = 'Dragonlance: Shadow of the Dragon Queen'

const adv = (on: AdvantageOn, when?: string): ItemEffect => ({ kind: 'advantage', on, ...(when ? { when } : {}) })
/** An innate spell, from character level `level` (default 1). */
const spell = (name: string, note: string, level?: number): RaceEffect => ({ kind: 'spell', spell: name, note, ...(level ? { level } : {}) })
const once = 'once per long rest'
const cantrip = 'cantrip, at will'
/** "Pick N of these skills" as a trait choice. */
const skillPick = (id: string, name: string, skills: SkillId[], count = 1): TraitChoice => ({
  id, name, ...(count > 1 ? { count } : {}),
  options: skills.map(s => ({ id: s, name: s, effects: [skillProf(s)] })),
})
const anyTool = { count: 1, from: TOOLS }

// ---------- Eberron ----------

const EBERRON: Race[] = [
  {
    id: 'changeling-erlw', name: 'Changeling (Eberron)', source: ERLW, size: 'Medium', speed: 30,
    abilityBonuses: { cha: 2 }, freeAbilityBonuses: { count: 1, exclude: ['cha'] },
    languages: ['Common'], languageChoices: 2,
    traits: ['Shapechanger', 'Changeling Instincts'],
    choices: [skillPick('changelingInstincts', 'Changeling Instincts', ['deception', 'insight', 'intimidation', 'persuasion'], 2)],
  },
  {
    id: 'kalashtar', name: 'Kalashtar', source: ERLW, size: 'Medium', speed: 30,
    abilityBonuses: { wis: 2, cha: 1 },
    languages: ['Common', 'Quori'], languageChoices: 1,
    traits: ['Dual Mind', 'Mental Discipline', 'Mind Link', 'Severed from Dreams'],
    effects: [adv('save:wis'), resist('psychic')],
  },
  {
    id: 'shifter', name: 'Shifter', source: ERLW, size: 'Medium', speed: 30,
    abilityBonuses: {},
    languages: ['Common'],
    traits: ['Darkvision', 'Shifting'],
    effects: [dark(60)],
    uses: [{ trait: 'Shifting', count: 1, recharge: 'short' }],
    subraces: [
      { id: 'beasthide', name: 'Beasthide', abilityBonuses: { con: 2, str: 1 }, traits: ['Natural Athlete', 'Shifting Feature (Beasthide)'], skillProficiencies: ['athletics'] },
      { id: 'longtooth', name: 'Longtooth', abilityBonuses: { str: 2, dex: 1 }, traits: ['Fierce', 'Shifting Feature (Longtooth)'], skillProficiencies: ['intimidation'] },
      { id: 'swiftstride', name: 'Swiftstride', abilityBonuses: { dex: 2, cha: 1 }, traits: ['Graceful', 'Shifting Feature (Swiftstride)'], skillProficiencies: ['acrobatics'] },
      { id: 'wildhunt', name: 'Wildhunt', abilityBonuses: { wis: 2, dex: 1 }, traits: ['Natural Tracker', 'Shifting Feature (Wildhunt)'], skillProficiencies: ['survival'] },
    ],
  },
  {
    id: 'warforged', name: 'Warforged', source: ERLW, size: 'Medium', speed: 30,
    abilityBonuses: { con: 2 }, freeAbilityBonuses: { count: 1, exclude: ['con'] },
    languages: ['Common'], languageChoices: 1,
    freeSkillChoices: 1, toolChoices: anyTool,
    traits: ['Constructed Resilience', "Sentry's Rest", 'Integrated Protection', 'Specialized Design'],
    effects: [{ kind: 'ac', value: 1 }, resist('poison'), adv('saves', 'against being poisoned')],
  },
]

// Dragonmarks: ERLW's variant subraces. On a race with no subraces (Human) they are optional.
const mark = (id: string, parentRaceId: string, rest: Omit<Subrace, 'id' | 'parentRaceId'>): Subrace => ({ id, parentRaceId, source: ERLW, ...rest })
const DRAGONMARKS: Subrace[] = [
  mark('mark-of-detection', 'half-elf', {
    name: 'Mark of Detection', abilityBonuses: { wis: 2 }, replacesBonuses: true, freeAbilityBonuses: { count: 1, exclude: ['wis'] },
    removesTraits: ['Skill Versatility'], freeSkillChoices: 0,
    traits: ['Deductive Intuition', 'Magical Detection', 'Spells of the Mark'],
    effects: [spell('Detect Magic', once), spell('Detect Poison and Disease', once), spell('See Invisibility', once, 3)],
  }),
  mark('mark-of-finding', 'half-orc', {
    name: 'Mark of Finding', abilityBonuses: { wis: 2, con: 1 }, replacesBonuses: true,
    removesTraits: ['Menacing'], replacesSkills: true,
    traits: ["Hunter's Intuition", "Finder's Magic", 'Spells of the Mark'],
    effects: [spell("Hunter's Mark", once), spell('Locate Object', once, 3)],
  }),
  mark('mark-of-finding-human', 'human', {
    name: 'Mark of Finding', abilityBonuses: { wis: 2, con: 1 }, replacesBonuses: true,
    traits: ['Darkvision', "Hunter's Intuition", "Finder's Magic", 'Spells of the Mark'],
    effects: [dark(60), spell("Hunter's Mark", once), spell('Locate Object', once, 3)],
  }),
  mark('mark-of-handling', 'human', {
    name: 'Mark of Handling', abilityBonuses: { wis: 2 }, replacesBonuses: true, freeAbilityBonuses: { count: 1, exclude: ['wis'] },
    traits: ['Wild Intuition', 'Primal Connection', 'The Bigger They Are', 'Spells of the Mark'],
    effects: [spell('Animal Friendship', once), spell('Speak with Animals', once)],
  }),
  mark('mark-of-making', 'human', {
    name: 'Mark of Making', abilityBonuses: { int: 2 }, replacesBonuses: true, freeAbilityBonuses: { count: 1, exclude: ['int'] },
    toolChoices: { count: 1, from: ARTISAN_TOOLS },
    traits: ["Artisan's Intuition", "Maker's Gift", 'Spellsmith', 'Spells of the Mark'],
    effects: [spell('Mending', cantrip), spell('Magic Weapon', once)],
  }),
  mark('mark-of-passage', 'human', {
    name: 'Mark of Passage', abilityBonuses: { dex: 2 }, replacesBonuses: true, freeAbilityBonuses: { count: 1, exclude: ['dex'] }, speed: 35,
    traits: ['Courier\'s Speed', 'Intuitive Motion', 'Magical Passage', 'Spells of the Mark'],
    effects: [spell('Misty Step', once)],
  }),
  mark('mark-of-sentinel', 'human', {
    name: 'Mark of Sentinel', abilityBonuses: { con: 2, wis: 1 }, replacesBonuses: true,
    traits: ["Sentinel's Intuition", "Guardian's Shield", 'Vigilant Guardian', 'Spells of the Mark'],
    effects: [spell('Shield', once)],
  }),
  mark('mark-of-healing', 'halfling', {
    name: 'Mark of Healing', abilityBonuses: { wis: 1 },
    traits: ['Medical Intuition', 'Healing Touch', 'Spells of the Mark'],
    effects: [spell('Cure Wounds', once), spell('Lesser Restoration', once, 3)],
  }),
  mark('mark-of-hospitality', 'halfling', {
    name: 'Mark of Hospitality', abilityBonuses: { cha: 1 },
    traits: ['Ever Hospitable', "Innkeeper's Magic", 'Spells of the Mark'],
    effects: [spell('Prestidigitation', cantrip), spell('Purify Food and Drink', once), spell('Unseen Servant', once)],
  }),
  mark('mark-of-scribing', 'gnome', {
    name: 'Mark of Scribing', abilityBonuses: { cha: 1 },
    traits: ['Gifted Scribe', "Scribe's Insight", 'Spells of the Mark'],
    effects: [spell('Message', cantrip), spell('Comprehend Languages', once), spell('Magic Mouth', once, 3)],
  }),
  mark('mark-of-shadow', 'elf', {
    name: 'Mark of Shadow', abilityBonuses: { cha: 1 },
    traits: ['Cunning Intuition', 'Shape Shadows', 'Spells of the Mark'],
    effects: [spell('Minor Illusion', cantrip), spell('Invisibility', once, 3)],
  }),
  mark('mark-of-storm', 'half-elf', {
    name: 'Mark of Storm', abilityBonuses: { cha: 2, dex: 1 }, replacesBonuses: true,
    removesTraits: ['Skill Versatility'], freeSkillChoices: 0,
    traits: ["Windwright's Intuition", "Storm's Boon", 'Headwinds', 'Spells of the Mark'],
    effects: [resist('lightning'), spell('Gust', cantrip), spell('Gust of Wind', once, 3)],
  }),
  mark('mark-of-warding', 'dwarf', {
    name: 'Mark of Warding', abilityBonuses: { int: 1 },
    traits: ["Warder's Intuition", 'Wards and Seals', 'Spells of the Mark'],
    effects: [spell('Alarm', once), spell('Mage Armor', once), spell('Arcane Lock', once, 3)],
  }),
]

// ---------- Ravnica and Theros ----------

const RAVNICA_THEROS: Race[] = [
  {
    id: 'centaur-ggr', name: 'Centaur (Ravnica)', source: GGR, size: 'Medium', speed: 40,
    abilityBonuses: { str: 2, wis: 1 },
    languages: ['Common', 'Sylvan'],
    traits: ['Fey', 'Charge', 'Hooves', 'Equine Build', 'Survivor'],
    naturalWeapons: [{ name: 'Hooves', damage: '1d4', type: 'bludgeoning' }],
    choices: [skillPick('centaurSurvivor', 'Survivor', ['animalHandling', 'medicine', 'nature', 'survival'])],
  },
  {
    id: 'loxodon', name: 'Loxodon', source: GGR, size: 'Medium', speed: 30,
    abilityBonuses: { con: 2, wis: 1 },
    languages: ['Common', 'Loxodon'],
    traits: ['Powerful Build', 'Loxodon Serenity', 'Natural Armor', 'Trunk', 'Keen Smell'],
    naturalArmor: { base: 12, dex: false, ability: 'con' },
    effects: [adv('saves', 'against being charmed or frightened'), adv('checks', 'Perception, Survival and Investigation checks that use smell')],
  },
  {
    id: 'minotaur-ggr', name: 'Minotaur (Ravnica)', source: GGR, size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, con: 1 },
    languages: ['Common', 'Minotaur'],
    traits: ['Horns', 'Goring Rush', 'Hammering Horns', 'Imposing Presence'],
    naturalWeapons: [{ name: 'Horns', damage: '1d6', type: 'piercing' }],
    choices: [skillPick('imposingPresence', 'Imposing Presence', ['intimidation', 'persuasion'])],
  },
  {
    id: 'simic-hybrid', name: 'Simic Hybrid', source: GGR, size: 'Medium', speed: 30,
    abilityBonuses: { con: 2 }, freeAbilityBonuses: { count: 1, exclude: ['con'] },
    languages: ['Common'], languageChoices: 1,
    traits: ['Darkvision', 'Animal Enhancement'],
    effects: [dark(60)],
    choices: [
      {
        id: 'enhancement1', name: 'Animal Enhancement',
        options: [
          { id: 'manta-glide', name: 'Manta Glide' },
          { id: 'nimble-climber', name: 'Nimble Climber', effects: [move('climb')] },
          { id: 'underwater-adaptation', name: 'Underwater Adaptation', effects: [move('swim')] },
        ],
      },
      {
        id: 'enhancement5', name: 'Animal Enhancement (5th level)', level: 5,
        options: [
          { id: 'manta-glide', name: 'Manta Glide' },
          { id: 'nimble-climber', name: 'Nimble Climber', effects: [move('climb')] },
          { id: 'underwater-adaptation', name: 'Underwater Adaptation', effects: [move('swim')] },
          { id: 'grappling-appendages', name: 'Grappling Appendages' },
          { id: 'carapace', name: 'Carapace', effects: [{ kind: 'ac', value: 1 }] },
          { id: 'acid-spit', name: 'Acid Spit' },
        ],
      },
    ],
  },
  {
    id: 'vedalken', name: 'Vedalken', source: GGR, size: 'Medium', speed: 30,
    abilityBonuses: { int: 2, wis: 1 },
    languages: ['Common', 'Vedalken'], languageChoices: 1,
    toolChoices: anyTool,
    traits: ['Vedalken Dispassion', 'Tireless Precision', 'Partially Amphibious'],
    effects: [adv('save:int'), adv('save:wis'), adv('save:cha')],
    choices: [skillPick('tirelessPrecision', 'Tireless Precision', ['arcana', 'history', 'investigation', 'medicine', 'performance', 'sleightOfHand'])],
  },
  {
    id: 'leonin', name: 'Leonin', source: MOT, size: 'Medium', speed: 35,
    abilityBonuses: { con: 2, str: 1 },
    languages: ['Common', 'Leonin'],
    traits: ['Darkvision', 'Claws', "Hunter's Instincts", 'Daunting Roar'],
    naturalWeapons: [{ name: 'Claws', damage: '1d4', type: 'slashing' }],
    effects: [dark(60)],
    uses: [{ trait: 'Daunting Roar', count: 1, recharge: 'short' }],
    choices: [skillPick('huntersInstincts', "Hunter's Instincts", ['athletics', 'intimidation', 'perception', 'survival'])],
  },
  {
    id: 'satyr-mot', name: 'Satyr (Theros)', source: MOT, size: 'Medium', speed: 35,
    abilityBonuses: { cha: 2, dex: 1 },
    languages: ['Common', 'Sylvan'],
    skillProficiencies: ['performance', 'persuasion'],
    toolChoices: { count: 1, from: MUSICAL_INSTRUMENTS },
    traits: ['Fey', 'Ram', 'Magic Resistance', 'Mirthful Leaps', 'Reveler'],
    naturalWeapons: [{ name: 'Ram', damage: '1d4', type: 'bludgeoning' }],
    effects: [adv('saves', 'against spells and other magical effects')],
  },
]

// ---------- Spelljammer and Van Richten's (+2/+1 or +1/+1/+1 anywhere, Common + one language) ----------

const flexible = { abilityBonuses: {}, flexibleAbilityBonuses: true as const, languageChoices: 1 }
const SPELLJAMMER_RAVENLOFT: Race[] = [
  {
    id: 'autognome', name: 'Autognome', source: AAG, size: 'Small', speed: 30, ...flexible, languages: ['Common'],
    toolChoices: { count: 2, from: TOOLS },
    traits: ['Armored Casing', 'Built for Success', 'Healing Machine', 'Mechanical Nature', "Sentry's Rest", 'Specialized Design'],
    naturalArmor: { base: 13, dex: true },
    effects: [resist('poison'), adv('saves', 'against being paralyzed or poisoned')],
    uses: [{ trait: 'Built for Success', count: 'pb', recharge: 'long' }],
  },
  {
    id: 'giff', name: 'Giff', source: AAG, size: 'Medium', speed: 30, ...flexible, languages: ['Common'],
    traits: ['Astral Spark', 'Firearms Mastery', 'Hippo Build'],
    effects: [move('swim'), adv('save:str'), adv('checks', 'Strength checks')],
  },
  {
    id: 'hadozee', name: 'Hadozee', source: AAG, size: 'Medium', sizeOptions: ['Medium', 'Small'], speed: 30, ...flexible, languages: ['Common'],
    traits: ['Dexterous Feet', 'Glide', 'Hadozee Dodge'],
    effects: [move('climb')],
    uses: [{ trait: 'Hadozee Dodge', count: 'pb', recharge: 'long' }],
  },
  {
    id: 'plasmoid', name: 'Plasmoid', source: AAG, size: 'Medium', sizeOptions: ['Medium', 'Small'], speed: 30, ...flexible, languages: ['Common'],
    traits: ['Amorphous', 'Darkvision', 'Hold Breath', 'Natural Resilience', 'Shape Self'],
    effects: [dark(60), resist('acid'), resist('poison'), adv('saves', 'against being poisoned')],
  },
  {
    id: 'thri-kreen', name: 'Thri-kreen', source: AAG, size: 'Medium', sizeOptions: ['Medium', 'Small'], speed: 30, ...flexible, languages: ['Common'],
    traits: ['Chameleon Carapace', 'Darkvision', 'Secondary Arms', 'Sleepless', 'Thri-kreen Telepathy'],
    naturalArmor: { base: 13, dex: true },
    effects: [dark(60)],
  },
  {
    id: 'dhampir', name: 'Dhampir', source: VRGR, size: 'Medium', sizeOptions: ['Medium', 'Small'], speed: 35, ...flexible, languages: ['Common'],
    traits: ['Darkvision', 'Deathless Nature', 'Spider Climb', 'Vampiric Bite'],
    effects: [dark(60), move('climb')],
    uses: [{ trait: 'Vampiric Bite', count: 'pb', recharge: 'long' }],
  },
  {
    id: 'hexblood', name: 'Hexblood', source: VRGR, size: 'Medium', sizeOptions: ['Medium', 'Small'], speed: 30, ...flexible, languages: ['Common'],
    traits: ['Darkvision', 'Eerie Token', 'Hex Magic'],
    effects: [dark(60), spell('Disguise Self', once), spell('Hex', once)],
    uses: [{ trait: 'Eerie Token', count: 1, recharge: 'long' }],
  },
  {
    id: 'reborn', name: 'Reborn', source: VRGR, size: 'Medium', sizeOptions: ['Medium', 'Small'], speed: 30, ...flexible, languages: ['Common'],
    traits: ['Deathless Nature', 'Knowledge from a Past Life'],
    effects: [resist('poison'), adv('saves', 'against disease and being poisoned, and on death saving throws')],
    uses: [{ trait: 'Knowledge from a Past Life', count: 'pb', recharge: 'long' }],
  },
]

// ---------- One-offs ----------

const ONE_OFFS: Race[] = [
  {
    id: 'verdan', name: 'Verdan', source: AI, size: 'Small', speed: 30,
    abilityBonuses: { cha: 2, con: 1 },
    languages: ['Common', 'Goblin'], languageChoices: 1,
    skillProficiencies: ['persuasion'],
    traits: ['Black Blood Healing', 'Limited Telepathy', 'Persuasive', 'Telepathic Insight'],
    effects: [adv('save:wis'), adv('save:cha')],
  },
  {
    id: 'locathah', name: 'Locathah', source: LR, size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, dex: 1 },
    languages: ['Aquan', 'Common'],
    skillProficiencies: ['athletics', 'perception'],
    traits: ['Natural Armor', 'Observant & Athletic', 'Leviathan Will', 'Limited Amphibiousness'],
    naturalArmor: { base: 12, dex: true },
    effects: [move('swim', 30), adv('saves', 'against being charmed, frightened, paralyzed, poisoned, stunned or put to sleep')],
  },
  {
    id: 'grung', name: 'Grung', source: OGA, size: 'Small', speed: 25,
    abilityBonuses: { dex: 2, con: 1 },
    languages: ['Grung'],
    skillProficiencies: ['perception'],
    traits: ['Arboreal Alertness', 'Amphibious', 'Poison Immunity', 'Poisonous Skin', 'Standing Leap', 'Water Dependency'],
    effects: [move('climb', 25), { kind: 'immunity', damage: 'poison' }, { kind: 'conditionImmunity', condition: 'poisoned' }],
  },
  {
    id: 'kender', name: 'Kender', source: DSDQ, size: 'Small', speed: 30, ...flexible, languages: ['Common'],
    traits: ['Fearless', 'Kender Aptitude', 'Taunt'],
    effects: [adv('saves', 'against being frightened')],
    uses: [{ trait: 'Taunt', count: 'pb', recharge: 'long' }],
    choices: [skillPick('kenderAptitude', 'Kender Aptitude', ['insight', 'investigation', 'sleightOfHand', 'stealth', 'survival'])],
  },
]

export const SETTING_RACES: Race[] = [...EBERRON, ...RAVNICA_THEROS, ...SPELLJAMMER_RAVENLOFT, ...ONE_OFFS]
export const SETTING_SUBRACES: Subrace[] = DRAGONMARKS

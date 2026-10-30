// Pre-made level 1 heroes for new players. Pure data: every hero is a finished CharacterDraft
// (standard array, a fitting PHB background, valid skill picks) plus beginner-friendly flavour and tips.
import type { Character } from '../model/character'
import { createCharacter, type CharacterDraft } from '../rules'

export type StarterRole = 'Defender' | 'Striker' | 'Healer' | 'Spellcaster' | 'Support' | 'Skirmisher'

export interface StarterHero {
  id: string
  role: StarterRole
  difficulty: 'Easy' | 'Medium'
  /** One line shown on the picker card. */
  pitch: string
  backstory: string
  /** Short "how to play" tips, saved into the character's notes. */
  tips: string[]
  /** SRD spells worth picking first; the app has no spell list yet, so these go into notes. */
  spells?: string[]
  draft: Omit<CharacterDraft, 'ownerId' | 'playerName'>
}

const BASE = { abilityMethod: 'standard' as const, freeAbilityBonuses: [] }

export const STARTER_HEROES: StarterHero[] = [
  {
    id: 'brannoc',
    role: 'Defender',
    difficulty: 'Easy',
    pitch: 'Heavy armor, a big shield and a sword. Stand in front and hit hard.',
    backstory: 'A border soldier who left the army to see what the walls were protecting the world from.',
    tips: [
      'Your AC is the highest in the party: step between enemies and your friends.',
      'Second Wind heals you once per short rest as a bonus action.',
      'No good target in reach? Use your light crossbow.',
    ],
    draft: {
      ...BASE, name: 'Brannoc Steelheart', alignment: 'Lawful Good', backgroundId: 'soldier',
      raceId: 'human', classes: [{ classId: 'fighter', level: 1 }],
      featureChoices: { 'fighter.fightingStyle': 'defense' },
      chosenLanguages: ['Dwarvish'], chosenTools: ['Dice set'],
      baseAbilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
      chosenSkills: ['perception', 'survival'],
    },
  },
  {
    id: 'pip',
    role: 'Skirmisher',
    difficulty: 'Easy',
    pitch: 'Small, quick and lucky. Strike from the shadows, then slip away.',
    backstory: 'A street orphan who learned that locked doors are only suggestions.',
    tips: [
      'Sneak Attack adds 1d6 damage once per turn when you have advantage or an ally is next to your target.',
      'Use your shortbow from cover; you can hide behind larger allies.',
      'Halfling Luck lets you reroll a natural 1 on attacks, checks and saves.',
    ],
    draft: {
      ...BASE, name: 'Pip Tealeaf', alignment: 'Chaotic Good', backgroundId: 'urchin',
      raceId: 'halfling', subraceId: 'lightfoot', classes: [{ classId: 'rogue', level: 1 }],
      baseAbilities: { str: 8, dex: 15, con: 14, int: 12, wis: 13, cha: 10 },
      chosenSkills: ['acrobatics', 'perception', 'investigation', 'deception'],
      classPicks: { 'rogue.expertise': ['stealth', 'sleightOfHand'] },
    },
  },
  {
    id: 'thora',
    role: 'Healer',
    difficulty: 'Easy',
    pitch: 'A tough dwarf priest in scale mail. Keeps everyone standing.',
    backstory: 'Keeper of a mountain shrine, sent out to tend to travellers her god has taken an interest in.',
    tips: [
      'You wear armor and carry a shield, so you can fight in the front line too.',
      'Save spell slots for healing when someone drops to 0 HP.',
      'Spare the Dying stabilises a fallen ally without using a slot.',
    ],
    spells: ['Cantrips: Sacred Flame, Guidance, Spare the Dying', '1st level: Cure Wounds, Healing Word, Bless'],
    draft: {
      ...BASE, name: 'Thora Ironhearth', alignment: 'Neutral Good', backgroundId: 'acolyte',
      raceId: 'dwarf', subraceId: 'hill-dwarf', classes: [{ classId: 'cleric', level: 1, subclassId: 'life' }],
      chosenLanguages: ['Celestial', 'Giant'], chosenTools: ["Smith's tools"],
      baseAbilities: { str: 13, dex: 10, con: 14, int: 8, wis: 15, cha: 12 },
      chosenSkills: ['medicine', 'persuasion'],
    },
  },
  {
    id: 'elara',
    role: 'Spellcaster',
    difficulty: 'Medium',
    pitch: 'A scholar with a spellbook full of magic. Fragile, but powerful.',
    backstory: 'A library archivist who read one forbidden book too many and went looking for the rest.',
    tips: [
      'You have few hit points: stay behind the front line.',
      'Fire Bolt costs nothing, so use it every turn you have nothing better.',
      'Arcane Recovery gets back some spell slots on a short rest once per day.',
    ],
    spells: ['Cantrips: Fire Bolt, Mage Hand, Light', '1st level: Magic Missile, Shield, Sleep, Mage Armor, Detect Magic, Burning Hands'],
    draft: {
      ...BASE, name: 'Elara Moonwhisper', alignment: 'Neutral Good', backgroundId: 'sage',
      raceId: 'elf', subraceId: 'high-elf', classes: [{ classId: 'wizard', level: 1 }],
      chosenLanguages: ['Draconic', 'Celestial', 'Sylvan'],
      baseAbilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
      chosenSkills: ['investigation', 'insight'],
    },
  },
  {
    id: 'grukk',
    role: 'Striker',
    difficulty: 'Easy',
    pitch: 'Huge hit points, a greataxe and a terrible temper.',
    backstory: 'Grew up wild in the northern hills. Town walls still make him itchy.',
    tips: [
      'Rage as a bonus action: extra damage and half damage from weapons.',
      'With no armor your AC is 10 + DEX + CON, so you never need to buy any.',
      'Relentless Endurance drops you to 1 HP instead of 0 once per long rest.',
    ],
    draft: {
      ...BASE, name: 'Grukk Stonefist', alignment: 'Chaotic Neutral', backgroundId: 'outlander',
      raceId: 'half-orc', classes: [{ classId: 'barbarian', level: 1 }],
      chosenLanguages: ['Giant'], chosenTools: ['Drum'],
      baseAbilities: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
      chosenSkills: ['perception', 'nature'],
    },
  },
  {
    id: 'kethra',
    role: 'Defender',
    difficulty: 'Medium',
    pitch: 'A dragonborn knight of faith with a breath weapon and healing hands.',
    backstory: 'Heir to a proud clan, she swore an oath to put the family name to better use.',
    tips: [
      'Lay on Hands is a pool of healing: spend as many points as you need.',
      'Your breath weapon hits everything in an area; save it for groups.',
      'Divine Sense reveals hidden undead and fiends nearby.',
    ],
    draft: {
      ...BASE, name: 'Kethra Flamecrest', alignment: 'Lawful Good', backgroundId: 'noble',
      raceId: 'dragonborn', classes: [{ classId: 'paladin', level: 1 }],
      chosenLanguages: ['Dwarvish'], chosenTools: ['Dragonchess set'], traitChoices: { draconicAncestry: 'gold' },
      baseAbilities: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 },
      chosenSkills: ['athletics', 'religion'],
    },
  },
  {
    id: 'vex',
    role: 'Striker',
    difficulty: 'Medium',
    pitch: 'A tiefling who made a deal with a fiend. Blasts enemies from afar.',
    backstory: 'She talked her way through every town that feared her horns, until she met a patron who talked back.',
    tips: [
      'Eldritch Blast is your main attack and costs nothing.',
      'Pact slots come back on a short rest, so ask the party for one when you run out.',
      'You know Thaumaturgy for free: great for spooky intimidation.',
    ],
    spells: ['Cantrips: Eldritch Blast, Minor Illusion', '1st level: Charm Person, Protection from Evil and Good'],
    draft: {
      ...BASE, name: 'Vex Emberlyn', alignment: 'Chaotic Neutral', backgroundId: 'charlatan',
      raceId: 'tiefling', classes: [{ classId: 'warlock', level: 1, subclassId: 'fiend' }],
      baseAbilities: { str: 8, dex: 13, con: 14, int: 12, wis: 10, cha: 15 },
      chosenSkills: ['arcana', 'intimidation'],
    },
  },
  {
    id: 'lyric',
    role: 'Support',
    difficulty: 'Medium',
    pitch: 'A charming half-elf musician. Good at talking, helping and a bit of everything.',
    backstory: 'A tavern singer who wanted to sing about adventures, not just hear about them.',
    tips: [
      'Bardic Inspiration gives an ally a d6 to add to one roll.',
      'You have five skills: you are the party face, so do the talking.',
      'Healing Word heals from range as a bonus action.',
    ],
    spells: ['Cantrips: Vicious Mockery, Minor Illusion', '1st level: Healing Word, Faerie Fire, Sleep, Thunderwave'],
    draft: {
      ...BASE, name: 'Lyric Aldane', alignment: 'Chaotic Good', backgroundId: 'entertainer',
      raceId: 'half-elf', classes: [{ classId: 'bard', level: 1 }],
      chosenLanguages: ['Halfling'], chosenTools: ['Lute', 'Flute', 'Lyre', 'Viol'],
      baseAbilities: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 },
      freeAbilityBonuses: ['dex', 'con'],
      chosenSkills: ['persuasion', 'deception', 'perception', 'insight', 'history'],
    },
  },
]

export const starterById = (id: string) => STARTER_HEROES.find(h => h.id === id)

/** The notes text a starter hero begins with. */
export function starterNotes(hero: StarterHero): string {
  return [
    hero.backstory,
    '',
    'How to play:',
    ...hero.tips.map(t => `- ${t}`),
    ...(hero.spells ? ['', 'Suggested spells:', ...hero.spells.map(s => `- ${s}`)] : []),
  ].join('\n')
}

/** A playable copy of a starter hero, owned by the given player. */
export function createStarter(hero: StarterHero, ownerId: string, playerName: string, now = new Date()): Character {
  const draft: CharacterDraft = { ...structuredClone(hero.draft), ownerId, playerName }
  return { ...createCharacter(draft, now), notes: starterNotes(hero) }
}

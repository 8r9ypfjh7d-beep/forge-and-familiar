// 2014-rules races from Monsters of the Multiverse (which reprints the Volo's, Elemental Evil and Mordenkainen
// races), Wild Beyond the Witchlight (Fairy, Harengon), Strixhaven (Owlin) and Tasha's Custom Lineage.
// Names and mechanics only; what each trait does is our own summary in i18n/locales/explain.races.*.ts.
import type { Race, RaceEffect, SkillId, Subrace, TraitChoice } from '../../types'
import { MUSICAL_INSTRUMENTS } from '../proficiencies'
import { TCE, dark, move, resist, skillProf } from './helpers'

export const MOTM = 'Monsters of the Multiverse'
export const WBW = 'The Wild Beyond the Witchlight'
export const SCC = 'Strixhaven: A Curriculum of Chaos'

const ONCE = '1/long rest'
const AT_WILL = 'at will'

/** A racial spell; `level` is the character level it arrives at. */
const spell = (name: string, note = ONCE, level = 1): RaceEffect =>
  ({ kind: 'spell', spell: name, note, ...(level > 1 ? { level } : {}) })
const adv = (when: string): RaceEffect => ({ kind: 'advantage', on: 'saves', when })
const pb = (trait: string, recharge: 'short' | 'long' = 'long', level?: number) => ({ trait, count: 'pb' as const, recharge, ...(level ? { level } : {}) })
const once = (trait: string, level?: number) => ({ trait, count: 1, recharge: 'long' as const, ...(level ? { level } : {}) })

/** Monsters of the Multiverse ability scores: +2 and +1, or +1 to three, any abilities. */
const FLEX = { abilityBonuses: {}, flexibleAbilityBonuses: true as const }
/** Common and one language of your choice. */
const LANG = { languages: ['Common'], languageChoices: 1 }

/** Pick `count` skills from a list; each option makes you proficient in it (the builder shows the skill's name). */
const skillPick = (id: string, name: string, from: SkillId[], count = 1): TraitChoice => ({
  id, name, ...(count > 1 ? { count } : {}), options: from.map(s => ({ id: s, name: s, effects: [skillProf(s)] })),
})
/** Medium or Small, chosen with the race. */
const SIZE = { sizeOptions: ['Medium', 'Small'] as Race['size'][] }

const genasi = (id: string, name: string, extra: Partial<Subrace>): Subrace => ({ id, name, abilityBonuses: {}, traits: [], ...extra })

export const MOTM_RACES: Race[] = [
  {
    id: 'aasimar', name: 'Aasimar', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    traits: ['Celestial Resistance', 'Darkvision', 'Healing Hands', 'Light Bearer', 'Celestial Revelation'],
    effects: [resist('necrotic'), resist('radiant'), dark(60), spell('Light', AT_WILL)],
    uses: [once('Healing Hands'), once('Celestial Revelation', 3)],
  },
  {
    id: 'bugbear', name: 'Bugbear', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    traits: ['Darkvision', 'Fey Ancestry', 'Long-Limbed', 'Powerful Build', 'Sneaky', 'Surprise Attack'],
    effects: [dark(60), adv('to avoid or end being charmed'), skillProf('stealth')],
  },
  {
    id: 'centaur', name: 'Centaur', source: MOTM, size: 'Medium', speed: 40, ...FLEX, ...LANG,
    choices: [skillPick('naturalAffinity', 'Natural Affinity', ['animalHandling', 'medicine', 'nature', 'survival'])],
    traits: ['Charge', 'Equine Build', 'Hooves', 'Natural Affinity'],
    naturalWeapons: [{ name: 'Hooves', damage: '1d6', type: 'bludgeoning' }],
  },
  {
    id: 'changeling', name: 'Changeling', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    choices: [skillPick('changelingInstincts', 'Changeling Instincts', ['deception', 'insight', 'intimidation', 'performance', 'persuasion'], 2)],
    traits: ['Changeling Instincts', 'Shapechanger'],
  },
  {
    id: 'fairy', name: 'Fairy', source: WBW, size: 'Small', speed: 30, ...FLEX, ...LANG,
    traits: ['Fairy Magic', 'Flight'],
    effects: [move('fly'), spell('Druidcraft', AT_WILL), spell('Faerie Fire', ONCE, 3), spell('Enlarge/Reduce', ONCE, 5)],
  },
  {
    id: 'firbolg', name: 'Firbolg', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    traits: ['Firbolg Magic', 'Hidden Step', 'Powerful Build', 'Speech of Beast and Leaf'],
    effects: [spell('Detect Magic'), spell('Disguise Self')],
    uses: [pb('Hidden Step')],
  },
  {
    id: 'genasi', name: 'Genasi', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    traits: ['Darkvision'],
    effects: [dark(60)],
    subraces: [
      genasi('air-genasi', 'Air Genasi', {
        speed: 35, traits: ['Unending Breath', 'Lightning Resistance', 'Mingle with the Wind'],
        effects: [resist('lightning'), spell('Shocking Grasp', AT_WILL), spell('Feather Fall', ONCE, 3), spell('Levitate', ONCE, 5)],
      }),
      genasi('earth-genasi', 'Earth Genasi', {
        traits: ['Earth Walk', 'Merge with Stone'],
        effects: [spell('Blade Ward', AT_WILL), spell('Pass without Trace', ONCE, 5)],
        uses: [pb('Merge with Stone')],
      }),
      genasi('fire-genasi', 'Fire Genasi', {
        traits: ['Fire Resistance', 'Reach to the Blaze'],
        effects: [resist('fire'), spell('Produce Flame', AT_WILL), spell('Burning Hands', ONCE, 3), spell('Flame Blade', ONCE, 5)],
      }),
      genasi('water-genasi', 'Water Genasi', {
        traits: ['Acid Resistance', 'Amphibious', 'Swim Speed', 'Call to the Wave'],
        effects: [resist('acid'), move('swim', 30), spell('Acid Splash', AT_WILL), spell('Create or Destroy Water', ONCE, 3), spell('Water Walk', ONCE, 5)],
      }),
    ],
  },
  {
    id: 'githyanki', name: 'Githyanki', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    traits: ['Astral Knowledge', 'Githyanki Psionics', 'Psychic Resilience'],
    effects: [resist('psychic'), spell('Mage Hand', AT_WILL), spell('Jump', ONCE, 3), spell('Misty Step', ONCE, 5)],
  },
  {
    id: 'githzerai', name: 'Githzerai', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    traits: ['Githzerai Psionics', 'Mental Discipline', 'Psychic Resilience'],
    effects: [
      resist('psychic'), adv('to avoid or end being charmed or frightened'),
      spell('Mage Hand', AT_WILL), spell('Shield', ONCE, 3), spell('Detect Thoughts', ONCE, 5),
    ],
  },
  {
    id: 'goblin', name: 'Goblin', source: MOTM, size: 'Small', speed: 30, ...FLEX, ...LANG,
    traits: ['Darkvision', 'Fey Ancestry', 'Fury of the Small', 'Nimble Escape'],
    effects: [dark(60), adv('to avoid or end being charmed')],
    uses: [pb('Fury of the Small')],
  },
  {
    id: 'goliath', name: 'Goliath', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    traits: ['Little Giant', 'Mountain Born', "Stone's Endurance"],
    effects: [skillProf('athletics'), resist('cold')],
    uses: [pb("Stone's Endurance")],
  },
  {
    id: 'harengon', name: 'Harengon', source: WBW, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    initiativeProficiency: true,
    traits: ['Hare-Trigger', 'Leporine Senses', 'Lucky Footwork', 'Rabbit Hop'],
    effects: [skillProf('perception')],
    uses: [pb('Rabbit Hop')],
  },
  {
    id: 'hobgoblin', name: 'Hobgoblin', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    traits: ['Darkvision', 'Fey Ancestry', 'Fey Gift', 'Fortune from the Many'],
    effects: [dark(60), adv('to avoid or end being charmed')],
    uses: [pb('Fey Gift'), pb('Fortune from the Many')],
  },
  {
    id: 'kenku', name: 'Kenku', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    choices: [skillPick('kenkuTraining', 'Kenku Training', ['acrobatics', 'deception', 'stealth', 'sleightOfHand'], 2)],
    traits: ['Expert Duplication', 'Kenku Recall', 'Kenku Training', 'Mimicry'],
    uses: [pb('Kenku Recall')],
  },
  {
    id: 'kobold', name: 'Kobold', source: MOTM, size: 'Small', speed: 30, ...FLEX, ...LANG,
    choices: [{
      id: 'koboldLegacy', name: 'Kobold Legacy',
      options: [
        ...(['arcana', 'investigation', 'medicine', 'sleightOfHand', 'survival'] as SkillId[]).map(s => ({ id: `craftiness-${s}`, name: 'Craftiness', effects: [skillProf(s)] })),
        { id: 'defiance', name: 'Defiance', effects: [adv('to avoid or end being frightened')] },
        { id: 'draconicSorcery', name: 'Draconic Sorcery', effects: [spell('A sorcerer cantrip of your choice', AT_WILL)] },
      ],
    }],
    traits: ['Darkvision', 'Draconic Cry', 'Kobold Legacy'],
    effects: [dark(60)],
    uses: [pb('Draconic Cry')],
  },
  {
    id: 'lizardfolk', name: 'Lizardfolk', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    choices: [skillPick('naturesIntuition', "Nature's Intuition", ['animalHandling', 'medicine', 'nature', 'perception', 'stealth', 'survival'], 2)],
    naturalArmor: { base: 13, dex: true },
    naturalWeapons: [{ name: 'Bite', damage: '1d6', type: 'piercing' }],
    traits: ['Bite', 'Hold Breath', 'Hungry Jaws', 'Natural Armor', "Nature's Intuition", 'Swim Speed'],
    effects: [move('swim', 30)],
    uses: [pb('Hungry Jaws')],
  },
  {
    id: 'minotaur', name: 'Minotaur', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    naturalWeapons: [{ name: 'Horns', damage: '1d6', type: 'piercing' }],
    traits: ['Horns', 'Goring Rush', 'Hammering Horns', 'Labyrinthine Recall'],
    effects: [{ kind: 'advantage', on: 'skill:survival', when: 'to find your way or track' }],
  },
  {
    id: 'orc', name: 'Orc', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    traits: ['Adrenaline Rush', 'Darkvision', 'Powerful Build', 'Relentless Endurance'],
    effects: [dark(60)],
    uses: [pb('Adrenaline Rush', 'short'), once('Relentless Endurance')],
  },
  {
    id: 'satyr', name: 'Satyr', source: MOTM, size: 'Medium', speed: 35, ...FLEX, ...LANG,
    toolChoices: { count: 1, from: MUSICAL_INSTRUMENTS },
    naturalWeapons: [{ name: 'Ram', damage: '1d6', type: 'bludgeoning' }],
    traits: ['Ram', 'Magic Resistance', 'Mirthful Leaps', 'Reveler'],
    effects: [adv('against spells'), skillProf('performance'), skillProf('persuasion')],
  },
  {
    id: 'tabaxi', name: 'Tabaxi', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    naturalWeapons: [{ name: "Cat's Claws", damage: '1d6', type: 'slashing' }],
    traits: ["Cat's Claws", "Cat's Talent", 'Darkvision', 'Feline Agility'],
    effects: [move('climb', 30), skillProf('perception'), skillProf('stealth'), dark(60)],
  },
  {
    id: 'tortle', name: 'Tortle', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    choices: [skillPick('naturesIntuition', "Nature's Intuition", ['animalHandling', 'medicine', 'nature', 'perception', 'stealth', 'survival'])],
    naturalArmor: { base: 17, dex: false },
    naturalWeapons: [{ name: 'Claws', damage: '1d6', type: 'slashing' }],
    traits: ['Claws', 'Hold Breath', 'Natural Armor', "Nature's Intuition", 'Shell Defense'],
  },
  {
    id: 'triton', name: 'Triton', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    traits: ['Amphibious', 'Control Air and Water', 'Darkvision', 'Emissary of the Sea', 'Guardians of the Depths', 'Swim Speed'],
    effects: [move('swim', 30), dark(60), resist('cold'), spell('Fog Cloud'), spell('Gust of Wind', ONCE, 3), spell('Water Walk', ONCE, 5)],
  },
  {
    id: 'yuan-ti', name: 'Yuan-ti', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    traits: ['Darkvision', 'Magic Resistance', 'Poison Resilience', 'Serpentine Spellcasting'],
    effects: [
      dark(60), adv('against spells'), adv('to avoid or end being poisoned'), resist('poison'),
      spell('Poison Spray', AT_WILL), spell('Animal Friendship', 'at will, snakes only'), spell('Suggestion', ONCE, 3),
    ],
  },
  {
    id: 'aarakocra', name: 'Aarakocra', source: MOTM, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    naturalWeapons: [{ name: 'Talons', damage: '1d6', type: 'slashing' }],
    traits: ['Flight', 'Talons', 'Wind Caller'],
    effects: [move('fly'), spell('Gust of Wind', ONCE, 3)],
  },
  {
    id: 'owlin', name: 'Owlin', source: SCC, size: 'Medium', speed: 30, ...FLEX, ...LANG,
    ...SIZE,
    traits: ['Darkvision (120 ft.)', 'Flight', 'Silent Feathers'],
    effects: [dark(120), move('fly'), skillProf('stealth')],
  },
  {
    id: 'custom-lineage', name: 'Custom Lineage', source: TCE, size: 'Medium', speed: 30,
    abilityBonuses: {}, freeAbilityBonuses: { count: 1, exclude: [], value: 2 }, ...LANG,
    freeSkillChoices: 1,
    featChoice: true,
    ...SIZE,
    choices: [
      {
        id: 'variableTrait', name: 'Variable Trait',
        options: [
          { id: 'darkvision', name: 'Darkvision', effects: [dark(60)] },
          ...(['acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine',
            'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'] as SkillId[])
            .map(s => ({ id: s, name: s, effects: [skillProf(s)] })),
        ],
      },
    ],
    traits: ['Feat', 'Variable Trait'],
  },
]

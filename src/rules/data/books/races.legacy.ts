// The older printings of the Monsters of the Multiverse races, for tables that still use them: Volo's Guide to
// Monsters, the Elemental Evil Player's Companion, Mordenkainen's Tome of Foes and the Tortle Package. Fixed ability
// bonuses and the original traits. Names and mechanics only; text is ours in i18n/locales/explain.races.*.ts.
import type { Race, RaceEffect, RaceUse, SkillId, Subrace } from '../../types'
import { dark, move, resist, skillProf } from './helpers'

export const VGM = "Volo's Guide to Monsters"
export const EEPC = "Elemental Evil Player's Companion"
export const MTF = "Mordenkainen's Tome of Foes"
export const TTP = 'The Tortle Package'

const ONCE = '1/long rest'
const AT_WILL = 'at will'

const spell = (name: string, note = ONCE, level = 1): RaceEffect => ({ kind: 'spell', spell: name, note, ...(level > 1 ? { level } : {}) })
const adv = (when: string): RaceEffect => ({ kind: 'advantage', on: 'saves', when })
const use = (trait: string, recharge: 'short' | 'long', level?: number): RaceUse => ({ trait, count: 1, recharge, ...(level ? { level } : {}) })
const skillPick = (id: string, name: string, from: SkillId[], count: number) => ({
  id, name, count, options: from.map(s => ({ id: s, name: s, effects: [skillProf(s)] })),
})
const sub = (id: string, name: string, extra: Partial<Subrace>): Subrace => ({ id, name, abilityBonuses: {}, traits: [], ...extra })

export const LEGACY_RACES: Race[] = [
  {
    id: 'aasimar-volo', name: "Aasimar (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { cha: 2 }, languages: ['Common', 'Celestial'],
    traits: ['Darkvision', 'Celestial Resistance', 'Healing Hands', 'Light Bearer'],
    effects: [dark(60), resist('necrotic'), resist('radiant'), spell('Light', AT_WILL)],
    uses: [use('Healing Hands', 'long')],
    subraces: [
      sub('protector-aasimar', 'Protector Aasimar', { abilityBonuses: { wis: 1 }, traits: ['Radiant Soul'], uses: [use('Radiant Soul', 'long', 3)] }),
      sub('scourge-aasimar', 'Scourge Aasimar', { abilityBonuses: { con: 1 }, traits: ['Radiant Consumption'], uses: [use('Radiant Consumption', 'long', 3)] }),
      sub('fallen-aasimar', 'Fallen Aasimar', { abilityBonuses: { str: 1 }, traits: ['Necrotic Shroud'], uses: [use('Necrotic Shroud', 'long', 3)] }),
    ],
  },
  {
    id: 'bugbear-volo', name: "Bugbear (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, dex: 1 }, languages: ['Common', 'Goblin'],
    traits: ['Darkvision', 'Long-Limbed', 'Powerful Build', 'Sneaky', 'Surprise Attack'],
    effects: [dark(60), skillProf('stealth')],
  },
  {
    id: 'firbolg-volo', name: "Firbolg (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { wis: 2, str: 1 }, languages: ['Common', 'Elvish', 'Giant'],
    traits: ['Firbolg Magic', 'Hidden Step', 'Powerful Build', 'Speech of Beast and Leaf'],
    effects: [spell('Detect Magic', '1/short rest'), spell('Disguise Self', '1/short rest')],
    uses: [use('Hidden Step', 'short')],
  },
  {
    id: 'genasi-eepc', name: 'Genasi (Elemental Evil)', source: EEPC, size: 'Medium', speed: 30,
    abilityBonuses: { con: 2 }, languages: ['Common', 'Primordial'],
    traits: [],
    subraces: [
      sub('air-genasi-eepc', 'Air Genasi', {
        abilityBonuses: { dex: 1 }, traits: ['Unending Breath', 'Mingle with the Wind'], effects: [spell('Levitate')],
      }),
      sub('earth-genasi-eepc', 'Earth Genasi', {
        abilityBonuses: { str: 1 }, traits: ['Earth Walk', 'Merge with Stone'], effects: [spell('Pass without Trace')],
      }),
      sub('fire-genasi-eepc', 'Fire Genasi', {
        abilityBonuses: { int: 1 }, traits: ['Darkvision', 'Fire Resistance', 'Reach to the Blaze'],
        effects: [dark(60), resist('fire'), spell('Produce Flame', AT_WILL), spell('Burning Hands', ONCE, 3)],
      }),
      sub('water-genasi-eepc', 'Water Genasi', {
        abilityBonuses: { wis: 1 }, traits: ['Acid Resistance', 'Amphibious', 'Swim Speed', 'Call to the Wave'],
        effects: [resist('acid'), move('swim', 30), spell('Shape Water', AT_WILL), spell('Create or Destroy Water', ONCE, 3)],
      }),
    ],
  },
  {
    id: 'gith', name: "Gith (Mordenkainen's)", source: MTF, size: 'Medium', speed: 30,
    abilityBonuses: { int: 1 }, languages: ['Common', 'Gith'],
    traits: [],
    subraces: [
      sub('githyanki-mtf', 'Githyanki', {
        abilityBonuses: { str: 2 }, languageChoices: 1, freeSkillChoices: 1,
        traits: ['Decadent Mastery', 'Martial Prodigy', 'Githyanki Psionics'],
        armor: ['light', 'medium'], weaponIds: ['shortsword', 'longsword', 'greatsword'],
        effects: [spell('Mage Hand', AT_WILL), spell('Jump', ONCE, 3), spell('Misty Step', ONCE, 5)],
      }),
      sub('githzerai-mtf', 'Githzerai', {
        abilityBonuses: { wis: 2 },
        traits: ['Mental Discipline', 'Githzerai Psionics'],
        effects: [adv('against being charmed or frightened'), spell('Mage Hand', AT_WILL), spell('Shield', ONCE, 3), spell('Detect Thoughts', ONCE, 5)],
      }),
    ],
  },
  {
    id: 'goblin-volo', name: "Goblin (Volo's)", source: VGM, size: 'Small', speed: 30,
    abilityBonuses: { dex: 2, con: 1 }, languages: ['Common', 'Goblin'],
    traits: ['Darkvision', 'Fury of the Small', 'Nimble Escape'],
    effects: [dark(60)],
    uses: [use('Fury of the Small', 'short')],
  },
  {
    id: 'goliath-volo', name: "Goliath (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, con: 1 }, languages: ['Common', 'Giant'],
    traits: ['Natural Athlete', "Stone's Endurance", 'Powerful Build', 'Mountain Born'],
    effects: [skillProf('athletics'), resist('cold')],
    uses: [use("Stone's Endurance", 'short')],
  },
  {
    id: 'hobgoblin-volo', name: "Hobgoblin (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { con: 2, int: 1 }, languages: ['Common', 'Goblin'],
    armor: ['light'],
    traits: ['Darkvision', 'Martial Training', 'Saving Face'],
    effects: [dark(60)],
    uses: [use('Saving Face', 'short')],
  },
  {
    id: 'kenku-volo', name: "Kenku (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { dex: 2, wis: 1 }, languages: ['Common', 'Auran'],
    choices: [skillPick('kenkuTraining', 'Kenku Training', ['acrobatics', 'deception', 'stealth', 'sleightOfHand'], 2)],
    traits: ['Expert Forgery', 'Kenku Training', 'Mimicry'],
  },
  {
    id: 'kobold-volo', name: "Kobold (Volo's)", source: VGM, size: 'Small', speed: 30,
    abilityBonuses: { dex: 2, str: -2 }, languages: ['Common', 'Draconic'],
    traits: ['Darkvision', 'Grovel, Cower, and Beg', 'Pack Tactics', 'Sunlight Sensitivity'],
    effects: [dark(60)],
    uses: [use('Grovel, Cower, and Beg', 'short')],
  },
  {
    id: 'lizardfolk-volo', name: "Lizardfolk (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { con: 2, wis: 1 }, languages: ['Common', 'Draconic'],
    choices: [skillPick('huntersLore', "Hunter's Lore", ['animalHandling', 'nature', 'perception', 'stealth', 'survival'], 2)],
    naturalArmor: { base: 13, dex: true },
    naturalWeapons: [{ name: 'Bite', damage: '1d6', type: 'piercing' }],
    traits: ['Bite', 'Cunning Artisan', 'Hold Breath', "Hunter's Lore", 'Natural Armor', 'Hungry Jaws', 'Swim Speed'],
    effects: [move('swim', 30)],
    uses: [use('Hungry Jaws', 'short')],
  },
  {
    id: 'orc-volo', name: "Orc (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, con: 1, int: -2 }, languages: ['Common', 'Orc'],
    traits: ['Darkvision', 'Aggressive', 'Menacing', 'Powerful Build'],
    effects: [dark(60), skillProf('intimidation')],
  },
  {
    id: 'tabaxi-volo', name: "Tabaxi (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { dex: 2, cha: 1 }, languages: ['Common'], languageChoices: 1,
    naturalWeapons: [{ name: "Cat's Claws", damage: '1d4', type: 'slashing' }],
    traits: ['Darkvision', 'Feline Agility', "Cat's Claws", "Cat's Talent"],
    effects: [dark(60), move('climb', 20), skillProf('perception'), skillProf('stealth')],
  },
  {
    id: 'triton-volo', name: "Triton (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { str: 1, con: 1, cha: 1 }, languages: ['Common', 'Primordial'],
    traits: ['Amphibious', 'Control Air and Water', 'Emissary of the Sea', 'Guardians of the Depths', 'Swim Speed'],
    effects: [move('swim', 30), resist('cold'), spell('Fog Cloud'), spell('Gust of Wind', ONCE, 3), spell('Wall of Water', ONCE, 5)],
  },
  {
    id: 'yuan-ti-volo', name: "Yuan-ti Pureblood (Volo's)", source: VGM, size: 'Medium', speed: 30,
    abilityBonuses: { cha: 2, int: 1 }, languages: ['Common', 'Abyssal', 'Draconic'],
    traits: ['Darkvision', 'Innate Spellcasting', 'Magic Resistance', 'Poison Immunity'],
    effects: [
      dark(60), adv('against spells'), { kind: 'immunity', damage: 'poison' }, { kind: 'conditionImmunity', condition: 'poisoned' },
      spell('Poison Spray', AT_WILL), spell('Animal Friendship', 'at will, snakes only'), spell('Suggestion', ONCE, 3),
    ],
  },
  {
    id: 'aarakocra-eepc', name: 'Aarakocra (Elemental Evil)', source: EEPC, size: 'Medium', speed: 25,
    abilityBonuses: { dex: 2, wis: 1 }, languages: ['Common', 'Aarakocra', 'Auran'],
    naturalWeapons: [{ name: 'Talons', damage: '1d4', type: 'slashing' }],
    traits: ['Flight', 'Talons'],
    effects: [move('fly', 50)],
  },
  {
    id: 'tortle-ttp', name: 'Tortle (Tortle Package)', source: TTP, size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, wis: 1 }, languages: ['Common', 'Aquan'],
    naturalArmor: { base: 17, dex: false },
    naturalWeapons: [{ name: 'Claws', damage: '1d4', type: 'slashing' }],
    traits: ['Claws', 'Hold Breath', 'Natural Armor', 'Shell Defense', 'Survival Instinct'],
    effects: [skillProf('survival')],
  },
]

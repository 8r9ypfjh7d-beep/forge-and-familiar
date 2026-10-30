import type { ItemEffect, Race, RaceEffect } from '../../types'
import { dark, resist } from '../books/helpers'

// SRD 5.2 (2024) species. Ability bonuses come from the background, languages from the character's origin
// (Common plus two, see backgrounds.ts), so species carry neither. `effects` put the traits' rules on the sheet:
// innate spells are cast from "From your items" (cantrips at will, the rest once per long rest from their level).
const ANCESTRY = (color: string, damage: string) => ({
  id: color.toLowerCase(), name: color, detail: `${damage} damage: breath weapon (15 ft. cone or 30 ft. line, DEX save) and resistance`,
  effects: [{ ...resist(damage.toLowerCase()), trait: 'Damage Resistance' }],
})
/** A lineage or legacy spell: a cantrip at 1st level, the others once per long rest from character level 3 or 5. */
const spell = (trait: string, name: string, level = 1, note = level > 1 ? 'once per long rest' : 'at will'): RaceEffect =>
  ({ kind: 'spell', spell: name, note, trait, ...(level > 1 ? { level } : {}) })
const adv = (on: Extract<ItemEffect, { kind: 'advantage' }>['on'], when: string): ItemEffect => ({ kind: 'advantage', on, when })
const fiendish = (damage: string, cantrip: string, third: string, fifth: string): RaceEffect[] =>
  [{ ...resist(damage), trait: 'Fiendish Legacy' }, spell('Fiendish Legacy', cantrip), spell('Fiendish Legacy', third, 3), spell('Fiendish Legacy', fifth, 5)]

export const SPECIES: Race[] = [
  {
    id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [],
    traitChoice: {
      id: 'draconicAncestry', name: 'Draconic Ancestry',
      options: [
        ANCESTRY('Black', 'Acid'), ANCESTRY('Blue', 'Lightning'), ANCESTRY('Brass', 'Fire'), ANCESTRY('Bronze', 'Lightning'),
        ANCESTRY('Copper', 'Acid'), ANCESTRY('Gold', 'Fire'), ANCESTRY('Green', 'Poison'), ANCESTRY('Red', 'Fire'),
        ANCESTRY('Silver', 'Cold'), ANCESTRY('White', 'Cold'),
      ],
    },
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Darkvision', 'Draconic Flight'],
    effects: [dark(60)],
    uses: [{ trait: 'Breath Weapon', count: 'pb', recharge: 'long' }, { trait: 'Draconic Flight', count: 1, recharge: 'long', level: 5 }],
  },
  {
    id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [], hpPerLevel: 1,
    traits: ['Darkvision (120 ft.)', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'],
    effects: [dark(120), resist('poison'), adv('saves', 'to avoid or end the Poisoned condition')],
    uses: [{ trait: 'Stonecunning', count: 'pb', recharge: 'long' }],
  },
  {
    id: 'elf', name: 'Elf', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [], freeSkillChoices: 1, freeSkillFrom: ['insight', 'perception', 'survival'], spellAbilityChoice: true,
    traits: ['Darkvision', 'Elven Lineage', 'Fey Ancestry', 'Keen Senses (Insight, Perception or Survival)', 'Trance'],
    effects: [dark(60), adv('saves', 'to avoid or end the Charmed condition')],
    subraces: [
      {
        id: 'drow', name: 'Drow', abilityBonuses: {}, traits: ['Darkvision (120 ft.)', 'Dancing Lights', 'Faerie Fire (3rd level)', 'Darkness (5th level)'],
        effects: [dark(120), spell('Elven Lineage', 'Dancing Lights'), spell('Elven Lineage', 'Faerie Fire', 3), spell('Elven Lineage', 'Darkness', 5)],
      },
      {
        id: 'high-elf', name: 'High Elf', abilityBonuses: {}, traits: ['Prestidigitation', 'Detect Magic (3rd level)', 'Misty Step (5th level)'],
        effects: [spell('Elven Lineage', 'Prestidigitation'), spell('Elven Lineage', 'Detect Magic', 3), spell('Elven Lineage', 'Misty Step', 5)],
      },
      {
        id: 'wood-elf', name: 'Wood Elf', abilityBonuses: {}, speed: 35, traits: ['Druidcraft', 'Longstrider (3rd level)', 'Pass without Trace (5th level)'],
        effects: [spell('Elven Lineage', 'Druidcraft'), spell('Elven Lineage', 'Longstrider', 3), spell('Elven Lineage', 'Pass without Trace', 5)],
      },
    ],
  },
  {
    id: 'gnome', name: 'Gnome', size: 'Small', speed: 30, abilityBonuses: {}, languages: [], spellAbilityChoice: true,
    traits: ['Darkvision', 'Gnomish Cunning', 'Gnomish Lineage'],
    effects: [dark(60), ...(['int', 'wis', 'cha'] as const).map(a => adv(`save:${a}`, 'Gnomish Cunning'))],
    subraces: [
      {
        id: 'forest-gnome', name: 'Forest Gnome', abilityBonuses: {}, traits: ['Minor Illusion', 'Speak with Animals'],
        effects: [spell('Gnomish Lineage', 'Minor Illusion'), spell('Gnomish Lineage', 'Speak with Animals', 1, 'proficiency bonus times per long rest')],
      },
      {
        id: 'rock-gnome', name: 'Rock Gnome', abilityBonuses: {}, traits: ['Mending', 'Prestidigitation', 'Clockwork Devices'],
        effects: [spell('Gnomish Lineage', 'Mending'), spell('Gnomish Lineage', 'Prestidigitation')],
      },
    ],
  },
  {
    id: 'goliath', name: 'Goliath', size: 'Medium', speed: 35, abilityBonuses: {}, languages: [],
    traits: ['Giant Ancestry', 'Large Form', 'Powerful Build'],
    uses: [{ trait: 'Large Form', count: 1, recharge: 'long', level: 5 }],
    subraces: [
      { id: 'cloud-giant', name: "Cloud's Jaunt", abilityBonuses: {}, traits: ["Cloud's Jaunt"], uses: [{ trait: "Cloud's Jaunt", count: 'pb', recharge: 'long' }] },
      { id: 'fire-giant', name: "Fire's Burn", abilityBonuses: {}, traits: ["Fire's Burn"], uses: [{ trait: "Fire's Burn", count: 'pb', recharge: 'long' }] },
      { id: 'frost-giant', name: "Frost's Chill", abilityBonuses: {}, traits: ["Frost's Chill"], uses: [{ trait: "Frost's Chill", count: 'pb', recharge: 'long' }] },
      { id: 'hill-giant', name: "Hill's Tumble", abilityBonuses: {}, traits: ["Hill's Tumble"], uses: [{ trait: "Hill's Tumble", count: 'pb', recharge: 'long' }] },
      { id: 'stone-giant', name: "Stone's Endurance", abilityBonuses: {}, traits: ["Stone's Endurance"], uses: [{ trait: "Stone's Endurance", count: 'pb', recharge: 'long' }] },
      { id: 'storm-giant', name: "Storm's Thunder", abilityBonuses: {}, traits: ["Storm's Thunder"], uses: [{ trait: "Storm's Thunder", count: 'pb', recharge: 'long' }] },
    ],
  },
  {
    id: 'halfling', name: 'Halfling', size: 'Small', speed: 30, abilityBonuses: {}, languages: [],
    traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'],
    effects: [adv('saves', 'to avoid or end the Frightened condition')],
  },
  {
    id: 'human', name: 'Human', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [],
    freeSkillChoices: 1, originFeatChoice: true,
    traits: ['Resourceful', 'Skillful', 'Versatile'],
  },
  {
    id: 'orc', name: 'Orc', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [],
    traits: ['Adrenaline Rush', 'Darkvision (120 ft.)', 'Relentless Endurance'],
    effects: [dark(120)],
    uses: [{ trait: 'Adrenaline Rush', count: 'pb', recharge: 'short' }, { trait: 'Relentless Endurance', count: 1, recharge: 'long' }],
  },
  {
    id: 'tiefling', name: 'Tiefling', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [], spellAbilityChoice: true,
    traits: ['Darkvision', 'Fiendish Legacy', 'Otherworldly Presence (Thaumaturgy)'],
    effects: [dark(60), spell('Otherworldly Presence', 'Thaumaturgy')],
    subraces: [
      {
        id: 'abyssal', name: 'Abyssal', abilityBonuses: {}, traits: ['Poison resistance', 'Poison Spray', 'Ray of Sickness (3rd level)', 'Hold Person (5th level)'],
        effects: fiendish('poison', 'Poison Spray', 'Ray of Sickness', 'Hold Person'),
      },
      {
        id: 'chthonic', name: 'Chthonic', abilityBonuses: {}, traits: ['Necrotic resistance', 'Chill Touch', 'False Life (3rd level)', 'Ray of Enfeeblement (5th level)'],
        effects: fiendish('necrotic', 'Chill Touch', 'False Life', 'Ray of Enfeeblement'),
      },
      {
        id: 'infernal', name: 'Infernal', abilityBonuses: {}, traits: ['Fire resistance', 'Fire Bolt', 'Hellish Rebuke (3rd level)', 'Darkness (5th level)'],
        effects: fiendish('fire', 'Fire Bolt', 'Hellish Rebuke', 'Darkness'),
      },
    ],
  },
]

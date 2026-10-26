import type { Race } from '../../types'

// SRD 5.2 (2024) species. Ability bonuses come from the background, languages from the character's origin
// (Common plus two, see backgrounds.ts), so species carry neither.
const ANCESTRY = (color: string, damage: string) => ({ id: color.toLowerCase(), name: color, detail: `${damage} damage: breath weapon (15 ft. cone or 30 ft. line, DEX save) and resistance` })

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
  },
  {
    id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [], hpPerLevel: 1,
    traits: ['Darkvision (120 ft.)', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'],
  },
  {
    id: 'elf', name: 'Elf', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [], freeSkillChoices: 1,
    traits: ['Darkvision', 'Elven Lineage', 'Fey Ancestry', 'Keen Senses (Insight, Perception or Survival)', 'Trance'],
    subraces: [
      { id: 'drow', name: 'Drow', abilityBonuses: {}, traits: ['Darkvision (120 ft.)', 'Dancing Lights', 'Faerie Fire (3rd level)', 'Darkness (5th level)'] },
      { id: 'high-elf', name: 'High Elf', abilityBonuses: {}, traits: ['Prestidigitation', 'Detect Magic (3rd level)', 'Misty Step (5th level)'] },
      { id: 'wood-elf', name: 'Wood Elf', abilityBonuses: {}, speed: 35, traits: ['Druidcraft', 'Longstrider (3rd level)', 'Pass without Trace (5th level)'] },
    ],
  },
  {
    id: 'gnome', name: 'Gnome', size: 'Small', speed: 30, abilityBonuses: {}, languages: [],
    traits: ['Darkvision', 'Gnomish Cunning', 'Gnomish Lineage'],
    subraces: [
      { id: 'forest-gnome', name: 'Forest Gnome', abilityBonuses: {}, traits: ['Minor Illusion', 'Speak with Animals'] },
      { id: 'rock-gnome', name: 'Rock Gnome', abilityBonuses: {}, traits: ['Mending', 'Prestidigitation', 'Clockwork Devices'] },
    ],
  },
  {
    id: 'goliath', name: 'Goliath', size: 'Medium', speed: 35, abilityBonuses: {}, languages: [],
    traits: ['Giant Ancestry', 'Large Form', 'Powerful Build'],
    subraces: [
      { id: 'cloud-giant', name: "Cloud's Jaunt", abilityBonuses: {}, traits: ["Cloud's Jaunt"] },
      { id: 'fire-giant', name: "Fire's Burn", abilityBonuses: {}, traits: ["Fire's Burn"] },
      { id: 'frost-giant', name: "Frost's Chill", abilityBonuses: {}, traits: ["Frost's Chill"] },
      { id: 'hill-giant', name: "Hill's Tumble", abilityBonuses: {}, traits: ["Hill's Tumble"] },
      { id: 'stone-giant', name: "Stone's Endurance", abilityBonuses: {}, traits: ["Stone's Endurance"] },
      { id: 'storm-giant', name: "Storm's Thunder", abilityBonuses: {}, traits: ["Storm's Thunder"] },
    ],
  },
  {
    id: 'halfling', name: 'Halfling', size: 'Small', speed: 30, abilityBonuses: {}, languages: [],
    traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'],
  },
  {
    id: 'human', name: 'Human', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [],
    freeSkillChoices: 1, originFeatChoice: true,
    traits: ['Resourceful', 'Skillful', 'Versatile'],
  },
  {
    id: 'orc', name: 'Orc', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [],
    traits: ['Adrenaline Rush', 'Darkvision (120 ft.)', 'Relentless Endurance'],
  },
  {
    id: 'tiefling', name: 'Tiefling', size: 'Medium', speed: 30, abilityBonuses: {}, languages: [],
    traits: ['Darkvision', 'Fiendish Legacy', 'Otherworldly Presence (Thaumaturgy)'],
    subraces: [
      { id: 'abyssal', name: 'Abyssal', abilityBonuses: {}, traits: ['Poison resistance', 'Poison Spray', 'Ray of Sickness (3rd level)', 'Hold Person (5th level)'] },
      { id: 'chthonic', name: 'Chthonic', abilityBonuses: {}, traits: ['Necrotic resistance', 'Chill Touch', 'False Life (3rd level)', 'Ray of Enfeeblement (5th level)'] },
      { id: 'infernal', name: 'Infernal', abilityBonuses: {}, traits: ['Fire resistance', 'Fire Bolt', 'Hellish Rebuke (3rd level)', 'Darkness (5th level)'] },
    ],
  },
]

import type { Race } from '../types'

// SRD 5.1 races and subraces only.
export const RACES: Race[] = [
  {
    id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 25,
    abilityBonuses: { con: 2 },
    languages: ['Common', 'Dwarvish'],
    traits: ['Darkvision', 'Dwarven Resilience', 'Dwarven Combat Training', 'Stonecunning'],
    subraces: [
      { id: 'hill-dwarf', name: 'Hill Dwarf', abilityBonuses: { wis: 1 }, traits: ['Dwarven Toughness'], hpPerLevel: 1 },
    ],
  },
  {
    id: 'elf', name: 'Elf', size: 'Medium', speed: 30,
    abilityBonuses: { dex: 2 },
    skillProficiencies: ['perception'],
    languages: ['Common', 'Elvish'],
    traits: ['Darkvision', 'Keen Senses', 'Fey Ancestry', 'Trance'],
    subraces: [
      { id: 'high-elf', name: 'High Elf', abilityBonuses: { int: 1 }, traits: ['Elf Weapon Training', 'Cantrip', 'Extra Language'] },
    ],
  },
  {
    id: 'halfling', name: 'Halfling', size: 'Small', speed: 25,
    abilityBonuses: { dex: 2 },
    languages: ['Common', 'Halfling'],
    traits: ['Lucky', 'Brave', 'Halfling Nimbleness'],
    subraces: [
      { id: 'lightfoot', name: 'Lightfoot', abilityBonuses: { cha: 1 }, traits: ['Naturally Stealthy'] },
    ],
  },
  {
    id: 'human', name: 'Human', size: 'Medium', speed: 30,
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    languages: ['Common', 'One extra language'],
    traits: [],
  },
  {
    id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, cha: 1 },
    languages: ['Common', 'Draconic'],
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'],
  },
  {
    id: 'gnome', name: 'Gnome', size: 'Small', speed: 25,
    abilityBonuses: { int: 2 },
    languages: ['Common', 'Gnomish'],
    traits: ['Darkvision', 'Gnome Cunning'],
    subraces: [
      { id: 'rock-gnome', name: 'Rock Gnome', abilityBonuses: { con: 1 }, traits: ["Artificer's Lore", 'Tinker'] },
    ],
  },
  {
    id: 'half-elf', name: 'Half-Elf', size: 'Medium', speed: 30,
    abilityBonuses: { cha: 2 },
    freeAbilityBonuses: { count: 2, exclude: ['cha'] },
    freeSkillChoices: 2,
    languages: ['Common', 'Elvish', 'One extra language'],
    traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility'],
  },
  {
    id: 'half-orc', name: 'Half-Orc', size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, con: 1 },
    skillProficiencies: ['intimidation'],
    languages: ['Common', 'Orc'],
    traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks'],
  },
  {
    id: 'tiefling', name: 'Tiefling', size: 'Medium', speed: 30,
    abilityBonuses: { int: 1, cha: 2 },
    languages: ['Common', 'Infernal'],
    traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'],
  },
]

export const raceById = (id: string) => RACES.find(r => r.id === id)

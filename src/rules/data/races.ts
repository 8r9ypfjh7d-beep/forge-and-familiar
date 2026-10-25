import type { Race, Subrace } from '../types'

// SRD 5.1 races and subraces only.
export const RACES: Race[] = [
  {
    id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 25,
    abilityBonuses: { con: 2 },
    languages: ['Common', 'Dwarvish'],
    toolChoices: { count: 1, from: ["Smith's tools", "Brewer's supplies", "Mason's tools"] },
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
      { id: 'high-elf', name: 'High Elf', abilityBonuses: { int: 1 }, traits: ['Elf Weapon Training', 'Cantrip', 'Extra Language'], languageChoices: 1 },
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
    languages: ['Common'],
    languageChoices: 1,
    traits: [],
  },
  {
    id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, cha: 1 },
    languages: ['Common', 'Draconic'],
    traitChoice: {
      id: 'draconicAncestry', name: 'Draconic Ancestry',
      options: [
        { id: 'black', name: 'Black', detail: 'Acid, 5 by 30 ft. line (DEX save)' },
        { id: 'blue', name: 'Blue', detail: 'Lightning, 5 by 30 ft. line (DEX save)' },
        { id: 'brass', name: 'Brass', detail: 'Fire, 5 by 30 ft. line (DEX save)' },
        { id: 'bronze', name: 'Bronze', detail: 'Lightning, 5 by 30 ft. line (DEX save)' },
        { id: 'copper', name: 'Copper', detail: 'Acid, 5 by 30 ft. line (DEX save)' },
        { id: 'gold', name: 'Gold', detail: 'Fire, 15 ft. cone (DEX save)' },
        { id: 'green', name: 'Green', detail: 'Poison, 15 ft. cone (CON save)' },
        { id: 'red', name: 'Red', detail: 'Fire, 15 ft. cone (DEX save)' },
        { id: 'silver', name: 'Silver', detail: 'Cold, 15 ft. cone (CON save)' },
        { id: 'white', name: 'White', detail: 'Cold, 15 ft. cone (CON save)' },
      ],
    },
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
    languages: ['Common', 'Elvish'],
    languageChoices: 1,
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

// Homebrew races and subraces registered at runtime (ids namespaced `hb:<packId>:<slug>`).
let merged: Race[] = RACES

/** Replace the registered homebrew races. Subraces (parentRaceId set) attach to their race; SRD ids always win. */
export function registerHomebrewRaces(races: Race[], subraces: Subrace[]): void {
  const srd = new Set(RACES.map(r => r.id))
  const all = [...RACES, ...races.filter(r => !srd.has(r.id))]
  merged = all.map(r => {
    const extra = subraces.filter(s => s.parentRaceId === r.id)
    return extra.length ? { ...r, subraces: [...(r.subraces ?? []), ...extra] } : r
  })
}

/** SRD races followed by homebrew ones, with homebrew subraces attached. */
export const allRaces = (): Race[] => merged

export const raceById = (id: string) => merged.find(r => r.id === id)

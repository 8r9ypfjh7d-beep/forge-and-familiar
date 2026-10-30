import type { Race, RaceEffect, RulesEdition, Subrace } from '../types'
import { BOOK_RACES_2014, BOOK_SUBRACES_2014, dark, resist, spell } from './books/races.2014'
import { LEGACY_RACES } from './books/races.legacy'
import { MOTM_RACES } from './books/races.motm'
import { SETTING_RACES, SETTING_SUBRACES } from './books/races.settings'
import { BOOK_SPECIES_2024 } from './books/species2024'
import { SPECIES } from './srd52/species'

// SRD 5.1 races and subraces only. `effects` put the traits' rules on the sheet.
const feyAncestry: RaceEffect = { kind: 'advantage', on: 'saves', when: "against being charmed; magic can't put you to sleep" }
export const RACES: Race[] = [
  {
    id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 25,
    abilityBonuses: { con: 2 },
    languages: ['Common', 'Dwarvish'],
    toolChoices: { count: 1, from: ["Smith's tools", "Brewer's supplies", "Mason's tools"] },
    traits: ['Darkvision', 'Dwarven Resilience', 'Dwarven Combat Training', 'Stonecunning'],
    effects: [dark(60), resist('poison'), { kind: 'advantage', on: 'saves', when: 'against poison' }],
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
    effects: [dark(60), feyAncestry],
    subraces: [
      { id: 'high-elf', name: 'High Elf', abilityBonuses: { int: 1 }, traits: ['Elf Weapon Training', 'Cantrip', 'Extra Language'], languageChoices: 1 },
    ],
  },
  {
    id: 'halfling', name: 'Halfling', size: 'Small', speed: 25,
    abilityBonuses: { dex: 2 },
    languages: ['Common', 'Halfling'],
    traits: ['Lucky', 'Brave', 'Halfling Nimbleness'],
    effects: [{ kind: 'advantage', on: 'saves', when: 'against being frightened' }],
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
    subraceOptional: true,
  },
  {
    id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, cha: 1 },
    languages: ['Common', 'Draconic'],
    traitChoice: {
      id: 'draconicAncestry', name: 'Draconic Ancestry',
      options: [
        { id: 'black', name: 'Black', detail: 'Acid, 5 by 30 ft. line (DEX save)', effects: [{ ...resist('acid'), trait: 'Damage Resistance' }] },
        { id: 'blue', name: 'Blue', detail: 'Lightning, 5 by 30 ft. line (DEX save)', effects: [{ ...resist('lightning'), trait: 'Damage Resistance' }] },
        { id: 'brass', name: 'Brass', detail: 'Fire, 5 by 30 ft. line (DEX save)', effects: [{ ...resist('fire'), trait: 'Damage Resistance' }] },
        { id: 'bronze', name: 'Bronze', detail: 'Lightning, 5 by 30 ft. line (DEX save)', effects: [{ ...resist('lightning'), trait: 'Damage Resistance' }] },
        { id: 'copper', name: 'Copper', detail: 'Acid, 5 by 30 ft. line (DEX save)', effects: [{ ...resist('acid'), trait: 'Damage Resistance' }] },
        { id: 'gold', name: 'Gold', detail: 'Fire, 15 ft. cone (DEX save)', effects: [{ ...resist('fire'), trait: 'Damage Resistance' }] },
        { id: 'green', name: 'Green', detail: 'Poison, 15 ft. cone (CON save)', effects: [{ ...resist('poison'), trait: 'Damage Resistance' }] },
        { id: 'red', name: 'Red', detail: 'Fire, 15 ft. cone (DEX save)', effects: [{ ...resist('fire'), trait: 'Damage Resistance' }] },
        { id: 'silver', name: 'Silver', detail: 'Cold, 15 ft. cone (CON save)', effects: [{ ...resist('cold'), trait: 'Damage Resistance' }] },
        { id: 'white', name: 'White', detail: 'Cold, 15 ft. cone (CON save)', effects: [{ ...resist('cold'), trait: 'Damage Resistance' }] },
      ],
    },
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'],
    uses: [{ trait: 'Breath Weapon', count: 1, recharge: 'short' }],
    subraceOptional: true,
  },
  {
    id: 'gnome', name: 'Gnome', size: 'Small', speed: 25,
    abilityBonuses: { int: 2 },
    languages: ['Common', 'Gnomish'],
    traits: ['Darkvision', 'Gnome Cunning'],
    effects: [dark(60), ...(['int', 'wis', 'cha'] as const).map(a => ({ kind: 'advantage' as const, on: `save:${a}` as const, when: 'against magic' }))],
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
    effects: [dark(60), feyAncestry],
    subraceOptional: true,
  },
  {
    id: 'half-orc', name: 'Half-Orc', size: 'Medium', speed: 30,
    abilityBonuses: { str: 2, con: 1 },
    skillProficiencies: ['intimidation'],
    languages: ['Common', 'Orc'],
    traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks'],
    effects: [dark(60)],
    uses: [{ trait: 'Relentless Endurance', count: 1, recharge: 'long' }],
  },
  {
    id: 'tiefling', name: 'Tiefling', size: 'Medium', speed: 30,
    abilityBonuses: { int: 1, cha: 2 },
    languages: ['Common', 'Infernal'],
    traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'],
    effects: [dark(60), resist('fire'), ...[spell('Thaumaturgy'), spell('Hellish Rebuke (as 2nd level)', 3), spell('Darkness', 5)].map(e => ({ ...e, trait: 'Infernal Legacy' }))],
    subraceOptional: true,
  },
]

// Official races from other books (names and mechanics only; our own text lives in i18n explain files).
// Each book group keeps its own file under books/; subraces with parentRaceId attach to that race.
export const BOOK_RACES: Record<RulesEdition, Race[]> = { '2014': [...BOOK_RACES_2014, ...MOTM_RACES, ...LEGACY_RACES, ...SETTING_RACES], '2024': [...BOOK_SPECIES_2024] }
export const BOOK_SUBRACES: Record<RulesEdition, Subrace[]> = { '2014': [...BOOK_SUBRACES_2014, ...SETTING_SUBRACES], '2024': [] }

/**
 * Attach subraces to their race (by parentRaceId); unknown parents are dropped. A race that had no subraces
 * stays playable without one (Human with dragonmarks).
 */
const attach = (list: Race[], subraces: Subrace[]): Race[] =>
  list.map(r => {
    const extra = subraces.filter(s => s.parentRaceId === r.id)
    if (!extra.length) return r
    return { ...r, subraces: [...(r.subraces ?? []), ...extra], ...(r.subraces?.length ? {} : { subraceOptional: true }) }
  })

/** SRD then book races of an edition, book subraces attached; 2024 then offers the legacy races. */
const official = (edition: RulesEdition): Race[] =>
  edition === '2014'
    ? attach([...RACES, ...BOOK_RACES['2014']], BOOK_SUBRACES['2014'])
    : [...attach([...SPECIES, ...BOOK_RACES['2024']], BOOK_SUBRACES['2024']), ...legacyRaces()]

/**
 * 2014 races (SRD and books) that have no 2024 version, playable under 2024 rules as the 2024 Player's Handbook
 * allows: they keep their traits, but their ability bonuses come from the background instead.
 */
export function legacyRaces(): Race[] {
  const ids = new Set([...SPECIES, ...BOOK_RACES['2024']].map(r => r.id))
  return official('2014').filter(r => !ids.has(r.id)).map(r => ({
    ...r, legacy: true, abilityBonuses: {}, flexibleAbilityBonuses: undefined, freeAbilityBonuses: undefined,
    subraces: r.subraces?.map(s => ({ ...s, abilityBonuses: {}, freeAbilityBonuses: undefined, replacesBonuses: undefined })),
  }))
}

// Homebrew races and subraces registered at runtime (ids namespaced `hb:<packId>:<slug>`).
// Homebrew is offered with both editions unless it sets `edition` (listing only; raceById still finds it); homebrew subraces attach to the edition's race of that id.
let merged: Record<RulesEdition, Race[]> = { '2014': official('2014'), '2024': official('2024') }

/** Replace the registered homebrew races. Subraces (parentRaceId set) attach to their race; official ids always win. */
export function registerHomebrewRaces(races: Race[], subraces: Subrace[]): void {
  const build = (edition: RulesEdition) => {
    const list = official(edition)
    const taken = new Set([...official('2014'), ...official('2024')].map(r => r.id))
    return attach([...list, ...races.filter(r => !taken.has(r.id))], subraces)
  }
  merged = { '2014': build('2014'), '2024': build('2024') }
}

/** SRD and book races (2024: species, then legacy 2014 races) followed by homebrew ones, with subraces attached. */
export const allRaces = (edition: RulesEdition = '2014'): Race[] => merged[edition].filter(r => !r.edition || r.edition === edition)

export const raceById = (id: string, edition: RulesEdition = '2014') => merged[edition].find(r => r.id === id)

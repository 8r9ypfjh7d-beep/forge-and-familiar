import type { Ability, ItemEffect, Race, RaceEffect, Subrace } from '../../types'

// 2014 subraces and race variants from the official books outside the SRD (PHB, SCAG, MToF, EGtW, Fizban's,
// Spelljammer). Names and mechanics only; the text players read is our own summary in explain.races2014.*.ts.

const PHB = "Player's Handbook"
const SCAG = "Sword Coast Adventurer's Guide"
const MTOF = "Mordenkainen's Tome of Foes"
const EGTW = "Explorer's Guide to Wildemount"
const DMG = "Dungeon Master's Guide"
const FTOD = "Fizban's Treasury of Dragons"
const SJ = 'Spelljammer: Astral Adventurer\'s Guide'

/** An innate spell, from `level` on (cantrips at 1). */
export const spell = (name: string, level = 1, note = level > 1 ? 'once per long rest' : 'at will'): RaceEffect =>
  ({ kind: 'spell', spell: name, note, ...(level > 1 ? { level } : {}) })
export const dark = (value: number): ItemEffect => ({ kind: 'sense', sense: 'darkvision', value })
export const resist = (damage: string): ItemEffect => ({ kind: 'resistance', damage })

type Sub = Subrace & { parentRaceId: string }

const dwarf: Sub[] = [
  { id: 'mountain-dwarf', parentRaceId: 'dwarf', source: PHB, name: 'Mountain Dwarf', abilityBonuses: { str: 2 }, traits: ['Dwarven Armor Training'], armor: ['light', 'medium'] },
  {
    id: 'duergar', parentRaceId: 'dwarf', source: SCAG, name: 'Duergar', abilityBonuses: { str: 1 }, languages: ['Undercommon'],
    removesTraits: ['Darkvision'],
    traits: ['Superior Darkvision', 'Duergar Resilience', 'Duergar Magic', 'Sunlight Sensitivity'],
    effects: [dark(120), { kind: 'advantage', on: 'saves', when: 'against illusions, being charmed or paralyzed' }, spell('Enlarge/Reduce (enlarge, self)', 3), spell('Invisibility (self)', 5)],
  },
]

const elf: Sub[] = [
  {
    id: 'wood-elf', parentRaceId: 'elf', source: PHB, name: 'Wood Elf', abilityBonuses: { wis: 1 }, speed: 35,
    traits: ['Elf Weapon Training', 'Fleet of Foot', 'Mask of the Wild'], weaponIds: ['longsword', 'shortsword', 'shortbow', 'longbow'],
  },
  {
    id: 'drow', parentRaceId: 'elf', source: PHB, name: 'Drow (Dark Elf)', abilityBonuses: { cha: 1 },
    removesTraits: ['Darkvision'],
    traits: ['Superior Darkvision', 'Sunlight Sensitivity', 'Drow Magic', 'Drow Weapon Training'], weaponIds: ['rapier', 'shortsword', 'hand-crossbow'],
    effects: [dark(120), spell('Dancing Lights'), spell('Faerie Fire', 3), spell('Darkness', 5)],
  },
  {
    id: 'eladrin', parentRaceId: 'elf', source: MTOF, name: 'Eladrin', abilityBonuses: { cha: 1 },
    traits: ['Fey Step', 'Shifting Seasons'], uses: [{ trait: 'Fey Step', count: 1, recharge: 'short' }],
  },
  {
    id: 'eladrin-dmg', parentRaceId: 'elf', source: DMG, name: 'Eladrin (DMG)', abilityBonuses: { int: 1 },
    traits: ['Elf Weapon Training', 'Fey Step (Misty Step)'], weaponIds: ['longsword', 'shortsword', 'shortbow', 'longbow'],
    uses: [{ trait: 'Fey Step (Misty Step)', count: 1, recharge: 'short' }],
  },
  {
    id: 'sea-elf', parentRaceId: 'elf', source: MTOF, name: 'Sea Elf', abilityBonuses: { con: 1 }, languages: ['Aquan'],
    traits: ['Sea Elf Training', 'Child of the Sea', 'Friend of the Sea'], weaponIds: ['spear', 'trident', 'light-crossbow', 'net'],
    effects: [{ kind: 'moveSpeed', mode: 'swim', value: 30 }],
  },
  {
    id: 'shadar-kai', parentRaceId: 'elf', source: MTOF, name: 'Shadar-kai', abilityBonuses: { con: 1 },
    traits: ['Necrotic Resistance', 'Blessing of the Raven Queen'], effects: [resist('necrotic')],
    uses: [{ trait: 'Blessing of the Raven Queen', count: 1, recharge: 'long' }],
  },
  {
    id: 'pallid-elf', parentRaceId: 'elf', source: EGTW, name: 'Pallid Elf', abilityBonuses: { wis: 1 },
    traits: ['Incisive Sense', 'Blessing of the Moon Weaver'],
    effects: [
      { kind: 'advantage', on: 'skill:investigation' }, { kind: 'advantage', on: 'skill:insight' },
      spell('Light'), spell('Sleep', 3), spell('Invisibility (self)', 5),
    ],
  },
]

const halfling: Sub[] = [
  {
    id: 'stout', parentRaceId: 'halfling', source: PHB, name: 'Stout', abilityBonuses: { con: 1 }, traits: ['Stout Resilience'],
    effects: [resist('poison'), { kind: 'advantage', on: 'saves', when: 'against poison' }],
  },
  { id: 'ghostwise', parentRaceId: 'halfling', source: SCAG, name: 'Ghostwise', abilityBonuses: { wis: 1 }, traits: ['Silent Speech'] },
  {
    id: 'lotusden', parentRaceId: 'halfling', source: EGTW, name: 'Lotusden', abilityBonuses: { wis: 1 },
    traits: ['Child of the Wood', 'Timberwalk'], effects: [spell('Druidcraft'), spell('Entangle', 3), spell('Spike Growth', 5)],
  },
]

const gnome: Sub[] = [
  {
    id: 'forest-gnome', parentRaceId: 'gnome', source: PHB, name: 'Forest Gnome', abilityBonuses: { dex: 1 },
    traits: ['Natural Illusionist', 'Speak with Small Beasts'], effects: [spell('Minor Illusion')],
  },
  {
    id: 'deep-gnome', parentRaceId: 'gnome', source: SCAG, name: 'Deep Gnome (Svirfneblin)', abilityBonuses: { dex: 1 }, languages: ['Undercommon'],
    removesTraits: ['Darkvision'],
    traits: ['Superior Darkvision', 'Stone Camouflage'], effects: [dark(120), { kind: 'advantage', on: 'skill:stealth', when: 'to hide in rocky terrain' }],
  },
]

const human: Sub[] = [
  {
    id: 'variant-human', parentRaceId: 'human', source: PHB, name: 'Variant Human', abilityBonuses: {},
    replacesBonuses: true, freeAbilityBonuses: { count: 2, exclude: [] }, freeSkillChoices: 1, featChoice: true,
    traits: ['Extra Skill', 'Bonus Feat'],
  },
]

// SCAG half-elf variants: each swaps Skill Versatility for an elven trait.
const halfElfVariant = (id: string, name: string, traits: string[], extra: Partial<Subrace> = {}): Sub => ({
  id: `half-elf-${id}`, parentRaceId: 'half-elf', source: SCAG, name, abilityBonuses: {},
  removesTraits: ['Skill Versatility'], freeSkillChoices: 0, traits, ...extra,
})
const ELF_WEAPONS = ['longsword', 'shortsword', 'shortbow', 'longbow']
const halfElf: Sub[] = [
  halfElfVariant('high-weapons', 'High Elf Descent: Weapon Training', ['Elf Weapon Training'], { weaponIds: ELF_WEAPONS }),
  halfElfVariant('high-cantrip', 'High Elf Descent: Cantrip', ['Cantrip']),
  halfElfVariant('wood-weapons', 'Wood Elf Descent: Weapon Training', ['Elf Weapon Training'], { weaponIds: ELF_WEAPONS }),
  halfElfVariant('wood-fleet', 'Wood Elf Descent: Fleet of Foot', ['Fleet of Foot'], { speed: 35 }),
  halfElfVariant('wood-mask', 'Wood Elf Descent: Mask of the Wild', ['Mask of the Wild']),
  halfElfVariant('drow-magic', 'Drow Descent: Drow Magic', ['Drow Magic'], { effects: [spell('Dancing Lights'), spell('Faerie Fire', 3), spell('Darkness', 5)] }),
  halfElfVariant('aquatic', 'Aquatic Elf Descent: Swim Speed', ['Swim Speed'], { effects: [{ kind: 'moveSpeed', mode: 'swim', value: 30 }] }),
]

// MToF tiefling bloodlines: +2 CHA and a different +1, and their own legacy spells instead of Infernal Legacy.
const bloodline = (id: string, name: string, plus: Ability, spells: [string, string, string]): Sub => ({
  id: `tiefling-${id}`, parentRaceId: 'tiefling', source: MTOF, name, abilityBonuses: { cha: 2, [plus]: 1 },
  replacesBonuses: true, removesTraits: ['Infernal Legacy'], traits: [`Legacy of ${name}`],
  effects: [spell(spells[0]), spell(`${spells[1]} (as 2nd level)`, 3), spell(spells[2], 5)],
})
const INFERNAL = [spell('Thaumaturgy'), spell('Hellish Rebuke (as 2nd level)', 3), spell('Darkness', 5)]
// SCAG variants: Feral swaps the ability scores; Devil's Tongue, Hellfire and Winged swap Infernal Legacy.
const scagLegacies: [string, string, Partial<Subrace>][] = [
  ['devils-tongue', "Devil's Tongue", { effects: [spell('Vicious Mockery'), spell('Charm Person (as 2nd level)', 3), spell('Enthrall', 5)] }],
  ['hellfire', 'Hellfire', { effects: [spell('Thaumaturgy'), spell('Burning Hands (as 2nd level)', 3), spell('Darkness', 5)] }],
  ['winged', 'Winged', { effects: [{ kind: 'moveSpeed', mode: 'fly', value: 30 }] }],
]
const tiefling: Sub[] = [
  bloodline('asmodeus', 'Asmodeus', 'int', ['Thaumaturgy', 'Hellish Rebuke', 'Darkness']),
  bloodline('baalzebul', 'Baalzebul', 'int', ['Thaumaturgy', 'Ray of Sickness', 'Crown of Madness']),
  bloodline('dispater', 'Dispater', 'dex', ['Thaumaturgy', 'Disguise Self', 'Detect Thoughts']),
  bloodline('fierna', 'Fierna', 'wis', ['Friends', 'Charm Person', 'Suggestion']),
  bloodline('glasya', 'Glasya', 'dex', ['Minor Illusion', 'Disguise Self', 'Invisibility']),
  bloodline('levistus', 'Levistus', 'con', ['Ray of Frost', 'Armor of Agathys', 'Darkness']),
  bloodline('mammon', 'Mammon', 'int', ['Mage Hand', "Tenser's Floating Disk", 'Arcane Lock']),
  bloodline('mephistopheles', 'Mephistopheles', 'int', ['Mage Hand', 'Burning Hands', 'Flame Blade']),
  bloodline('zariel', 'Zariel', 'str', ['Thaumaturgy', 'Searing Smite', 'Branding Smite']),
  { id: 'tiefling-feral', parentRaceId: 'tiefling', source: SCAG, name: 'Feral', abilityBonuses: { dex: 2, int: 1 }, replacesBonuses: true, traits: ['Feral'], effects: INFERNAL },
  ...scagLegacies.flatMap(([id, name, extra]): Sub[] => [
    { id: `tiefling-${id}`, parentRaceId: 'tiefling', source: SCAG, name, abilityBonuses: {}, removesTraits: ['Infernal Legacy'], traits: [name], ...extra },
    {
      id: `tiefling-feral-${id}`, parentRaceId: 'tiefling', source: SCAG, name: `Feral + ${name}`, abilityBonuses: { dex: 2, int: 1 },
      replacesBonuses: true, removesTraits: ['Infernal Legacy'], traits: ['Feral', name], ...extra,
    },
  ]),
]

// Wildemount dragonborn: new ability scores and a new trait instead of Damage Resistance.
const dragonborn: Sub[] = [
  {
    id: 'draconblood', parentRaceId: 'dragonborn', source: EGTW, name: 'Draconblood', abilityBonuses: { int: 2, cha: 1 }, replacesBonuses: true,
    removesTraits: ['Damage Resistance'], traits: ['Darkvision', 'Forceful Presence'], effects: [dark(60)],
    uses: [{ trait: 'Forceful Presence', count: 1, recharge: 'short' }],
  },
  {
    id: 'ravenite', parentRaceId: 'dragonborn', source: EGTW, name: 'Ravenite', abilityBonuses: { str: 2, con: 1 }, replacesBonuses: true,
    removesTraits: ['Damage Resistance'], traits: ['Darkvision', 'Vengeful Assault'], effects: [dark(60)],
    uses: [{ trait: 'Vengeful Assault', count: 1, recharge: 'short' }],
  },
]

export const BOOK_SUBRACES_2014: Sub[] = [...dwarf, ...elf, ...halfling, ...gnome, ...human, ...halfElf, ...tiefling, ...dragonborn]

// Fizban's dragonborn: flexible +2/+1 (or +1/+1/+1), a breath weapon that replaces an attack, and a 5th level power.
const option = (id: string, name: string, damage: string, detail: string) => ({ id, name, detail: `${damage} damage, ${detail}`, effects: [resist(damage.toLowerCase())] })
const fizban = (id: string, name: string, traits: string[], options: ReturnType<typeof option>[], extra: Partial<Race> = {}): Race => ({
  id, name, source: FTOD, size: 'Medium', speed: 30, abilityBonuses: {}, flexibleAbilityBonuses: true,
  languages: ['Common'], languageChoices: 1,
  traitChoice: { id: 'draconicAncestry', name: traits[0], options },
  traits: [...traits, 'Breath Weapon (Fizban)'],
  uses: [{ trait: 'Breath Weapon (Fizban)', count: 'pb', recharge: 'long' }],
  ...extra,
})
const LINE = '5 by 30 ft. line (DEX save)'
const CONE = '15 ft. cone (DEX save)'

export const BOOK_RACES_2014: Race[] = [
  fizban('chromatic-dragonborn', 'Chromatic Dragonborn', ['Chromatic Ancestry', 'Chromatic Warding'], [
    option('black', 'Black', 'Acid', LINE), option('blue', 'Blue', 'Lightning', LINE), option('green', 'Green', 'Poison', LINE),
    option('red', 'Red', 'Fire', LINE), option('white', 'White', 'Cold', LINE),
  ]),
  fizban('metallic-dragonborn', 'Metallic Dragonborn', ['Metallic Ancestry', 'Metallic Breath Weapon'], [
    option('brass', 'Brass', 'Fire', CONE), option('bronze', 'Bronze', 'Lightning', CONE), option('copper', 'Copper', 'Acid', CONE),
    option('gold', 'Gold', 'Fire', CONE), option('silver', 'Silver', 'Cold', CONE),
  ]),
  fizban('gem-dragonborn', 'Gem Dragonborn', ['Gem Ancestry', 'Psionic Mind', 'Gem Flight'], [
    option('amethyst', 'Amethyst', 'Force', CONE), option('crystal', 'Crystal', 'Radiant', CONE), option('emerald', 'Emerald', 'Psychic', CONE),
    option('sapphire', 'Sapphire', 'Thunder', CONE), option('topaz', 'Topaz', 'Necrotic', CONE),
  ]),
  {
    id: 'astral-elf', name: 'Astral Elf', source: SJ, size: 'Medium', speed: 30, abilityBonuses: {}, flexibleAbilityBonuses: true,
    languages: ['Common'], languageChoices: 1, freeSkillChoices: 1,
    traits: ['Astral Fire', 'Darkvision', 'Fey Ancestry', 'Keen Senses (Insight, Perception or Survival)', 'Starlight Step', 'Astral Trance'],
    effects: [dark(60), { kind: 'advantage', on: 'saves', when: 'against being charmed' }],
    uses: [{ trait: 'Starlight Step', count: 'pb', recharge: 'long' }],
  },
]

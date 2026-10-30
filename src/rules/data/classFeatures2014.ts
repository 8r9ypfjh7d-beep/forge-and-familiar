import type { ClassFeature, ItemEffect } from '../types'

// SRD 5.1 class features, levels 1 to 20, for the 2014 classes in classes.ts.
// Names match the content library where they can (so the sheet finds the SRD text); one entry per feature,
// with `detail` steps for what grows with level instead of a second "Brutal Critical (2 dice)" line.
const f = (level: number, name: string, extra: Omit<ClassFeature, 'level' | 'name'> = {}): ClassFeature => ({ level, name, ...extra })
const steps = (...xs: [number, string][]) => ({ detail: xs })
const fx = (...effects: ItemEffect[]) => ({ effects })

const SNEAK = Array.from({ length: 10 }, (_, i): [number, string] => [i * 2 + 1, `${i + 1}d6`])
export const ALL_SAVES: ItemEffect[] = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ability => ({ kind: 'saveProficiency', ability }))
export const DANGER_SENSE: ItemEffect = { kind: 'advantage', on: 'save:dex', when: 'against effects you can see (not blinded, deafened or incapacitated)' }

export const FEATURES_2014: Record<string, ClassFeature[]> = {
  barbarian: [
    f(1, 'Rage', steps([1, '+2'], [9, '+3'], [16, '+4'])), f(1, 'Unarmored Defense'),
    f(2, 'Reckless Attack'), f(2, 'Danger Sense', fx(DANGER_SENSE)),
    f(5, 'Extra Attack'), f(5, 'Fast Movement'),
    f(7, 'Feral Instinct', fx({ kind: 'advantage', on: 'initiative' })),
    f(9, 'Brutal Critical', steps([9, '+1 die'], [13, '+2 dice'], [17, '+3 dice'])),
    f(11, 'Relentless Rage'), f(15, 'Persistent Rage'), f(18, 'Indomitable Might'),
    f(20, 'Primal Champion', fx({ kind: 'ability', ability: 'str', value: 4, max: 24 }, { kind: 'ability', ability: 'con', value: 4, max: 24 })),
  ],
  bard: [
    f(1, 'Spellcasting'), f(1, 'Bardic Inspiration', steps([1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12'])),
    f(2, 'Jack of All Trades'), f(2, 'Song of Rest', steps([2, 'd6'], [9, 'd8'], [13, 'd10'], [17, 'd12'])),
    f(3, 'Expertise', steps([3, '2 skills'], [10, '4 skills'])),
    f(5, 'Font of Inspiration'), f(6, 'Countercharm'),
    f(10, 'Magical Secrets', steps([10, '2 spells'], [14, '4 spells'], [18, '6 spells'])),
    f(20, 'Superior Inspiration'),
  ],
  cleric: [
    f(1, 'Spellcasting'), f(1, 'Divine Domain'),
    f(2, 'Channel Divinity', steps([2, '1/rest'], [6, '2/rest'], [18, '3/rest'])), f(2, 'Turn Undead'),
    f(5, 'Destroy Undead', steps([5, 'CR 1/2'], [8, 'CR 1'], [11, 'CR 2'], [14, 'CR 3'], [17, 'CR 4'])),
    f(10, 'Divine Intervention'), f(20, 'Divine Intervention Improvement'),
  ],
  druid: [
    f(1, 'Druidic'), f(1, 'Spellcasting'),
    f(2, 'Wild Shape', steps([2, 'CR 1/4, no flying or swimming'], [4, 'CR 1/2, no flying'], [8, 'CR 1'])), f(2, 'Druid Circle'),
    f(18, 'Timeless Body'), f(18, 'Beast Spells'), f(20, 'Archdruid'),
  ],
  fighter: [
    f(1, 'Fighting Style'), f(1, 'Second Wind'),
    f(2, 'Action Surge', steps([2, '1 use'], [17, '2 uses'])), f(3, 'Martial Archetype'),
    f(5, 'Extra Attack', steps([5, '2 attacks'], [11, '3 attacks'], [20, '4 attacks'])),
    f(9, 'Indomitable', steps([9, '1 use'], [13, '2 uses'], [17, '3 uses'])),
  ],
  monk: [
    f(1, 'Unarmored Defense'), f(1, 'Martial Arts', steps([1, '1d4'], [5, '1d6'], [11, '1d8'], [17, '1d10'])),
    f(2, 'Ki'), f(2, 'Unarmored Movement', steps([2, '+10 ft.'], [6, '+15 ft.'], [9, '+15 ft., walls and water'], [10, '+20 ft., walls and water'], [14, '+25 ft., walls and water'], [18, '+30 ft., walls and water'])),
    f(3, 'Deflect Missiles'), f(4, 'Slow Fall'),
    f(5, 'Extra Attack'), f(5, 'Stunning Strike'),
    f(6, 'Ki Empowered Strikes'), f(7, 'Evasion'), f(7, 'Stillness of Mind'),
    f(10, 'Purity of Body', fx({ kind: 'immunity', damage: 'poison' }, { kind: 'conditionImmunity', condition: 'poisoned' })),
    f(13, 'Tongue of the Sun and Moon'), f(14, 'Diamond Soul', fx(...ALL_SAVES)), f(15, 'Timeless Body'),
    f(18, 'Empty Body'), f(20, 'Perfect Self'),
  ],
  paladin: [
    f(1, 'Divine Sense'), f(1, 'Lay on Hands'),
    f(2, 'Fighting Style'), f(2, 'Spellcasting'), f(2, 'Divine Smite'),
    f(3, 'Divine Health'), f(3, 'Sacred Oath'), f(3, 'Channel Divinity'),
    f(5, 'Extra Attack'),
    f(6, 'Aura of Protection', steps([6, '10 ft.'], [18, '30 ft.'])),
    f(10, 'Aura of Courage', { ...steps([10, '10 ft.'], [18, '30 ft.']), ...fx({ kind: 'conditionImmunity', condition: 'frightened' }) }),
    f(11, 'Improved Divine Smite'), f(14, 'Cleansing Touch'), f(18, 'Aura improvements'),
  ],
  ranger: [
    f(1, 'Favored Enemy', steps([1, '1 type'], [6, '2 types'], [14, '3 types'])),
    f(1, 'Natural Explorer', steps([1, '1 terrain'], [6, '2 terrains'], [10, '3 terrains'])),
    f(2, 'Fighting Style'), f(2, 'Spellcasting'),
    f(3, 'Ranger Archetype'), f(3, 'Primeval Awareness'),
    f(5, 'Extra Attack'), f(8, "Land's Stride"), f(10, 'Hide in Plain Sight'), f(14, 'Vanish'),
    f(18, 'Feral Senses'), f(20, 'Foe Slayer'),
  ],
  rogue: [
    f(1, 'Expertise', steps([1, '2 skills'], [6, '4 skills'])), f(1, 'Sneak Attack', steps(...SNEAK)), f(1, "Thieves' Cant"),
    f(2, 'Cunning Action'), f(3, 'Roguish Archetype'), f(5, 'Uncanny Dodge'), f(7, 'Evasion'),
    f(11, 'Reliable Talent'), f(14, 'Blindsense', fx({ kind: 'sense', sense: 'blindsight', value: 10 })),
    f(15, 'Slippery Mind', fx({ kind: 'saveProficiency', ability: 'wis' })), f(18, 'Elusive'), f(20, 'Stroke of Luck'),
  ],
  sorcerer: [
    f(1, 'Spellcasting'), f(1, 'Sorcerous Origin'), f(2, 'Font of Magic'),
    f(3, 'Metamagic', steps([3, '2 options'], [10, '3 options'], [17, '4 options'])),
    f(20, 'Sorcerous Restoration'),
  ],
  warlock: [
    f(1, 'Otherworldly Patron'), f(1, 'Pact Magic'),
    f(2, 'Eldritch Invocations', steps([2, '2 invocations'], [5, '3 invocations'], [7, '4 invocations'], [9, '5 invocations'], [12, '6 invocations'], [15, '7 invocations'], [18, '8 invocations'])),
    f(3, 'Pact Boon'),
    f(11, 'Mystic Arcanum', steps([11, 'level 6'], [13, 'levels 6–7'], [15, 'levels 6–8'], [17, 'levels 6–9'])),
    f(20, 'Eldritch Master'),
  ],
  wizard: [
    f(1, 'Spellcasting'), f(1, 'Arcane Recovery'), f(2, 'Arcane Tradition'),
    f(18, 'Spell Mastery'), f(20, 'Signature Spells'),
  ],
}

/** Paladin Aura of Protection (both editions): the CHA modifier, at least +1, on every save from paladin level 6. */
export const AURA_OF_PROTECTION_LEVEL = 6
/** Paladin Improved Divine Smite (2014) and Radiant Strikes (2024): 1d8 radiant on every melee weapon hit from level 11. */
export const RADIANT_STRIKE_LEVEL = 11

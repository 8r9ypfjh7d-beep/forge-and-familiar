import type { Ability, ClassChoice, ClassDef, ClassFeature, ClassPick, ItemEffect, SkillId } from '../../types'
import { ALL_SAVES, DANGER_SENSE } from '../classFeatures2014'
import { ARTISAN_TOOLS, MUSICAL_INSTRUMENTS } from '../proficiencies'
import { ALL_SKILLS } from '../skills'

// SRD 5.2 (2024) classes. Every subclass comes at level 3; level 19 is an Epic Boon (any feat slot).
// Starting gear: option A is the kit with its coins, option B is coins only.
const scale = (table: [number, number][]) => (level: number) => {
  let v = 0
  for (const [from, value] of table) if (level >= from) v = value
  return v
}
const f = (level: number, ...names: string[]) => names.map(name => ({ level, name }))
/** A feature that changes the sheet (shared with 2014 where the rule is the same). */
const fx = (level: number, name: string, ...effects: ItemEffect[]): ClassFeature => ({ level, name, effects })
const plus4 = (...abilities: Ability[]): ItemEffect[] => abilities.map(ability => ({ kind: 'ability', ability, value: 4, max: 25 }))
const kit = (items: string[], gold: number, onlyGold: number) => [{ options: [{ items, gold }, { items: [], gold: onlyGold }] }]
const ASI = [4, 8, 12, 16, 19]

const STYLES: ClassChoice['options'] = [
  { id: 'archery', name: 'Archery', featId: 'archery', detail: '+2 to attack rolls with ranged weapons.' },
  { id: 'defense', name: 'Defense', featId: 'defense', detail: '+1 AC while wearing armor.' },
  { id: 'great-weapon-fighting', name: 'Great Weapon Fighting', featId: 'great-weapon-fighting', detail: 'Treat 1s and 2s on two-handed damage dice as 3s.' },
  { id: 'two-weapon-fighting', name: 'Two-Weapon Fighting', featId: 'two-weapon-fighting', detail: 'Add your modifier to the extra Light weapon attack.' },
  // Player's Handbook (2024) styles outside the SRD; their feats are in books/feats.ts.
  { id: 'blind-fighting', name: 'Blind Fighting', featId: 'blind-fighting', detail: 'Blindsight 10 ft.' },
  { id: 'dueling', name: 'Dueling', featId: 'dueling', detail: '+2 damage with a one-handed melee weapon and no other weapon.' },
  { id: 'interception', name: 'Interception', featId: 'interception', detail: 'Reaction: reduce damage to a nearby ally.' },
  { id: 'protection', name: 'Protection', featId: 'protection', detail: 'Reaction with a shield: impose disadvantage on an attack against an ally.' },
  { id: 'thrown-weapon-fighting', name: 'Thrown Weapon Fighting', featId: 'thrown-weapon-fighting', detail: '+2 damage with thrown weapons.' },
  { id: 'unarmed-fighting', name: 'Unarmed Fighting', featId: 'unarmed-fighting', detail: 'Unarmed strikes deal 1d6 or 1d8.' },
]
const expertise = (id: string, level: number, count: number, name = 'Expertise', from?: SkillId[]): ClassPick =>
  ({ id, name, level, kind: 'expertise', count, ...(from ? { from } : {}) })
const BARBARIAN_SKILLS: SkillId[] = ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival']
// Level 7 Cleric and Druid picks. Potent Spellcasting adds WIS to the class's cantrip damage (sheet/combat).
const potent = (cls: string) => ({ id: 'potent-spellcasting', name: 'Potent Spellcasting', detail: `Add your WIS modifier to the damage of your ${cls} cantrips.` })

const fightingStyle = (level: number, extra?: ClassChoice['options'][number]): ClassChoice =>
  ({ id: 'fightingStyle', name: 'Fighting Style', level, pool: 'fightingStyle', options: extra ? [...STYLES, extra] : STYLES })

export const CLASSES_2024: ClassDef[] = [
  {
    id: 'barbarian', name: 'Barbarian', hitDie: 12, primary: ['str'], savingThrows: ['str', 'con'],
    skillChoices: { count: 2, from: BARBARIAN_SKILLS },
    armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], caster: 'none', unarmoredDefense: 'con',
    resources: [{ id: 'rage', name: 'Rage', recharge: 'long', max: scale([[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]) }],
    startingEquipment: [], equipmentChoices: kit(['greataxe', 'handaxe', 'handaxe', 'handaxe', 'handaxe', 'explorers-pack'], 15, 75),
    subclassLevel: 3, subclassTitle: 'Barbarian Subclass', asiLevels: ASI, weaponMastery: [[1, 2], [4, 3], [10, 4]],
    picks: [{ id: 'primalKnowledge', name: 'Primal Knowledge', level: 3, kind: 'skill', count: 1, from: BARBARIAN_SKILLS }],
    features: [
      ...f(1, 'Rage', 'Unarmored Defense', 'Weapon Mastery'), fx(2, 'Danger Sense', DANGER_SENSE), ...f(2, 'Reckless Attack'), ...f(3, 'Primal Knowledge'),
      ...f(5, 'Extra Attack', 'Fast Movement'), fx(7, 'Feral Instinct', { kind: 'advantage', on: 'initiative' }), ...f(7, 'Instinctive Pounce'), ...f(9, 'Brutal Strike'), ...f(11, 'Relentless Rage'),
      ...f(13, 'Improved Brutal Strike'), ...f(15, 'Persistent Rage'), ...f(18, 'Indomitable Might'), ...f(19, 'Epic Boon'), fx(20, 'Primal Champion', ...plus4('str', 'con')),
    ],
  },
  {
    id: 'bard', name: 'Bard', hitDie: 8, primary: ['cha'], savingThrows: ['dex', 'cha'],
    skillChoices: { count: 3, from: ALL_SKILLS },
    armor: ['light'], weapons: ['simple'], caster: 'full', spellAbility: 'cha',
    resources: [{ id: 'bardic-inspiration', name: 'Bardic Inspiration', recharge: 'long', shortRestFromLevel: 5, max: (_l, m) => Math.max(1, m.cha) }],
    startingEquipment: [],
    equipmentChoices: [{ options: [{ items: ['leather', 'dagger', 'dagger', 'any:instrument', 'entertainers-pack'], gold: 19 }, { items: [], gold: 90 }] }],
    toolChoices: { count: 3, from: MUSICAL_INSTRUMENTS },
    subclassLevel: 3, subclassTitle: 'Bard Subclass', asiLevels: ASI,
    picks: [expertise('expertise', 2, 2), expertise('expertise9', 9, 2)],
    features: [
      ...f(1, 'Bardic Inspiration', 'Spellcasting'), ...f(2, 'Expertise', 'Jack of All Trades'), ...f(5, 'Font of Inspiration'), ...f(7, 'Countercharm'), ...f(9, 'Expertise'),
      ...f(10, 'Magical Secrets'), ...f(18, 'Superior Inspiration'), ...f(19, 'Epic Boon'), ...f(20, 'Words of Creation'),
    ],
  },
  {
    id: 'cleric', name: 'Cleric', hitDie: 8, primary: ['wis'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    armor: ['light', 'medium', 'shield'], weapons: ['simple'], caster: 'full', spellAbility: 'wis',
    resources: [
      { id: 'channel-divinity', name: 'Channel Divinity', recharge: 'short', max: scale([[2, 2], [6, 3], [18, 4]]) },
      { id: 'divine-intervention', name: 'Divine Intervention', recharge: 'long', max: scale([[10, 1]]) },
    ],
    startingEquipment: [], equipmentChoices: kit(['chain-shirt', 'shield', 'mace', 'holy-symbol', 'priests-pack'], 7, 110),
    subclassLevel: 3, subclassTitle: 'Cleric Subclass', asiLevels: ASI,
    choices: [{
      id: 'divineOrder', name: 'Divine Order', level: 1,
      options: [
        { id: 'protector', name: 'Protector', detail: 'Martial weapons and heavy armor.', armor: ['heavy'], weapons: ['martial'] },
        { id: 'thaumaturge', name: 'Thaumaturge', detail: 'One extra cleric cantrip; add your WIS modifier (min +1) to Arcana and Religion checks.' },
      ],
    }, {
      id: 'blessedStrikes', name: 'Blessed Strikes', level: 7,
      options: [
        { id: 'divine-strike', name: 'Divine Strike', detail: 'Once on each of your turns, a weapon hit deals an extra 1d8 necrotic or radiant damage (2d8 from level 14).' },
        potent('cleric'),
      ],
    }],
    features: [
      ...f(1, 'Divine Order', 'Spellcasting'), ...f(2, 'Channel Divinity'), ...f(5, 'Sear Undead'), ...f(7, 'Blessed Strikes'),
      ...f(10, 'Divine Intervention'), ...f(14, 'Improved Blessed Strikes'), ...f(19, 'Epic Boon'), ...f(20, 'Greater Divine Intervention'),
    ],
  },
  {
    id: 'druid', name: 'Druid', hitDie: 8, primary: ['wis'], savingThrows: ['int', 'wis'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    armor: ['light', 'shield'], weapons: ['simple'], caster: 'full', spellAbility: 'wis',
    alwaysPrepared: [{ level: 1, names: ['Speak with Animals'] }],
    resources: [{ id: 'wild-shape', name: 'Wild Shape', recharge: 'short', max: scale([[2, 2], [6, 3], [17, 4]]) }],
    startingEquipment: [], equipmentChoices: kit(['leather', 'shield', 'sickle', 'quarterstaff', 'explorers-pack', 'herbalism-kit'], 9, 50),
    toolProficiencies: ['Herbalism kit'],
    subclassLevel: 3, subclassTitle: 'Druid Subclass', asiLevels: ASI,
    choices: [{
      id: 'primalOrder', name: 'Primal Order', level: 1,
      options: [
        { id: 'magician', name: 'Magician', detail: 'One extra druid cantrip; add your WIS modifier (min +1) to Arcana and Nature checks.' },
        { id: 'warden', name: 'Warden', detail: 'Martial weapons and medium armor.', armor: ['medium'], weapons: ['martial'] },
      ],
    }, {
      id: 'elementalFury', name: 'Elemental Fury', level: 7,
      options: [
        potent('druid'),
        { id: 'primal-strike', name: 'Primal Strike', detail: 'Once on each of your turns, a weapon or Beast-form hit deals an extra 1d8 cold, fire, lightning or thunder damage (2d8 from level 15).' },
      ],
    }],
    features: [
      ...f(1, 'Druidic', 'Primal Order', 'Spellcasting'), ...f(2, 'Wild Shape', 'Wild Companion'), ...f(5, 'Wild Resurgence'), ...f(7, 'Elemental Fury'),
      ...f(15, 'Improved Elemental Fury'), ...f(18, 'Beast Spells'), ...f(19, 'Epic Boon'), ...f(20, 'Archdruid'),
    ],
  },
  {
    id: 'fighter', name: 'Fighter', hitDie: 10, primary: ['str', 'dex'], savingThrows: ['str', 'con'],
    skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival'] },
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'], caster: 'none',
    resources: [
      { id: 'second-wind', name: 'Second Wind', recharge: 'long', max: scale([[1, 2], [4, 3], [10, 4]]) },
      { id: 'action-surge', name: 'Action Surge', recharge: 'short', max: scale([[2, 1], [17, 2]]) },
      { id: 'indomitable', name: 'Indomitable', recharge: 'long', max: scale([[9, 1], [13, 2], [17, 3]]) },
    ],
    startingEquipment: [],
    equipmentChoices: [{
      options: [
        { items: ['chain-mail', 'greatsword', 'flail', ...Array(8).fill('javelin'), 'dungeoneers-pack'], gold: 4 },
        { items: ['studded-leather', 'scimitar', 'shortsword', 'longbow', 'arrows', 'quiver', 'dungeoneers-pack'], gold: 11 },
        { items: [], gold: 155 },
      ],
    }],
    subclassLevel: 3, subclassTitle: 'Fighter Subclass', asiLevels: [4, 6, 8, 12, 14, 16, 19], weaponMastery: [[1, 3], [4, 4], [10, 5], [16, 6]],
    choices: [fightingStyle(1)],
    features: [
      ...f(1, 'Fighting Style', 'Second Wind', 'Weapon Mastery'), ...f(2, 'Action Surge', 'Tactical Mind'), ...f(5, 'Extra Attack', 'Tactical Shift'),
      ...f(9, 'Indomitable', 'Tactical Master'), ...f(11, 'Two Extra Attacks'), ...f(13, 'Studied Attacks'), ...f(19, 'Epic Boon'), ...f(20, 'Three Extra Attacks'),
    ],
  },
  {
    id: 'monk', name: 'Monk', hitDie: 8, primary: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
    // Simple weapons and Martial weapons with the Light property.
    armor: [], weapons: ['simple'], weaponIds: ['scimitar', 'shortsword', 'hand-crossbow'], caster: 'none', unarmoredDefense: 'wis',
    resources: [{ id: 'focus', name: 'Focus Points', recharge: 'short', max: l => (l >= 2 ? l : 0) }],
    startingEquipment: [], equipmentChoices: kit(['spear', ...Array(5).fill('dagger'), 'explorers-pack'], 11, 50),
    toolChoices: { count: 1, from: [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS] },
    subclassLevel: 3, subclassTitle: 'Monk Subclass', asiLevels: ASI,
    features: [
      ...f(1, 'Martial Arts', 'Unarmored Defense'), ...f(2, "Monk's Focus", 'Unarmored Movement'), { level: 2, name: 'Uncanny Metabolism', uses: { count: 1, recharge: 'long' } }, ...f(3, 'Deflect Attacks'),
      ...f(4, 'Slow Fall'), ...f(5, 'Extra Attack', 'Stunning Strike'), ...f(6, 'Empowered Strikes'), ...f(7, 'Evasion'), ...f(9, 'Acrobatic Movement'),
      ...f(10, 'Heightened Focus', 'Self-Restoration'), ...f(13, 'Deflect Energy'), fx(14, 'Disciplined Survivor', ...ALL_SAVES), ...f(15, 'Perfect Focus'),
      ...f(18, 'Superior Defense'), ...f(19, 'Epic Boon'), fx(20, 'Body and Mind', ...plus4('dex', 'wis')),
    ],
  },
  {
    id: 'paladin', name: 'Paladin', hitDie: 10, primary: ['str', 'cha'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'], caster: 'half', spellAbility: 'cha',
    alwaysPrepared: [{ level: 2, names: ['Divine Smite'] }, { level: 5, names: ['Find Steed'] }],
    resources: [
      { id: 'lay-on-hands', name: 'Lay on Hands (HP pool)', recharge: 'long', max: l => 5 * l },
      { id: 'channel-divinity', name: 'Channel Divinity', recharge: 'short', max: scale([[3, 2], [11, 3]]) },
    ],
    startingEquipment: [], equipmentChoices: kit(['chain-mail', 'shield', 'longsword', ...Array(6).fill('javelin'), 'holy-symbol', 'priests-pack'], 9, 150),
    subclassLevel: 3, subclassTitle: 'Paladin Subclass', asiLevels: ASI, weaponMastery: [[1, 2]],
    choices: [fightingStyle(2, { id: 'blessed-warrior', name: 'Blessed Warrior', detail: 'Two cleric cantrips that count as paladin spells.' })],
    features: [
      ...f(1, 'Lay On Hands', 'Spellcasting', 'Weapon Mastery'), ...f(2, 'Fighting Style', "Paladin's Smite"), ...f(3, 'Channel Divinity'),
      ...f(5, 'Extra Attack', 'Faithful Steed'), ...f(6, 'Aura of Protection'), ...f(9, 'Abjure Foes'), fx(10, 'Aura of Courage', { kind: 'conditionImmunity', condition: 'frightened' }),
      ...f(11, 'Radiant Strikes'), ...f(14, 'Restoring Touch'), ...f(18, 'Aura Expansion'), ...f(19, 'Epic Boon'),
    ],
  },
  {
    id: 'ranger', name: 'Ranger', hitDie: 10, primary: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
    armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], caster: 'half', spellAbility: 'wis',
    alwaysPrepared: [{ level: 1, names: ["Hunter's Mark"] }],
    resources: [{ id: 'favored-enemy', name: "Favored Enemy (free Hunter's Mark)", recharge: 'long', max: scale([[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]]) }],
    startingEquipment: [], equipmentChoices: kit(['studded-leather', 'scimitar', 'shortsword', 'longbow', 'arrows', 'quiver', 'druidic-focus', 'explorers-pack'], 7, 150),
    subclassLevel: 3, subclassTitle: 'Ranger Subclass', asiLevels: ASI, weaponMastery: [[1, 2]],
    picks: [expertise('deftExplorer', 2, 1, 'Deft Explorer'), { id: 'deftExplorerLanguages', name: 'Deft Explorer', level: 2, kind: 'language', count: 2 }, expertise('expertise9', 9, 2)],
    choices: [fightingStyle(2, { id: 'druidic-warrior', name: 'Druidic Warrior', detail: 'Two druid cantrips that count as ranger spells.' })],
    features: [
      ...f(1, 'Favored Enemy', 'Spellcasting', 'Weapon Mastery'), ...f(2, 'Deft Explorer', 'Fighting Style'), ...f(5, 'Extra Attack'), ...f(6, 'Roving'),
      ...f(9, 'Expertise'), ...f(10, 'Tireless'), ...f(13, 'Relentless Hunter'), ...f(14, "Nature's Veil"), ...f(17, 'Precise Hunter'),
      fx(18, 'Feral Senses', { kind: 'sense', sense: 'blindsight', value: 30 }), ...f(19, 'Epic Boon'), ...f(20, 'Foe Slayer'),
    ],
  },
  {
    id: 'rogue', name: 'Rogue', hitDie: 8, primary: ['dex'], savingThrows: ['dex', 'int'],
    skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
    // Simple weapons and Martial weapons with the Finesse or Light property.
    armor: ['light'], weapons: ['simple'], weaponIds: ['rapier', 'scimitar', 'shortsword', 'whip', 'hand-crossbow'], caster: 'none',
    resources: [{ id: 'stroke-of-luck', name: 'Stroke of Luck', recharge: 'short', max: scale([[20, 1]]) }],
    startingEquipment: [], equipmentChoices: kit(['leather', 'dagger', 'dagger', 'shortsword', 'shortbow', 'arrows', 'quiver', 'thieves-tools', 'burglars-pack'], 8, 100),
    toolProficiencies: ["Thieves' tools"],
    subclassLevel: 3, subclassTitle: 'Rogue Subclass', asiLevels: [4, 8, 10, 12, 16, 19], weaponMastery: [[1, 2]],
    // 2024 Expertise is for skills; thieves' tools is still offered, with a warning.
    picks: [...[expertise('expertise', 1, 2), expertise('expertise6', 6, 2)].map(p => ({ ...p, tools: ["Thieves' tools"], toolsOffList: true })), { id: 'thievesCant', name: "Thieves' Cant", level: 1, kind: 'language', count: 1 }],
    features: [
      ...f(1, 'Expertise', 'Sneak Attack', "Thieves' Cant", 'Weapon Mastery'), ...f(2, 'Cunning Action'), ...f(3, 'Steady Aim'),
      ...f(5, 'Cunning Strike', 'Uncanny Dodge'), ...f(6, 'Expertise'), ...f(7, 'Evasion', 'Reliable Talent'), ...f(11, 'Improved Cunning Strike'), ...f(14, 'Devious Strikes'),
      fx(15, 'Slippery Mind', { kind: 'saveProficiency', ability: 'wis' }, { kind: 'saveProficiency', ability: 'cha' }), ...f(18, 'Elusive'), ...f(19, 'Epic Boon'), ...f(20, 'Stroke of Luck'),
    ],
  },
  {
    id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primary: ['cha'], savingThrows: ['con', 'cha'],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
    armor: [], weapons: ['simple'], caster: 'full', spellAbility: 'cha',
    resources: [
      { id: 'sorcery-points', name: 'Sorcery Points', recharge: 'long', max: l => (l >= 2 ? l : 0) },
      { id: 'innate-sorcery', name: 'Innate Sorcery', recharge: 'long', max: () => 2 },
    ],
    startingEquipment: [], equipmentChoices: kit(['spear', 'dagger', 'dagger', 'arcane-focus', 'dungeoneers-pack'], 28, 50),
    subclassLevel: 3, subclassTitle: 'Sorcerer Subclass', asiLevels: ASI,
    features: [
      ...f(1, 'Innate Sorcery', 'Spellcasting'), ...f(2, 'Font of Magic', 'Metamagic'), ...f(5, 'Sorcerous Restoration'), ...f(7, 'Sorcery Incarnate'),
      ...f(19, 'Epic Boon'), ...f(20, 'Arcane Apotheosis'),
    ],
  },
  {
    id: 'warlock', name: 'Warlock', hitDie: 8, primary: ['cha'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
    armor: ['light'], weapons: ['simple'], caster: 'pact', spellAbility: 'cha',
    resources: [
      { id: 'magical-cunning', name: 'Magical Cunning', recharge: 'long', max: scale([[2, 1]]) },
      { id: 'contact-patron', name: 'Contact Patron', recharge: 'long', max: scale([[9, 1]]) },
    ],
    startingEquipment: [], equipmentChoices: kit(['leather', 'sickle', 'dagger', 'dagger', 'arcane-focus', 'book', 'scholars-pack'], 15, 100),
    subclassLevel: 3, subclassTitle: 'Warlock Subclass', asiLevels: ASI,
    features: [
      ...f(1, 'Eldritch Invocations', 'Pact Magic'), ...f(2, 'Magical Cunning'), ...f(9, 'Contact Patron'), ...f(11, 'Mystic Arcanum'),
      ...f(19, 'Epic Boon'), ...f(20, 'Eldritch Master'),
    ],
  },
  {
    id: 'wizard', name: 'Wizard', hitDie: 6, primary: ['int'], savingThrows: ['int', 'wis'],
    skillChoices: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'] },
    armor: [], weapons: ['simple'], caster: 'full', spellAbility: 'int',
    resources: [{ id: 'arcane-recovery', name: 'Arcane Recovery', recharge: 'long', max: () => 1 }],
    startingEquipment: [], equipmentChoices: kit(['dagger', 'dagger', 'quarterstaff', 'robe', 'spellbook', 'scholars-pack'], 5, 55),
    subclassLevel: 3, subclassTitle: 'Wizard Subclass', asiLevels: ASI,
    picks: [expertise('scholar', 2, 1, 'Scholar', ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'])],
    features: [
      ...f(1, 'Arcane Recovery', 'Ritual Adept', 'Spellcasting'), ...f(2, 'Scholar'), ...f(5, 'Memorize Spell'), ...f(18, 'Spell Mastery'),
      ...f(19, 'Epic Boon'), ...f(20, 'Signature Spells'),
    ],
  },
]

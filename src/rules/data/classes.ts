import type { ClassDef } from '../types'
import { ALL_SKILLS } from './skills'

// SRD 5.1 classes (base class only; subclasses come later).
const scale = (table: [number, number][]) => (level: number) => {
  let v = 0
  for (const [from, value] of table) if (level >= from) v = value
  return v
}

export const CLASSES: ClassDef[] = [
  {
    id: 'barbarian', name: 'Barbarian', hitDie: 12, primary: ['str'], savingThrows: ['str', 'con'],
    skillChoices: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
    armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], caster: 'none', unarmoredDefense: 'con',
    resources: [
      { id: 'rage', name: 'Rage', recharge: 'long', max: scale([[1, 2], [3, 3], [6, 4], [12, 5], [17, 6], [20, 99]]) },
    ],
    startingEquipment: ['greataxe', 'handaxe', 'handaxe', 'javelin', 'javelin', 'javelin', 'javelin', 'backpack', 'bedroll', 'rations', 'waterskin'],
    features: [{ level: 1, name: 'Rage' }, { level: 1, name: 'Unarmored Defense' }, { level: 2, name: 'Reckless Attack' }, { level: 2, name: 'Danger Sense' }, { level: 5, name: 'Extra Attack' }, { level: 5, name: 'Fast Movement' }],
  },
  {
    id: 'bard', name: 'Bard', hitDie: 8, primary: ['cha'], savingThrows: ['dex', 'cha'],
    skillChoices: { count: 3, from: ALL_SKILLS },
    armor: ['light'], weapons: ['simple'], weaponIds: ['hand-crossbow', 'longsword', 'rapier', 'shortsword'],
    caster: 'full', spellAbility: 'cha',
    resources: [
      { id: 'bardic-inspiration', name: 'Bardic Inspiration', recharge: 'long', shortRestFromLevel: 5, max: (_l, m) => Math.max(1, m.cha) },
    ],
    startingEquipment: ['rapier', 'lute', 'leather', 'dagger', 'backpack', 'bedroll'],
    features: [{ level: 1, name: 'Spellcasting' }, { level: 1, name: 'Bardic Inspiration' }, { level: 2, name: 'Jack of All Trades' }, { level: 2, name: 'Song of Rest' }, { level: 3, name: 'Expertise' }, { level: 5, name: 'Font of Inspiration' }],
  },
  {
    id: 'cleric', name: 'Cleric', hitDie: 8, primary: ['wis'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    armor: ['light', 'medium', 'shield'], weapons: ['simple'], caster: 'full', spellAbility: 'wis',
    resources: [
      { id: 'channel-divinity', name: 'Channel Divinity', recharge: 'short', max: scale([[2, 1], [6, 2], [18, 3]]) },
    ],
    startingEquipment: ['mace', 'scale-mail', 'light-crossbow', 'bolts', 'shield', 'holy-symbol', 'backpack'],
    features: [{ level: 1, name: 'Spellcasting' }, { level: 1, name: 'Divine Domain' }, { level: 2, name: 'Channel Divinity' }, { level: 5, name: 'Destroy Undead' }],
  },
  {
    id: 'druid', name: 'Druid', hitDie: 8, primary: ['wis'], savingThrows: ['int', 'wis'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    armor: ['light', 'medium', 'shield'], weapons: [],
    weaponIds: ['club', 'dagger', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'spear'],
    caster: 'full', spellAbility: 'wis',
    resources: [{ id: 'wild-shape', name: 'Wild Shape', recharge: 'short', max: scale([[2, 2]]) }],
    startingEquipment: ['shield', 'scimitar', 'leather', 'druidic-focus', 'backpack'],
    features: [{ level: 1, name: 'Druidic' }, { level: 1, name: 'Spellcasting' }, { level: 2, name: 'Wild Shape' }, { level: 2, name: 'Druid Circle' }],
  },
  {
    id: 'fighter', name: 'Fighter', hitDie: 10, primary: ['str', 'dex'], savingThrows: ['str', 'con'],
    skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'], caster: 'none',
    resources: [
      { id: 'second-wind', name: 'Second Wind', recharge: 'short', max: () => 1 },
      { id: 'action-surge', name: 'Action Surge', recharge: 'short', max: scale([[2, 1], [17, 2]]) },
    ],
    startingEquipment: ['chain-mail', 'longsword', 'shield', 'light-crossbow', 'bolts', 'backpack', 'bedroll'],
    features: [{ level: 1, name: 'Fighting Style' }, { level: 1, name: 'Second Wind' }, { level: 2, name: 'Action Surge' }, { level: 3, name: 'Martial Archetype' }, { level: 5, name: 'Extra Attack' }],
  },
  {
    id: 'monk', name: 'Monk', hitDie: 8, primary: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
    armor: [], weapons: ['simple'], weaponIds: ['shortsword'], caster: 'none', unarmoredDefense: 'wis',
    resources: [{ id: 'ki', name: 'Ki Points', recharge: 'short', max: l => (l >= 2 ? l : 0) }],
    startingEquipment: ['shortsword', 'dagger', 'dagger', 'dagger', 'dagger', 'dagger', 'dagger', 'dagger', 'dagger', 'dagger', 'dagger', 'backpack'],
    features: [{ level: 1, name: 'Unarmored Defense' }, { level: 1, name: 'Martial Arts' }, { level: 2, name: 'Ki' }, { level: 2, name: 'Unarmored Movement' }, { level: 3, name: 'Deflect Missiles' }, { level: 5, name: 'Extra Attack' }, { level: 5, name: 'Stunning Strike' }],
  },
  {
    id: 'paladin', name: 'Paladin', hitDie: 10, primary: ['str', 'cha'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'], caster: 'half', spellAbility: 'cha',
    resources: [
      { id: 'divine-sense', name: 'Divine Sense', recharge: 'long', max: (_l, m) => 1 + Math.max(0, m.cha) },
      { id: 'lay-on-hands', name: 'Lay on Hands (HP pool)', recharge: 'long', max: l => 5 * l },
      { id: 'channel-divinity', name: 'Channel Divinity', recharge: 'short', max: scale([[3, 1]]) },
    ],
    startingEquipment: ['longsword', 'shield', 'javelin', 'javelin', 'javelin', 'javelin', 'javelin', 'chain-mail', 'holy-symbol', 'backpack'],
    features: [{ level: 1, name: 'Divine Sense' }, { level: 1, name: 'Lay on Hands' }, { level: 2, name: 'Fighting Style' }, { level: 2, name: 'Spellcasting' }, { level: 2, name: 'Divine Smite' }, { level: 3, name: 'Sacred Oath' }, { level: 5, name: 'Extra Attack' }],
  },
  {
    id: 'ranger', name: 'Ranger', hitDie: 10, primary: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
    armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], caster: 'half', spellAbility: 'wis',
    resources: [],
    startingEquipment: ['scale-mail', 'shortsword', 'shortsword', 'longbow', 'arrows', 'backpack'],
    features: [{ level: 1, name: 'Favored Enemy' }, { level: 1, name: 'Natural Explorer' }, { level: 2, name: 'Fighting Style' }, { level: 2, name: 'Spellcasting' }, { level: 3, name: 'Ranger Archetype' }, { level: 5, name: 'Extra Attack' }],
  },
  {
    id: 'rogue', name: 'Rogue', hitDie: 8, primary: ['dex'], savingThrows: ['dex', 'int'],
    skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
    armor: ['light'], weapons: ['simple'], weaponIds: ['hand-crossbow', 'longsword', 'rapier', 'shortsword'], caster: 'none',
    resources: [],
    startingEquipment: ['rapier', 'shortbow', 'arrows', 'leather', 'dagger', 'dagger', 'thieves-tools', 'backpack'],
    features: [{ level: 1, name: 'Expertise' }, { level: 1, name: 'Sneak Attack' }, { level: 1, name: "Thieves' Cant" }, { level: 2, name: 'Cunning Action' }, { level: 3, name: 'Roguish Archetype' }, { level: 5, name: 'Uncanny Dodge' }],
  },
  {
    id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primary: ['cha'], savingThrows: ['con', 'cha'],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
    armor: [], weapons: [], weaponIds: ['dagger', 'quarterstaff', 'light-crossbow'], caster: 'full', spellAbility: 'cha',
    resources: [{ id: 'sorcery-points', name: 'Sorcery Points', recharge: 'long', max: l => (l >= 2 ? l : 0) }],
    startingEquipment: ['light-crossbow', 'bolts', 'component-pouch', 'dagger', 'dagger', 'backpack'],
    features: [{ level: 1, name: 'Spellcasting' }, { level: 1, name: 'Sorcerous Origin' }, { level: 2, name: 'Font of Magic' }, { level: 3, name: 'Metamagic' }],
  },
  {
    id: 'warlock', name: 'Warlock', hitDie: 8, primary: ['cha'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
    armor: ['light'], weapons: ['simple'], caster: 'pact', spellAbility: 'cha',
    resources: [],
    startingEquipment: ['light-crossbow', 'bolts', 'component-pouch', 'leather', 'dagger', 'dagger', 'backpack'],
    features: [{ level: 1, name: 'Otherworldly Patron' }, { level: 1, name: 'Pact Magic' }, { level: 2, name: 'Eldritch Invocations' }, { level: 3, name: 'Pact Boon' }],
  },
  {
    id: 'wizard', name: 'Wizard', hitDie: 6, primary: ['int'], savingThrows: ['int', 'wis'],
    skillChoices: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
    armor: [], weapons: [], weaponIds: ['dagger', 'quarterstaff', 'light-crossbow'], caster: 'full', spellAbility: 'int',
    resources: [{ id: 'arcane-recovery', name: 'Arcane Recovery', recharge: 'long', max: () => 1 }],
    startingEquipment: ['quarterstaff', 'component-pouch', 'spellbook', 'backpack'],
    features: [{ level: 1, name: 'Spellcasting' }, { level: 1, name: 'Arcane Recovery' }, { level: 2, name: 'Arcane Tradition' }],
  },
]

export const classById = (id: string) => CLASSES.find(c => c.id === id)

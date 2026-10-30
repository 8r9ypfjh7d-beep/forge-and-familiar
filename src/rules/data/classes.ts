import type { ClassDef, RulesEdition } from '../types'
import { FEATURES_2014 } from './classFeatures2014'
import { CLASSES_2024 } from './srd52/classes'
import { ARTISAN_TOOLS, MUSICAL_INSTRUMENTS } from './proficiencies'
import { ALL_SKILLS } from './skills'

// SRD 5.1 classes. Subclasses live in subclasses.ts; features (levels 1–20) in classFeatures2014.ts.
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
    startingEquipment: ['explorers-pack', 'javelin', 'javelin', 'javelin', 'javelin'],
    equipmentChoices: [
      { options: [{ items: ['greataxe'] }, { items: ['any:martial-melee'] }] },
      { options: [{ items: ['handaxe', 'handaxe'] }, { items: ['any:simple'] }] },
    ],
    subclassLevel: 3, subclassTitle: 'Primal Path', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.barbarian,
  },
  {
    id: 'bard', name: 'Bard', hitDie: 8, primary: ['cha'], savingThrows: ['dex', 'cha'],
    skillChoices: { count: 3, from: ALL_SKILLS },
    armor: ['light'], weapons: ['simple'], weaponIds: ['hand-crossbow', 'longsword', 'rapier', 'shortsword'],
    caster: 'full', spellAbility: 'cha',
    resources: [
      { id: 'bardic-inspiration', name: 'Bardic Inspiration', recharge: 'long', shortRestFromLevel: 5, max: (_l, m) => Math.max(1, m.cha) },
    ],
    startingEquipment: ['leather', 'dagger'],
    equipmentChoices: [
      { options: [{ items: ['rapier'] }, { items: ['longsword'] }, { items: ['any:simple'] }] },
      { options: [{ items: ['diplomats-pack'] }, { items: ['entertainers-pack'] }] },
      { options: [{ items: ['lute'] }, { items: ['any:instrument'] }] },
    ],
    toolChoices: { count: 3, from: MUSICAL_INSTRUMENTS },
    subclassLevel: 3, subclassTitle: 'Bard College', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.bard,
  },
  {
    id: 'cleric', name: 'Cleric', hitDie: 8, primary: ['wis'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    armor: ['light', 'medium', 'shield'], weapons: ['simple'], caster: 'full', spellAbility: 'wis',
    resources: [
      { id: 'channel-divinity', name: 'Channel Divinity', recharge: 'short', max: scale([[2, 1], [6, 2], [18, 3]]) },
      { id: 'divine-intervention', name: 'Divine Intervention', recharge: 'long', max: scale([[10, 1]]) },
    ],
    startingEquipment: ['shield', 'holy-symbol'],
    equipmentChoices: [
      { options: [{ items: ['mace'] }, { items: ['warhammer'] }] },
      { options: [{ items: ['scale-mail'] }, { items: ['leather'] }, { items: ['chain-mail'] }] },
      { options: [{ items: ['light-crossbow', 'bolts'] }, { items: ['any:simple'] }] },
      { options: [{ items: ['priests-pack'] }, { items: ['explorers-pack'] }] },
    ],
    subclassLevel: 1, subclassTitle: 'Divine Domain', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.cleric,
  },
  {
    id: 'druid', name: 'Druid', hitDie: 8, primary: ['wis'], savingThrows: ['int', 'wis'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    armor: ['light', 'medium', 'shield'], weapons: [],
    weaponIds: ['club', 'dagger', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'spear'],
    caster: 'full', spellAbility: 'wis',
    // Archdruid (20): Wild Shape without limit.
    resources: [{ id: 'wild-shape', name: 'Wild Shape', recharge: 'short', max: scale([[2, 2], [20, 99]]) }],
    startingEquipment: ['leather', 'explorers-pack', 'druidic-focus'],
    equipmentChoices: [
      { options: [{ items: ['shield'] }, { items: ['any:simple'] }] },
      { options: [{ items: ['scimitar'] }, { items: ['any:simple-melee'] }] },
    ],
    toolProficiencies: ['Herbalism kit'],
    subclassLevel: 2, subclassTitle: 'Druid Circle', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.druid,
  },
  {
    id: 'fighter', name: 'Fighter', hitDie: 10, primary: ['str', 'dex'], savingThrows: ['str', 'con'],
    skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'], caster: 'none',
    resources: [
      { id: 'second-wind', name: 'Second Wind', recharge: 'short', max: () => 1 },
      { id: 'action-surge', name: 'Action Surge', recharge: 'short', max: scale([[2, 1], [17, 2]]) },
      { id: 'indomitable', name: 'Indomitable', recharge: 'long', max: scale([[9, 1], [13, 2], [17, 3]]) },
    ],
    startingEquipment: [],
    equipmentChoices: [
      { options: [{ items: ['chain-mail'] }, { items: ['leather', 'longbow', 'arrows'] }] },
      { options: [{ items: ['any:martial', 'shield'] }, { items: ['any:martial', 'any:martial'] }] },
      { options: [{ items: ['light-crossbow', 'bolts'] }, { items: ['handaxe', 'handaxe'] }] },
      { options: [{ items: ['dungeoneers-pack'] }, { items: ['explorers-pack'] }] },
    ],
    subclassLevel: 3, subclassTitle: 'Martial Archetype', asiLevels: [4, 6, 8, 12, 14, 16, 19],
    features: FEATURES_2014.fighter,
  },
  {
    id: 'monk', name: 'Monk', hitDie: 8, primary: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
    armor: [], weapons: ['simple'], weaponIds: ['shortsword'], caster: 'none', unarmoredDefense: 'wis',
    resources: [{ id: 'ki', name: 'Ki Points', recharge: 'short', max: l => (l >= 2 ? l : 0) }],
    startingEquipment: Array(10).fill('dart'),
    equipmentChoices: [
      { options: [{ items: ['shortsword'] }, { items: ['any:simple'] }] },
      { options: [{ items: ['dungeoneers-pack'] }, { items: ['explorers-pack'] }] },
    ],
    toolChoices: { count: 1, from: [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS] },
    subclassLevel: 3, subclassTitle: 'Monastic Tradition', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.monk,
  },
  {
    id: 'paladin', name: 'Paladin', hitDie: 10, primary: ['str', 'cha'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'], caster: 'half', spellAbility: 'cha',
    resources: [
      { id: 'divine-sense', name: 'Divine Sense', recharge: 'long', max: (_l, m) => 1 + Math.max(0, m.cha) },
      { id: 'lay-on-hands', name: 'Lay on Hands (HP pool)', recharge: 'long', max: l => 5 * l },
      { id: 'channel-divinity', name: 'Channel Divinity', recharge: 'short', max: scale([[3, 1]]) },
      { id: 'cleansing-touch', name: 'Cleansing Touch', recharge: 'long', max: (l, m) => (l >= 14 ? Math.max(1, m.cha) : 0) },
    ],
    startingEquipment: ['chain-mail', 'holy-symbol'],
    equipmentChoices: [
      { options: [{ items: ['any:martial', 'shield'] }, { items: ['any:martial', 'any:martial'] }] },
      { options: [{ items: ['javelin', 'javelin', 'javelin', 'javelin', 'javelin'] }, { items: ['any:simple-melee'] }] },
      { options: [{ items: ['priests-pack'] }, { items: ['explorers-pack'] }] },
    ],
    subclassLevel: 3, subclassTitle: 'Sacred Oath', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.paladin,
  },
  {
    id: 'ranger', name: 'Ranger', hitDie: 10, primary: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
    armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], caster: 'half', spellAbility: 'wis',
    resources: [],
    startingEquipment: ['longbow', 'arrows'],
    equipmentChoices: [
      { options: [{ items: ['scale-mail'] }, { items: ['leather'] }] },
      { options: [{ items: ['shortsword', 'shortsword'] }, { items: ['any:simple-melee', 'any:simple-melee'] }] },
      { options: [{ items: ['dungeoneers-pack'] }, { items: ['explorers-pack'] }] },
    ],
    subclassLevel: 3, subclassTitle: 'Ranger Archetype', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.ranger,
  },
  {
    id: 'rogue', name: 'Rogue', hitDie: 8, primary: ['dex'], savingThrows: ['dex', 'int'],
    skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
    armor: ['light'], weapons: ['simple'], weaponIds: ['hand-crossbow', 'longsword', 'rapier', 'shortsword'], caster: 'none',
    resources: [{ id: 'stroke-of-luck', name: 'Stroke of Luck', recharge: 'short', max: scale([[20, 1]]) }],
    startingEquipment: ['leather', 'dagger', 'dagger', 'thieves-tools'],
    equipmentChoices: [
      { options: [{ items: ['rapier'] }, { items: ['shortsword'] }] },
      { options: [{ items: ['shortbow', 'arrows'] }, { items: ['shortsword'] }] },
      { options: [{ items: ['burglars-pack'] }, { items: ['dungeoneers-pack'] }, { items: ['explorers-pack'] }] },
    ],
    toolProficiencies: ["Thieves' tools"],
    subclassLevel: 3, subclassTitle: 'Roguish Archetype', asiLevels: [4, 8, 10, 12, 16, 19],
    features: FEATURES_2014.rogue,
  },
  {
    id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primary: ['cha'], savingThrows: ['con', 'cha'],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
    armor: [], weapons: [], weaponIds: ['dagger', 'quarterstaff', 'light-crossbow'], caster: 'full', spellAbility: 'cha',
    resources: [{ id: 'sorcery-points', name: 'Sorcery Points', recharge: 'long', max: l => (l >= 2 ? l : 0) }],
    startingEquipment: ['dagger', 'dagger'],
    equipmentChoices: [
      { options: [{ items: ['light-crossbow', 'bolts'] }, { items: ['any:simple'] }] },
      { options: [{ items: ['component-pouch'] }, { items: ['arcane-focus'] }] },
      { options: [{ items: ['dungeoneers-pack'] }, { items: ['explorers-pack'] }] },
    ],
    subclassLevel: 1, subclassTitle: 'Sorcerous Origin', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.sorcerer,
  },
  {
    id: 'warlock', name: 'Warlock', hitDie: 8, primary: ['cha'], savingThrows: ['wis', 'cha'],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
    armor: ['light'], weapons: ['simple'], caster: 'pact', spellAbility: 'cha',
    // Each Mystic Arcanum spell is cast once per long rest.
    resources: [
      { id: 'mystic-arcanum-6', name: 'Mystic Arcanum (6th level)', recharge: 'long', max: scale([[11, 1]]) },
      { id: 'mystic-arcanum-7', name: 'Mystic Arcanum (7th level)', recharge: 'long', max: scale([[13, 1]]) },
      { id: 'mystic-arcanum-8', name: 'Mystic Arcanum (8th level)', recharge: 'long', max: scale([[15, 1]]) },
      { id: 'mystic-arcanum-9', name: 'Mystic Arcanum (9th level)', recharge: 'long', max: scale([[17, 1]]) },
      { id: 'eldritch-master', name: 'Eldritch Master', recharge: 'long', max: scale([[20, 1]]) },
    ],
    startingEquipment: ['leather', 'dagger', 'dagger'],
    equipmentChoices: [
      { options: [{ items: ['any:simple'] }] },
      { options: [{ items: ['light-crossbow', 'bolts'] }, { items: ['any:simple'] }] },
      { options: [{ items: ['component-pouch'] }, { items: ['arcane-focus'] }] },
      { options: [{ items: ['scholars-pack'] }, { items: ['dungeoneers-pack'] }] },
    ],
    subclassLevel: 1, subclassTitle: 'Otherworldly Patron', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.warlock,
  },
  {
    id: 'wizard', name: 'Wizard', hitDie: 6, primary: ['int'], savingThrows: ['int', 'wis'],
    skillChoices: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
    armor: [], weapons: [], weaponIds: ['dagger', 'quarterstaff', 'light-crossbow'], caster: 'full', spellAbility: 'int',
    resources: [
      { id: 'arcane-recovery', name: 'Arcane Recovery', recharge: 'long', max: () => 1 },
      // Signature Spells: each of the two spells once per short rest without a slot.
      { id: 'signature-spells', name: 'Signature Spells', recharge: 'short', max: scale([[20, 2]]) },
    ],
    startingEquipment: ['spellbook'],
    equipmentChoices: [
      { options: [{ items: ['quarterstaff'] }, { items: ['dagger'] }] },
      { options: [{ items: ['component-pouch'] }, { items: ['arcane-focus'] }] },
      { options: [{ items: ['scholars-pack'] }, { items: ['explorers-pack'] }] },
    ],
    subclassLevel: 2, subclassTitle: 'Arcane Tradition', asiLevels: [4, 8, 12, 16, 19],
    features: FEATURES_2014.wizard,
  },
]

/** SRD classes of an edition: CLASSES (2014) or CLASSES_2024. */
export const classesFor = (edition: RulesEdition = '2014'): ClassDef[] => (edition === '2024' ? CLASSES_2024 : CLASSES)

export const classById = (id: string, edition: RulesEdition = '2014') => classesFor(edition).find(c => c.id === id)

// The Artificer (not in the SRD): 2014 rules from Tasha's Cauldron of Everything, 2024 rules from Eberron: Forge of the
// Artificer. Names, numbers and mechanics only; what each feature, infusion and plan does is our own summary in
// src/i18n/locales/explain.artificer.*.ts (never book text).
import type { ClassOption } from '../../classOptions'
import type { ClassDef, ItemEffect, RulesEdition } from '../../types'
import { ARTISAN_TOOLS } from '../proficiencies'
import { f, fx, halfSpells, long, resist, type Def } from './helpers'

export const EFA = 'Eberron: Forge of the Artificer'
const TCE = "Tasha's Cauldron of Everything"

const feats = (level: number, ...names: string[]) => names.map(name => ({ level, name }))
const SKILLS: ClassDef['skillChoices'] = { count: 2, from: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleightOfHand'] }
const TOOLS = ["Thieves' tools", "Tinker's tools"]
/** Uses equal to the Intelligence modifier (at least 1), back on a long rest. */
const intUses = (from: number) => (l: number, m: { int: number }) => (l >= from ? Math.max(1, m.int) : 0)

/** Artificer spellcasting the content library has no class table for: the spellbook reads this instead. */
export interface BookSpellcasting {
  /** Spell names by spell level (index 0 = cantrips). Names the library lacks are skipped. */
  list: string[][]
  /** [class level, cantrips known] steps. */
  cantrips: [number, number][]
  /** Spells prepared at a class level with the spellcasting modifier. */
  prepared: (level: number, mod: number) => number
}

export const ARTIFICER: ClassDef = {
  id: 'artificer', name: 'Artificer', source: TCE, hitDie: 8, primary: ['int'], savingThrows: ['con', 'int'],
  skillChoices: SKILLS, armor: ['light', 'medium', 'shield'], weapons: ['simple'],
  caster: 'half', roundsUp: true, spellAbility: 'int',
  resources: [
    { id: 'flash-of-genius', name: 'Flash of Genius', recharge: 'long', max: intUses(7) },
    { id: 'spell-storing-item', name: 'Spell-Storing Item', recharge: 'long', max: (l, m) => (l >= 11 ? Math.max(2, 2 * m.int) : 0) },
  ],
  startingEquipment: ['light-crossbow', 'bolts', 'thieves-tools', 'dungeoneers-pack'],
  equipmentChoices: [
    { options: [{ items: ['any:simple', 'any:simple'] }] },
    { options: [{ items: ['studded-leather'] }, { items: ['scale-mail'] }] },
  ],
  toolProficiencies: TOOLS, toolChoices: { count: 1, from: ARTISAN_TOOLS.filter(t => t !== "Tinker's tools") },
  subclassLevel: 3, subclassTitle: 'Artificer Specialist', asiLevels: [4, 8, 12, 16, 19],
  optionPicks: [{ kind: 'infusion', name: 'Infuse Item', counts: [[2, 4], [6, 6], [10, 8], [14, 10], [18, 12]] }],
  features: [
    ...feats(1, 'Magical Tinkering', 'Spellcasting'), ...feats(2, 'Infuse Item'), ...feats(3, 'Artificer Specialist', 'The Right Tool for the Job'),
    ...feats(6, 'Tool Expertise'), ...feats(7, 'Flash of Genius'), ...feats(10, 'Magic Item Adept'), ...feats(11, 'Spell-Storing Item'),
    ...feats(14, 'Magic Item Savant'), ...feats(18, 'Magic Item Master'), ...feats(20, 'Soul of Artifice'),
  ],
}

export const ARTIFICER_2024: ClassDef = {
  ...ARTIFICER, source: EFA, subclassTitle: 'Artificer Subclass',
  resources: [
    { id: 'tinkers-magic', name: "Tinker's Magic", recharge: 'long', max: intUses(1) },
    { id: 'flash-of-genius', name: 'Flash of Genius', recharge: 'long', max: intUses(7) },
    { id: 'spell-storing-item', name: 'Spell-Storing Item', recharge: 'long', max: (l, m) => (l >= 11 ? Math.max(2, 2 * m.int) : 0) },
  ],
  startingEquipment: [],
  equipmentChoices: [{ options: [{ items: ['studded-leather', 'dagger', 'thieves-tools', 'dungeoneers-pack'], gold: 16 }, { items: [], gold: 150 }] }],
  optionPicks: [{ kind: 'replicate', name: 'Replicate Magic Item', counts: [[2, 4], [6, 5], [10, 6], [14, 7], [18, 8]] }],
  features: [
    ...feats(1, 'Spellcasting', "Tinker's Magic"), ...feats(2, 'Replicate Magic Item'), ...feats(3, 'Artificer Subclass'),
    ...feats(6, 'Magic Item Tinker'), ...feats(7, 'Flash of Genius'), ...feats(10, 'Magic Item Adept'), ...feats(11, 'Spell-Storing Item'),
    ...feats(14, 'Advanced Artifice'), ...feats(18, 'Magic Item Master'), ...feats(19, 'Epic Boon'), ...feats(20, 'Soul of Artifice'),
  ],
}

// ---------- Spells ----------

const LIST_2014: string[][] = [
  ['Acid Splash', 'Booming Blade', 'Create Bonfire', 'Dancing Lights', 'Fire Bolt', 'Frostbite', 'Green-Flame Blade', 'Guidance', 'Light',
    'Lightning Lure', 'Mage Hand', 'Magic Stone', 'Mending', 'Message', 'Poison Spray', 'Prestidigitation', 'Ray of Frost', 'Resistance',
    'Shocking Grasp', 'Spare the Dying', 'Sword Burst', 'Thorn Whip', 'Thunderclap'],
  ['Absorb Elements', 'Alarm', 'Catapult', 'Cure Wounds', 'Detect Magic', 'Disguise Self', 'Expeditious Retreat', 'Faerie Fire', 'False Life',
    'Feather Fall', 'Grease', 'Identify', 'Jump', 'Longstrider', 'Purify Food and Drink', 'Sanctuary', 'Snare', "Tasha's Caustic Brew"],
  ['Aid', 'Alter Self', 'Arcane Lock', 'Blur', 'Continual Flame', 'Darkvision', 'Enhance Ability', 'Enlarge/Reduce', 'Heat Metal', 'Invisibility',
    'Lesser Restoration', 'Levitate', 'Magic Mouth', 'Magic Weapon', 'Protection from Poison', 'Pyrotechnics', 'Rope Trick', 'See Invisibility',
    'Skywrite', 'Spider Climb', 'Web'],
  ['Blink', 'Catnap', 'Create Food and Water', 'Dispel Magic', 'Elemental Weapon', 'Flame Arrows', 'Fly', 'Glyph of Warding', 'Haste',
    'Intellect Fortress', 'Protection from Energy', 'Revivify', 'Tiny Servant', 'Water Breathing', 'Water Walk'],
  ['Arcane Eye', 'Elemental Bane', 'Fabricate', 'Freedom of Movement', 'Secret Chest', 'Faithful Hound', 'Private Sanctum', 'Resilient Sphere',
    'Stone Shape', 'Stoneskin', 'Summon Construct'],
  ['Animate Objects', 'Arcane Hand', 'Creation', 'Greater Restoration', 'Skill Empowerment', 'Transmute Rock', 'Wall of Stone'],
]

/** 2024 list: the 2014 one plus the spells Forge of the Artificer added. */
const LIST_2024: string[][] = LIST_2014.map((names, i) => [...names, ...([
  ['Elementalism', 'True Strike'], [], ["Arcane Vigor", "Dragon's Breath", 'Homunculus Servant'], [], [], ['Circle of Power'],
][i] ?? [])])

/** 2014: Intelligence modifier + half the artificer level (rounded down), at least 1. */
export const ARTIFICER_SPELLS: BookSpellcasting = {
  list: LIST_2014, cantrips: [[1, 2], [10, 3], [14, 4]], prepared: (level, mod) => Math.max(1, mod + Math.floor(level / 2)),
}
/** 2024: a fixed prepared count by level, like the other half casters. */
const PREPARED_2024 = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]
export const ARTIFICER_SPELLS_2024: BookSpellcasting = {
  list: LIST_2024, cantrips: [[1, 2], [10, 3], [14, 4]], prepared: level => PREPARED_2024[Math.min(20, Math.max(1, level)) - 1],
}

/** Spellcasting of a class from the books (the content library only has SRD class tables). */
export const bookSpellcasting = (classId: string, edition: RulesEdition = '2014'): BookSpellcasting | undefined =>
  classId === 'artificer' ? (edition === '2024' ? ARTIFICER_SPELLS_2024 : ARTIFICER_SPELLS) : undefined

// ---------- Subclasses ----------

const A = 'artificer'
const steps = (rows: [number, number][]) => ({ uses: { count: 1, recharge: 'long' as const, steps: rows } })
const infiltrator: ItemEffect[] = [{ kind: 'speed', value: 5 }, { kind: 'advantage', on: 'skill:stealth' }]

const ALCHEMIST_SPELLS = halfSpells(['Healing Word', 'Ray of Sickness'], ['Flaming Sphere', 'Acid Arrow'], ['Gaseous Form', 'Mass Healing Word'], ['Blight', 'Death Ward'], ['Cloudkill', 'Raise Dead'])
const ARMORER_SPELLS = halfSpells(['Magic Missile', 'Thunderwave'], ['Mirror Image', 'Shatter'], ['Hypnotic Pattern', 'Lightning Bolt'], ['Fire Shield', 'Greater Invisibility'], ['Passwall', 'Wall of Force'])
const ARTILLERIST_SPELLS = halfSpells(['Shield', 'Thunderwave'], ['Scorching Ray', 'Shatter'], ['Fireball', 'Wind Wall'], ['Ice Storm', 'Wall of Fire'], ['Cone of Cold', 'Wall of Force'])
const BATTLE_SMITH_SPELLS = halfSpells(['Heroism', 'Shield'], ['Branding Smite', 'Warding Bond'], ['Aura of Vitality', 'Conjure Barrage'], ['Aura of Purity', 'Fire Shield'], ['Banishing Smite', 'Mass Cure Wounds'])
const MASTERY = fx(resist('acid'), resist('poison'), { kind: 'conditionImmunity', condition: 'poisoned' })

const armorer = (model: string, id: string, extra: ItemEffect[]): Def => ({
  id: `armorer-${id}`, classId: A, name: `Armorer (${model})`, source: TCE, armor: ['heavy'], spells: ARMORER_SPELLS,
  features: [
    f(3, 'Tools of the Trade'), f(3, 'Armorer Spells'), f(3, 'Arcane Armor'), f(3, `Armor Model: ${model}`, { ...(id === 'guardian' ? long('pb') : {}), ...(extra.length ? fx(...extra) : {}) }),
    f(5, 'Extra Attack'), f(9, 'Armor Modifications'), f(15, 'Perfected Armor'),
  ],
})

/** Tasha's Cauldron of Everything specialists. The Armorer's two armor models are listed separately because their numbers differ. */
export const ARTIFICER_SUBCLASSES: Def[] = [
  {
    id: 'alchemist', classId: A, name: 'Alchemist', source: TCE, spells: ALCHEMIST_SPELLS,
    features: [
      f(3, 'Tool Proficiency'), f(3, 'Alchemist Spells'), f(3, 'Experimental Elixir', steps([[3, 1], [6, 2], [15, 3]])),
      f(5, 'Alchemical Savant'), f(9, 'Restorative Reagents', long('int')), f(15, 'Chemical Mastery', { ...long(), ...MASTERY }),
    ],
  },
  armorer('Guardian', 'guardian', []),
  armorer('Infiltrator', 'infiltrator', infiltrator),
  {
    id: 'artillerist', classId: A, name: 'Artillerist', source: TCE, spells: ARTILLERIST_SPELLS,
    features: [
      f(3, 'Tool Proficiency'), f(3, 'Artillerist Spells'), f(3, 'Eldritch Cannon', long()),
      f(5, 'Arcane Firearm'), f(9, 'Explosive Cannon'), f(15, 'Fortified Position'),
    ],
  },
  {
    id: 'battle-smith', classId: A, name: 'Battle Smith', source: TCE, weapons: ['martial'], magicWeaponAbility: 'int', spells: BATTLE_SMITH_SPELLS,
    features: [
      f(3, 'Tool Proficiency'), f(3, 'Battle Smith Spells'), f(3, 'Battle Ready'), f(3, 'Steel Defender'),
      f(5, 'Extra Attack'), f(9, 'Arcane Jolt', long('int')), f(15, 'Improved Defender'),
    ],
  },
]

const efa = (d: Def): Def => ({ ...d, source: EFA })
const armorer2024 = (model: string, id: string, extra: ItemEffect[]): Def => efa({
  id: `armorer-${id}`, classId: A, name: `Armorer (${model})`, armor: ['heavy'], spells: ARMORER_SPELLS,
  features: [
    f(3, 'Tools of the Trade'), f(3, 'Armorer Spells'), f(3, 'Arcane Armor'), f(3, `Armor Model: ${model}`, { ...(id === 'guardian' ? long('pb') : {}), ...(extra.length ? fx(...extra) : {}) }),
    f(5, 'Extra Attack'), f(9, 'Armor Replication'), f(15, 'Perfected Armor'),
  ],
})

/** Forge of the Artificer: the four rewritten specialists, three armor models, and the new Cartographer. */
export const ARTIFICER_SUBCLASSES_2024: Def[] = [
  efa({
    id: 'alchemist', classId: A, name: 'Alchemist',
    spells: halfSpells(['Healing Word', 'Ray of Sickness'], ['Flaming Sphere', 'Acid Arrow'], ['Gaseous Form', 'Mass Healing Word'], ['Death Ward', 'Vitriolic Sphere'], ['Cloudkill', 'Raise Dead']),
    features: [
      f(3, 'Tools of the Trade'), f(3, 'Alchemist Spells'), f(3, 'Experimental Elixir', steps([[3, 2], [5, 3], [9, 4], [15, 5]])),
      f(5, 'Alchemical Savant'), f(9, 'Restorative Reagents', long('int')), f(15, 'Chemical Mastery', { ...long(), ...MASTERY }),
    ],
  }),
  armorer2024('Dreadnaught', 'dreadnaught', []),
  armorer2024('Guardian', 'guardian', []),
  armorer2024('Infiltrator', 'infiltrator', infiltrator),
  efa({
    id: 'artillerist', classId: A, name: 'Artillerist', spells: ARTILLERIST_SPELLS,
    features: [
      f(3, 'Tools of the Trade'), f(3, 'Artillerist Spells'), f(3, 'Eldritch Cannon', long()),
      f(5, 'Arcane Firearm'), f(9, 'Explosive Cannon'), f(15, 'Fortified Position'),
    ],
  }),
  efa({
    id: 'battle-smith', classId: A, name: 'Battle Smith', weapons: ['martial'], magicWeaponAbility: 'int', spells: BATTLE_SMITH_SPELLS,
    features: [
      f(3, 'Tools of the Trade'), f(3, 'Battle Smith Spells'), f(3, 'Battle Ready'), f(3, 'Steel Defender'),
      f(5, 'Extra Attack'), f(9, 'Arcane Jolt', long('int')), f(15, 'Improved Defender'),
    ],
  }),
  efa({
    id: 'cartographer', classId: A, name: 'Cartographer',
    spells: halfSpells(['Faerie Fire', 'Guiding Bolt', 'Healing Word'], ['Locate Object', 'Mind Spike'], ['Call Lightning', 'Clairvoyance'], ['Banishment', 'Locate Creature'], ['Scrying', 'Teleportation Circle']),
    features: [
      f(3, 'Tools of the Trade'), f(3, 'Cartographer Spells'), f(3, "Adventurer's Atlas"), f(3, 'Mapping Magic'),
      f(5, 'Guided Precision'), f(9, 'Ingenious Movement'), f(15, 'Superior Atlas'),
    ],
  }),
]

// ---------- Infusions (2014) and magic item plans (2024) ----------

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const INFUSION_LIST: [string, number, ItemEffect[]?][] = [
  ['Enhanced Arcane Focus', 2, [{ kind: 'spellAttack', value: 1 }]],
  ['Enhanced Defense', 2],
  ['Enhanced Weapon', 2],
  ['Homunculus Servant', 2],
  ['Mind Sharpener', 2, [{ kind: 'charges', value: 4, recharge: 'dawn', regain: '1d4' }]],
  ['Repeating Shot', 2],
  ['Returning Weapon', 2],
  ['Boots of the Winding Path', 6],
  ['Radiant Weapon', 6, [{ kind: 'charges', value: 4, recharge: 'dawn', regain: '1d4' }]],
  ['Repulsion Shield', 6, [{ kind: 'charges', value: 4, recharge: 'dawn', regain: '1d4' }]],
  ['Resistant Armor', 6],
  ['Spell-Refueling Ring', 6],
  ['Armor of Magical Strength', 10, [{ kind: 'charges', value: 6, recharge: 'dawn', regain: '1d6' }]],
  ['Helm of Awareness', 10, [{ kind: 'advantage', on: 'initiative' }]],
  ['Arcane Propulsion Armor', 14, [{ kind: 'speed', value: 5 }]],
]

/** Magic items Replicate Magic Item can copy under 2014 rules, by the artificer level that unlocks them. */
const REPLICATE_2014: [number, string[]][] = [
  [2, ['Alchemy Jug', 'Bag of Holding', 'Cap of Water Breathing', 'Goggles of Night', 'Rope of Climbing', 'Sending Stones', 'Wand of Magic Detection', 'Wand of Secrets']],
  [6, ['Boots of Elvenkind', 'Cloak of Elvenkind', 'Cloak of the Manta Ray', 'Eyes of Charming', 'Gloves of Thievery', 'Lantern of Revealing', 'Pipes of Haunting', 'Ring of Water Walking']],
  [10, ['Boots of Striding and Springing', 'Boots of the Winterlands', 'Bracers of Archery', 'Brooch of Shielding', 'Cloak of Protection', 'Eyes of the Eagle',
    'Gauntlets of Ogre Power', 'Gloves of Missile Snaring', 'Gloves of Swimming and Climbing', 'Hat of Disguise', 'Headband of Intellect', 'Helm of Telepathy',
    'Medallion of Thoughts', 'Necklace of Adaptation', 'Periapt of Wound Closure', 'Pipes of the Sewers', 'Quiver of Ehlonna', 'Ring of Jumping',
    'Ring of Mind Shielding', 'Slippers of Spider Climbing', 'Ventilating Lungs', 'Winged Boots']],
  [14, ['Amulet of Health', 'Arcane Propulsion Arm', 'Belt of Hill Giant Strength', 'Boots of Levitation', 'Boots of Speed', 'Bracers of Defense', 'Cloak of the Bat',
    'Dimensional Shackles', 'Gem of Seeing', 'Horn of Blasting', 'Ring of Free Action', 'Ring of Protection', 'Ring of the Ram']],
]

/** 2024 magic item plans (Forge of the Artificer), by the artificer level that unlocks them. */
const PLANS_2024: [number, string[]][] = [
  [2, ['Alchemy Jug', 'Bag of Holding', 'Cap of Water Breathing', 'Clockwork Amulet', 'Goggles of Night', 'Manifold Tool', 'Repeating Shot', 'Returning Weapon',
    'Rope of Climbing', 'Sending Stones', 'Shield +1', 'Wand of Magic Detection', 'Wand of Secrets', 'Wand of the War Mage +1', 'Weapon +1']],
  [6, ['Armor +1', 'Boots of Elvenkind', 'Cloak of Elvenkind', 'Dazzling Weapon', 'Gloves of Thievery', 'Helm of Awareness', 'Repulsion Shield', 'Wand of Magic Missiles',
    'Wand of Web', 'Weapon of Warning']],
  [10, ['Armor of Resistance', 'Boots of Striding and Springing', 'Bracers of Archery', 'Broom of Flying', 'Cap of Vanishing', 'Cloak of Protection', 'Dust of Disappearance',
    'Dust of Sneezing and Choking', 'Elemental Gem', 'Gloves of Missile Snaring', 'Shield +2', 'Stone of Good Luck', 'Wand of the War Mage +2', 'Weapon +2', 'Winged Boots']],
  [14, ['Amulet of Health', 'Armor +2', 'Bead of Force', 'Boots of Speed', 'Bowl of Commanding Water Elementals', 'Brazier of Commanding Fire Elementals',
    'Censer of Controlling Air Elementals', 'Stone of Controlling Earth Elementals', 'Cloak of Displacement', 'Cube of Force', 'Cube of Summoning',
    "Daern's Instant Fortress", 'Flame Tongue', 'Mantle of Spell Resistance', 'Necklace of Fireballs', 'Ring of Protection', 'Robe of Eyes', 'Wings of Flying']],
]

/** Plans whose numbers the library has no entry for (+N weapons, armor and shields get a magic bonus instead). */
const PLAN_EFFECTS: Record<string, ItemEffect[]> = {
  'Repulsion Shield': [{ kind: 'charges', value: 4, recharge: 'dawn', regain: '1d4' }],
  'Wand of the War Mage +1': [{ kind: 'spellAttack', value: 1 }], 'Wand of the War Mage +2': [{ kind: 'spellAttack', value: 2 }],
}

type Kind = 'infusion' | 'replicate'
const option = (kind: Kind, name: string, minLevel: number, source: string, item: NonNullable<ClassOption['item']>): ClassOption => ({
  id: name, kind, name, minLevel, source, classIds: [A], edition: kind === 'infusion' ? '2014' : '2024', item,
})

/** What a +N plan or infusion puts on the item: a magic bonus for weapons, armor and shields, else its effects. */
const itemOf = (name: string, effects?: ItemEffect[]): NonNullable<ClassOption['item']> => {
  const bonus = Number(/\+([12])$/.exec(name)?.[1] ?? 0)
  if (bonus && /^(Weapon|Armor|Shield) /.test(name)) return { magicBonus: bonus }
  if (['Enhanced Weapon', 'Enhanced Defense', 'Repeating Shot', 'Returning Weapon', 'Radiant Weapon', 'Repulsion Shield'].includes(name)) {
    return { magicBonus: 1, ...(effects?.length ? { effects } : {}) }
  }
  return effects?.length ? { effects } : { itemId: ITEM_IDS[name] ?? slugOf(name) }
}

/** Library ids that don't follow the item's name. */
const ITEM_IDS: Record<string, string> = {
  "Daern's Instant Fortress": 'instant-fortress', 'Stone of Good Luck': 'stone-of-good-luck-luckstone', 'Belt of Hill Giant Strength': 'belt-of-giant-strength-hill',
}

const replicate = (kind: Kind, source: string, prefix: string) => ([minLevel, names]: [number, string[]]): ClassOption[] =>
  names.map(name => ({ ...option(kind, `${prefix}${name}`, minLevel, source, itemOf(name, PLAN_EFFECTS[name])), id: `${kind === 'infusion' ? 'replicate' : 'plan'}:${slugOf(name)}` }))

/** 2014 Infusions, then one Replicate Magic Item entry per item it can copy. */
export const ARTIFICER_INFUSIONS: ClassOption[] = [
  ...INFUSION_LIST.map(([name, minLevel, effects]) => ({ ...option('infusion', name, minLevel, TCE, itemOf(name, effects)), id: `infusion:${slugOf(name)}` })),
  ...REPLICATE_2014.flatMap(replicate('infusion', TCE, 'Replicate Magic Item: ')),
]

/** 2024 magic item plans. */
export const ARTIFICER_PLANS: ClassOption[] = PLANS_2024.flatMap(replicate('replicate', EFA, ''))

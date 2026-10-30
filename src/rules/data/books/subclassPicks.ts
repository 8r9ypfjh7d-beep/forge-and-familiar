// Inner pick lists of subclass features: Battle Master maneuvers, Arcane Shots, runes, elemental disciplines,
// totem animals, Hunter picks, Circle of the Land terrain, dragon ancestry, bonus skills and the like.
// Names and mechanics only; what each option does is our own summary in i18n/locales/explain.picks.*.ts.
import type { ClassOption } from '../../classOptions'
import type { Ability, ItemEffect, SkillId, SubclassPickList } from '../../types'
import { ITEMS } from '../items'
import { SKILLS } from '../skills'

type Extra = Partial<Omit<ClassOption, 'id' | 'kind' | 'name'>>

/** Options of one kind for the given subclasses. */
const group = (kind: string, subclassIds: string[], rows: [id: string, name: string, extra?: Extra][]): ClassOption[] =>
  rows.map(([id, name, extra]) => ({ id, kind, name, subclassIds, ...extra }))

const adv = (...on: (`skill:${SkillId}` | `save:${Ability}`)[]): ItemEffect[] => on.map(o => ({ kind: 'advantage', on: o }))
const when = (on: 'saves', text: string): ItemEffect => ({ kind: 'advantage', on, when: text })
const resist = (damage: string): ItemEffect => ({ kind: 'resistance', damage })
const prof = (skill: SkillId, expertise?: boolean): ItemEffect => ({ kind: 'skillProficiency', skill, ...(expertise ? { expertise } : {}) })
const once = { uses: { count: 1, recharge: 'short' as const } }
/** Spells gained at class levels 3, 5, 7 and 9 (Circle of the Land). */
const circle = (...rows: string[][]) => rows.flatMap((names, i) => names.map(name => ({ name, level: [3, 5, 7, 9][i], note: 'always prepared' })))

/** Skill options; the explanation and Hebrew name come from the skill itself. */
const skills = (prefix: string, kind: string, subclassIds: string[], list: SkillId[], expertise?: boolean): ClassOption[] =>
  list.map(s => ({ id: `${prefix}-${s}`, kind, name: SKILLS[s].name, subclassIds, effects: [prof(s, expertise)] }))

const ALL_SKILL_IDS: SkillId[] = [
  'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation',
  'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival',
]

const BM = ['battle-master']
const TOTEM = ['totem-warrior']
const HUNTER = ['hunter']

export const SUBCLASS_OPTIONS: ClassOption[] = [
  // ---------- Fighter: Battle Master (PHB, Tasha's; 2024 drops Brace, Grappling Strike and Quick Toss) ----------
  ...group('maneuver', BM, [
    ['mv-ambush', 'Ambush'],
    ['mv-bait-and-switch', 'Bait and Switch'],
    ['mv-brace', 'Brace', { edition: '2014' }],
    ['mv-commanders-strike', "Commander's Strike"],
    ['mv-commanding-presence', 'Commanding Presence'],
    ['mv-disarming-attack', 'Disarming Attack'],
    ['mv-distracting-strike', 'Distracting Strike'],
    ['mv-evasive-footwork', 'Evasive Footwork'],
    ['mv-feinting-attack', 'Feinting Attack'],
    ['mv-goading-attack', 'Goading Attack'],
    ['mv-grappling-strike', 'Grappling Strike', { edition: '2014' }],
    ['mv-lunging-attack', 'Lunging Attack'],
    ['mv-maneuvering-attack', 'Maneuvering Attack'],
    ['mv-menacing-attack', 'Menacing Attack'],
    ['mv-parry', 'Parry'],
    ['mv-precision-attack', 'Precision Attack'],
    ['mv-pushing-attack', 'Pushing Attack'],
    ['mv-quick-toss', 'Quick Toss', { edition: '2014' }],
    ['mv-rally', 'Rally'],
    ['mv-riposte', 'Riposte'],
    ['mv-sweeping-attack', 'Sweeping Attack'],
    ['mv-tactical-assessment', 'Tactical Assessment'],
    ['mv-trip-attack', 'Trip Attack'],
  ]),
  ...skills('sow', 'studentOfWar', BM, ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'persuasion', 'survival']).map(o => ({ ...o, edition: '2024' as const })),

  // ---------- Fighter: Arcane Archer (Xanathar's) ----------
  ...group('arcaneShot', ['arcane-archer'], [
    ['shot-banishing', 'Banishing Arrow'],
    ['shot-beguiling', 'Beguiling Arrow'],
    ['shot-bursting', 'Bursting Arrow'],
    ['shot-enfeebling', 'Enfeebling Arrow'],
    ['shot-grasping', 'Grasping Arrow'],
    ['shot-piercing', 'Piercing Arrow'],
    ['shot-seeking', 'Seeking Arrow'],
    ['shot-shadow', 'Shadow Arrow'],
  ]),
  ...skills('archer', 'archerLore', ['arcane-archer'], ['arcana', 'nature']),
  ...group('archerCantrip', ['arcane-archer'], [
    ['archer-prestidigitation', 'Prestidigitation', { spells: [{ name: 'Prestidigitation' }] }],
    ['archer-druidcraft', 'Druidcraft', { spells: [{ name: 'Druidcraft' }] }],
  ]),

  // ---------- Fighter: Rune Knight (Tasha's). Each rune's power works once per short rest. ----------
  ...group('rune', ['rune-knight'], [
    ['rune-cloud', 'Cloud Rune', { ...once, effects: adv('skill:sleightOfHand', 'skill:deception') }],
    ['rune-fire', 'Fire Rune', { ...once }],
    ['rune-frost', 'Frost Rune', { ...once, effects: adv('skill:animalHandling', 'skill:intimidation') }],
    ['rune-stone', 'Stone Rune', { ...once, effects: [...adv('skill:insight'), { kind: 'sense', sense: 'darkvision', value: 120 }] }],
    ['rune-hill', 'Hill Rune', { ...once, minLevel: 7, effects: [when('saves', 'against being poisoned'), resist('poison')] }],
    ['rune-storm', 'Storm Rune', { ...once, minLevel: 7, effects: adv('skill:arcana') }],
  ]),

  // ---------- Fighter: Samurai and Cavalier (Xanathar's) bonus skill ----------
  ...skills('samurai', 'samuraiSkill', ['samurai'], ['history', 'insight', 'performance', 'persuasion']),
  ...skills('cav', 'cavalierSkill', ['cavalier'], ['animalHandling', 'history', 'insight', 'performance', 'persuasion']),

  // ---------- Monk: Way of the Four Elements (PHB) ----------
  ...group('discipline', ['four-elements'], [
    ['disc-fangs-fire-snake', 'Fangs of the Fire Snake'],
    ['disc-fist-four-thunders', 'Fist of Four Thunders'],
    ['disc-fist-unbroken-air', 'Fist of Unbroken Air'],
    ['disc-rush-gale-spirits', 'Rush of the Gale Spirits'],
    ['disc-shape-flowing-river', 'Shape the Flowing River'],
    ['disc-sweeping-cinder', 'Sweeping Cinder Strike'],
    ['disc-water-whip', 'Water Whip'],
    ['disc-clench-north-wind', 'Clench of the North Wind', { minLevel: 6 }],
    ['disc-gong-summit', 'Gong of the Summit', { minLevel: 6 }],
    ['disc-eternal-mountain', 'Eternal Mountain Defense', { minLevel: 11 }],
    ['disc-flames-phoenix', 'Flames of the Phoenix', { minLevel: 11 }],
    ['disc-mist-stance', 'Mist Stance', { minLevel: 11 }],
    ['disc-ride-wind', 'Ride the Wind', { minLevel: 11 }],
    ['disc-breath-winter', 'Breath of Winter', { minLevel: 17 }],
    ['disc-river-hungry-flame', 'River of Hungry Flame', { minLevel: 17 }],
    ['disc-wave-rolling-earth', 'Wave of Rolling Earth', { minLevel: 17 }],
  ]),

  // ---------- Monk: Way of the Kensei (Xanathar's): simple or martial weapons without heavy or special, plus the longbow ----------
  ...ITEMS.flatMap(i => (i.kind === 'weapon' && (i.id === 'longbow' || (!i.properties.includes('heavy') && i.id !== 'lance' && i.id !== 'net'))
    ? [{ id: `kensei-${i.id}`, kind: 'kenseiWeapon', name: i.name, subclassIds: ['kensei'] }]
    : [])),

  // ---------- Barbarian: Totem Warrior (PHB; Elk and Tiger from the Sword Coast guide) ----------
  ...group('totemSpirit', TOTEM, [['totem-bear', 'Bear'], ['totem-eagle', 'Eagle'], ['totem-elk', 'Elk'], ['totem-tiger', 'Tiger'], ['totem-wolf', 'Wolf']]),
  ...group('totemAspect', TOTEM, [['aspect-bear', 'Bear'], ['aspect-eagle', 'Eagle'], ['aspect-elk', 'Elk'], ['aspect-tiger', 'Tiger'], ['aspect-wolf', 'Wolf']]),
  ...group('totemAttunement', TOTEM, [['attune-bear', 'Bear'], ['attune-eagle', 'Eagle'], ['attune-elk', 'Elk'], ['attune-tiger', 'Tiger'], ['attune-wolf', 'Wolf']]),

  // ---------- Barbarian: Storm Herald (Xanathar's); Storm Soul at 6 adds a resistance ----------
  ...group('stormAura', ['storm-herald'], [
    ['storm-desert', 'Desert', { later: [{ level: 6, effects: [resist('fire')] }] }],
    ['storm-sea', 'Sea', { later: [{ level: 6, effects: [resist('lightning'), { kind: 'moveSpeed', mode: 'swim', value: 30 }] }] }],
    ['storm-tundra', 'Tundra', { later: [{ level: 6, effects: [resist('cold')] }] }],
  ]),

  // ---------- Barbarian: Path of the Giant (Bigby's) ----------
  ...group('giantCantrip', ['giant'], [
    ['giant-druidcraft', 'Druidcraft', { spells: [{ name: 'Druidcraft' }] }],
    ['giant-thaumaturgy', 'Thaumaturgy', { spells: [{ name: 'Thaumaturgy' }] }],
  ]),

  // ---------- Barbarian: Path of the Wild Heart (2024); the aspect can change on a long rest ----------
  ...group('wildAspect', ['path-of-the-wild-heart'], [
    ['wild-owl', 'Owl', { effects: [{ kind: 'sense', sense: 'darkvision', value: 60 }] }],
    ['wild-panther', 'Panther', { effects: [{ kind: 'moveSpeed', mode: 'climb', value: 0 }] }],
    ['wild-salmon', 'Salmon', { effects: [{ kind: 'moveSpeed', mode: 'swim', value: 0 }] }],
  ]).map(o => ({ ...o, edition: '2024' as const })),

  // ---------- Ranger: Hunter (both editions; 2014 adds Giant Killer, Steel Will and the level 11 and 15 picks) ----------
  ...group('huntersPrey', HUNTER, [['prey-colossus-slayer', 'Colossus Slayer'], ['prey-giant-killer', 'Giant Killer', { edition: '2014' }], ['prey-horde-breaker', 'Horde Breaker']]),
  ...group('defensiveTactics', HUNTER, [
    ['tactic-escape-horde', 'Escape the Horde'],
    ['tactic-multiattack-defense', 'Multiattack Defense'],
    ['tactic-steel-will', 'Steel Will', { edition: '2014', effects: [when('saves', 'against being frightened')] }],
  ]),
  ...group('hunterMultiattack', HUNTER, [['multi-volley', 'Volley'], ['multi-whirlwind', 'Whirlwind Attack']]).map(o => ({ ...o, edition: '2014' as const })),
  ...group('superiorDefense', HUNTER, [['sdef-evasion', 'Evasion'], ['sdef-stand-tide', 'Stand Against the Tide'], ['sdef-uncanny-dodge', 'Uncanny Dodge']]).map(o => ({ ...o, edition: '2014' as const })),

  // ---------- Ranger: Beast Master companion (PHB beast, or Tasha's / 2024 primal beast) ----------
  ...group('companion', ['beast-master'], [
    ['comp-beast', "Ranger's Companion (any small beast)", { edition: '2014' }],
    ['comp-land', 'Beast of the Land'],
    ['comp-sea', 'Beast of the Sea'],
    ['comp-sky', 'Beast of the Sky'],
  ]),

  // ---------- Ranger: Fey Wanderer (Tasha's, 2024) ----------
  ...skills('glamour', 'feyGlamour', ['fey-wanderer'], ['deception', 'performance', 'persuasion']),

  // ---------- Druid: Circle of the Land terrain (2014: circle spells by land) ----------
  ...group('landTerrain', ['land'], [
    ['land-arctic', 'Arctic', { spells: circle(['Hold Person', 'Spike Growth'], ['Sleet Storm', 'Slow'], ['Freedom of Movement', 'Ice Storm'], ['Commune with Nature', 'Cone of Cold']) }],
    ['land-coast', 'Coast', { spells: circle(['Mirror Image', 'Misty Step'], ['Water Breathing', 'Water Walk'], ['Control Water', 'Freedom of Movement'], ['Conjure Elemental', 'Scrying']) }],
    ['land-desert', 'Desert', { spells: circle(['Blur', 'Silence'], ['Create Food and Water', 'Protection from Energy'], ['Blight', 'Hallucinatory Terrain'], ['Insect Plague', 'Wall of Stone']) }],
    ['land-forest', 'Forest', { spells: circle(['Barkskin', 'Spider Climb'], ['Call Lightning', 'Plant Growth'], ['Divination', 'Freedom of Movement'], ['Commune with Nature', 'Tree Stride']) }],
    ['land-grassland', 'Grassland', { spells: circle(['Invisibility', 'Pass without Trace'], ['Daylight', 'Haste'], ['Divination', 'Freedom of Movement'], ['Dream', 'Insect Plague']) }],
    ['land-mountain', 'Mountain', { spells: circle(['Spider Climb', 'Spike Growth'], ['Lightning Bolt', 'Meld into Stone'], ['Stone Shape', 'Stoneskin'], ['Passwall', 'Wall of Stone']) }],
    ['land-swamp', 'Swamp', { spells: circle(['Darkness', 'Acid Arrow'], ['Water Walk', 'Stinking Cloud'], ['Freedom of Movement', 'Locate Creature'], ['Insect Plague', 'Scrying']) }],
    ['land-underdark', 'Underdark', { spells: circle(['Spider Climb', 'Web'], ['Gaseous Form', 'Stinking Cloud'], ['Greater Invisibility', 'Stone Shape'], ['Cloudkill', 'Insect Plague']) }],
  ]).map(o => ({ ...o, edition: '2014' as const })),

  // ---------- Druid: Circle of the Land (2024): land changes on a long rest; Nature's Ward at 10 adds its resistance ----------
  ...group('landType', ['circle-of-the-land'], [
    ['land24-arid', 'Arid Land', { spells: circle(['Blur', 'Burning Hands', 'Fire Bolt'], ['Fireball'], ['Blight'], ['Wall of Stone']), later: [{ level: 10, effects: [resist('fire')] }] }],
    ['land24-polar', 'Polar Land', { spells: circle(['Fog Cloud', 'Hold Person', 'Ray of Frost'], ['Sleet Storm'], ['Ice Storm'], ['Cone of Cold']), later: [{ level: 10, effects: [resist('cold')] }] }],
    ['land24-temperate', 'Temperate Land', { spells: circle(['Misty Step', 'Shocking Grasp', 'Sleep'], ['Lightning Bolt'], ['Freedom of Movement'], ['Tree Stride']), later: [{ level: 10, effects: [resist('lightning')] }] }],
    ['land24-tropical', 'Tropical Land', { spells: circle(['Acid Splash', 'Ray of Sickness', 'Web'], ['Stinking Cloud'], ['Polymorph'], ['Insect Plague']), later: [{ level: 10, effects: [resist('poison')] }] }],
  ]).map(o => ({ ...o, edition: '2024' as const })),

  // ---------- Sorcerer: dragon ancestor (2014) and Elemental Affinity (2024) ----------
  ...group('dragonAncestor', ['draconic'], [
    ['dragon-black', 'Black (acid)'], ['dragon-blue', 'Blue (lightning)'], ['dragon-brass', 'Brass (fire)'], ['dragon-bronze', 'Bronze (lightning)'],
    ['dragon-copper', 'Copper (acid)'], ['dragon-gold', 'Gold (fire)'], ['dragon-green', 'Green (poison)'], ['dragon-red', 'Red (fire)'],
    ['dragon-silver', 'Silver (cold)'], ['dragon-white', 'White (cold)'],
  ]).map(o => ({ ...o, edition: '2014' as const })),
  ...group('elementalAffinity', ['draconic-sorcery'], (['acid', 'cold', 'fire', 'lightning', 'poison'] as const).map(d =>
    [`affinity-${d}`, d[0].toUpperCase() + d.slice(1), { effects: [resist(d)] }] as [string, string, Extra])).map(o => ({ ...o, edition: '2024' as const })),

  // ---------- Sorcerer: Divine Soul (Xanathar's) ----------
  ...group('divineAffinity', ['divine-soul'], [
    ['soul-good', 'Good', { spells: [{ name: 'Cure Wounds', level: 1, note: 'always known' }] }],
    ['soul-evil', 'Evil', { spells: [{ name: 'Inflict Wounds', level: 1, note: 'always known' }] }],
    ['soul-law', 'Law', { spells: [{ name: 'Bless', level: 1, note: 'always known' }] }],
    ['soul-chaos', 'Chaos', { spells: [{ name: 'Bane', level: 1, note: 'always known' }] }],
    ['soul-neutrality', 'Neutrality', { spells: [{ name: 'Protection from Evil and Good', level: 1, note: 'always known' }] }],
  ]),

  // ---------- Cleric: Knowledge and Nature domains (PHB) ----------
  ...skills('know', 'knowledgeSkill', ['knowledge'], ['arcana', 'history', 'nature', 'religion'], true),
  ...skills('acolyte', 'natureSkill', ['nature'], ['animalHandling', 'nature', 'survival']),

  // ---------- Bard: College of Lore (three skills) and College of Swords (fighting style) ----------
  ...skills('lore', 'loreSkill', ['lore', 'college-of-lore'], ALL_SKILL_IDS),
  ...group('swordsStyle', ['swords'], [['swords-dueling', 'Dueling'], ['swords-two-weapon', 'Two-Weapon Fighting']]),
]

/** Which subclass feature offers which list, and how many picks the class level allows. */
export const SUBCLASS_PICK_LISTS: SubclassPickList[] = [
  { kind: 'maneuver', feature: 'Combat Superiority', subclassIds: BM, count: [[3, 3], [7, 5], [10, 7], [15, 9]], swap: 'level' },
  { kind: 'studentOfWar', feature: 'Student of War', subclassIds: BM, edition: '2024', count: [[3, 1]] },
  { kind: 'arcaneShot', feature: 'Arcane Shot', subclassIds: ['arcane-archer'], count: [[3, 2], [7, 3], [10, 4], [15, 5], [18, 6]], swap: 'level' },
  { kind: 'archerLore', feature: 'Arcane Archer Lore', subclassIds: ['arcane-archer'], count: [[3, 1]] },
  { kind: 'archerCantrip', feature: 'Arcane Archer Lore', subclassIds: ['arcane-archer'], count: [[3, 1]] },
  { kind: 'rune', feature: 'Rune Carver', subclassIds: ['rune-knight'], count: [[3, 2], [7, 3], [10, 4], [15, 5]], swap: 'level' },
  { kind: 'samuraiSkill', feature: 'Bonus Proficiency', subclassIds: ['samurai'], count: [[3, 1]] },
  { kind: 'cavalierSkill', feature: 'Bonus Proficiency', subclassIds: ['cavalier'], count: [[3, 1]] },
  { kind: 'discipline', feature: 'Disciple of the Elements', subclassIds: ['four-elements'], count: [[3, 1], [6, 2], [11, 3], [17, 4]], swap: 'level' },
  { kind: 'kenseiWeapon', feature: 'Path of the Kensei', subclassIds: ['kensei'], count: [[3, 2], [6, 3], [11, 4], [17, 5]] },
  { kind: 'totemSpirit', feature: 'Totem Spirit', subclassIds: TOTEM, count: [[3, 1]] },
  { kind: 'totemAspect', feature: 'Aspect of the Beast', subclassIds: TOTEM, count: [[6, 1]] },
  { kind: 'totemAttunement', feature: 'Totemic Attunement', subclassIds: TOTEM, count: [[14, 1]] },
  { kind: 'stormAura', feature: 'Storm Aura', subclassIds: ['storm-herald'], count: [[3, 1]], swap: 'level' },
  { kind: 'giantCantrip', feature: "Giant's Power", subclassIds: ['giant'], count: [[3, 1]] },
  { kind: 'wildAspect', feature: 'Aspect of the Wilds', subclassIds: ['path-of-the-wild-heart'], edition: '2024', count: [[6, 1]], swap: 'rest' },
  { kind: 'huntersPrey', feature: "Hunter's Prey", subclassIds: HUNTER, count: [[3, 1]], swap: 'rest' },
  { kind: 'defensiveTactics', feature: 'Defensive Tactics', subclassIds: HUNTER, count: [[7, 1]], swap: 'rest' },
  { kind: 'hunterMultiattack', feature: 'Multiattack', subclassIds: HUNTER, edition: '2014', count: [[11, 1]] },
  { kind: 'superiorDefense', feature: "Superior Hunter's Defense", subclassIds: HUNTER, edition: '2014', count: [[15, 1]] },
  { kind: 'companion', feature: "Ranger's Companion", subclassIds: ['beast-master'], edition: '2014', count: [[3, 1]] },
  { kind: 'companion', feature: 'Primal Companion', subclassIds: ['beast-master'], edition: '2024', count: [[3, 1]] },
  { kind: 'feyGlamour', feature: 'Otherworldly Glamour', subclassIds: ['fey-wanderer'], count: [[3, 1]] },
  { kind: 'landTerrain', feature: 'Circle Spells', subclassIds: ['land'], edition: '2014', count: [[3, 1]] },
  { kind: 'landType', feature: 'Circle of the Land Spells', subclassIds: ['circle-of-the-land'], edition: '2024', count: [[3, 1]], swap: 'rest' },
  { kind: 'dragonAncestor', feature: 'Dragon Ancestor', subclassIds: ['draconic'], edition: '2014', count: [[1, 1]] },
  { kind: 'elementalAffinity', feature: 'Elemental Affinity', subclassIds: ['draconic-sorcery'], edition: '2024', count: [[6, 1]] },
  { kind: 'divineAffinity', feature: 'Divine Magic', subclassIds: ['divine-soul'], count: [[1, 1]] },
  { kind: 'knowledgeSkill', feature: 'Blessings of Knowledge', subclassIds: ['knowledge'], count: [[1, 2]] },
  { kind: 'natureSkill', feature: 'Acolyte of Nature', subclassIds: ['nature'], count: [[1, 1]] },
  { kind: 'loreSkill', feature: 'Bonus Proficiencies', subclassIds: ['lore', 'college-of-lore'], count: [[3, 3]] },
  { kind: 'swordsStyle', feature: 'Fighting Style', subclassIds: ['swords'], count: [[3, 1]] },
]

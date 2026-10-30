import type { ClassChoice, ClassChoiceOption, ClassPick } from '../types'
import { SKILLS } from './skills'

// 2014 class build picks: Fighting Styles (PHB and Tasha's), Ranger Favored Enemy and Natural Explorer, and Tasha's
// optional class features. Names and mechanics only; non-SRD details are our own short summaries.
// Saved in Character.featureChoices under `<classId>.<choice id>`; the multi-picks at the end (Expertise) in Character.classPicks.
const TCE = "Tasha's Cauldron of Everything"

const style = (id: string, name: string, detail: string, extra: Partial<ClassChoiceOption> = {}): ClassChoiceOption => ({ id, name, detail, ...extra })

const S = {
  archery: style('archery', 'Archery', '+2 to attack rolls with ranged weapons.', { effects: [{ kind: 'attack', value: 2, only: 'ranged' }] }),
  defense: style('defense', 'Defense', '+1 AC while you wear armor.', { featEffects: [{ kind: 'armoredAc', amount: 1 }] }),
  dueling: style('dueling', 'Dueling', '+2 damage with a melee weapon in one hand and no other weapon.'),
  greatWeapon: style('great-weapon-fighting', 'Great Weapon Fighting', 'Reroll 1s and 2s on damage dice of two-handed or versatile weapons held in both hands.'),
  protection: style('protection', 'Protection', 'With a shield, use your reaction to impose disadvantage on an attack against an ally next to you.'),
  twoWeapon: style('two-weapon-fighting', 'Two-Weapon Fighting', 'Add your ability modifier to the damage of your off-hand attack.'),
  blind: style('blind-fighting', 'Blind Fighting', 'Blindsight 10 feet.', { source: TCE, effects: [{ kind: 'sense', sense: 'blindsight', value: 10 }] }),
  interception: style('interception', 'Interception', 'Reaction: cut the damage an ally next to you takes by 1d10 + proficiency bonus.', { source: TCE }),
  superior: style('superior-technique', 'Superior Technique', 'Learn one Battle Master maneuver and get one d6 superiority die per short rest.', { source: TCE, uses: { count: 1, recharge: 'short' } }),
  thrown: style('thrown-weapon-fighting', 'Thrown Weapon Fighting', 'Draw thrown weapons freely and add +2 damage to ranged attacks with them.', { source: TCE }),
  unarmed: style('unarmed-fighting', 'Unarmed Fighting', 'Unarmed strikes deal 1d6 (1d8 with both hands free) and hurt a creature you grapple.', { source: TCE }),
  blessed: style('blessed-warrior', 'Blessed Warrior', 'Learn two cleric cantrips; they count as paladin spells.', { source: TCE }),
  druidic: style('druidic-warrior', 'Druidic Warrior', 'Learn two druid cantrips; they count as ranger spells.', { source: TCE }),
}

const fightingStyle = (level: number, options: ClassChoiceOption[]): ClassChoice => ({ id: 'fightingStyle', name: 'Fighting Style', level, pool: 'fightingStyle', options })

/** An optional Tasha's feature: take it or keep the base rules. */
const optional = (id: string, name: string, level: number, detail: string, extra: Partial<ClassChoiceOption> = {}): ClassChoice => ({
  id, name, level, topic: 'tashas', optional: true,
  options: [{ id: 'use', name, detail, source: TCE, ...extra }, { id: 'phb', name: 'Base rules', detail: 'Play without this optional feature.' }],
})

/** An optional Tasha's feature that replaces a Player's Handbook one. */
const replacement = (id: string, name: string, level: number, tashas: string, detail: string, extra: Partial<ClassChoiceOption> = {}): ClassChoice => ({
  id, name, level, topic: 'tashas', optional: true,
  options: [{ id: 'phb', name: `${name} (Player's Handbook)`, detail: 'Keep the Player\'s Handbook feature.' }, { id: 'use', name: tashas, detail, source: TCE, ...extra }],
})

const ENEMIES: ClassChoiceOption[] = [
  ['aberrations', 'Aberrations'], ['beasts', 'Beasts'], ['celestials', 'Celestials'], ['constructs', 'Constructs'], ['dragons', 'Dragons'],
  ['elementals', 'Elementals'], ['fey', 'Fey'], ['fiends', 'Fiends'], ['giants', 'Giants'], ['monstrosities', 'Monstrosities'], ['oozes', 'Oozes'],
  ['plants', 'Plants'], ['undead', 'Undead'], ['humanoids', 'Two humanoid races'],
].map(([id, name]) => ({
  id, name, detail: `Advantage on Survival checks to track ${name.toLowerCase()} and on Intelligence checks to recall facts about them; learn one of their languages.`,
  effects: [{ kind: 'advantage', on: 'skill:survival', when: `to track ${name.toLowerCase()}` }],
}))

const TERRAINS: ClassChoiceOption[] = [
  ['arctic', 'Arctic'], ['coast', 'Coast'], ['desert', 'Desert'], ['forest', 'Forest'], ['grassland', 'Grassland'], ['mountain', 'Mountain'],
  ['swamp', 'Swamp'], ['underdark', 'Underdark'],
].map(([id, name]) => ({ id, name, detail: `In ${name.toLowerCase()}: double proficiency on Intelligence and Wisdom checks about it, travel and forage better, never get lost.` }))

const FAVORED_FOE: ClassChoiceOption = {
  id: 'favored-foe', name: 'Favored Foe', source: TCE, uses: { count: 'pb', recharge: 'long' },
  detail: 'Instead of Favored Enemy: mark a creature you hit to deal an extra 1d4 damage to it each turn (more at higher levels), a few times per long rest.',
}
const DEFT_EXPLORER: ClassChoiceOption = {
  id: 'deft-explorer', name: 'Deft Explorer', source: TCE,
  detail: 'Instead of Natural Explorer: expertise in one skill and two languages; at 6th level +5 speed with climb and swim speeds; at 10th, shake off exhaustion and gain temporary hit points on a rest action.',
  levelEffects: [[6, [{ kind: 'speed', value: 5 }, { kind: 'moveSpeed', mode: 'climb', value: 0 }, { kind: 'moveSpeed', mode: 'swim', value: 0 }]]],
}

const notFoe = { choice: 'favoredEnemy', option: 'favored-foe', not: true }
const notDeft = { choice: 'naturalExplorer', option: 'deft-explorer', not: true }

const martialVersatility = (cls: string) => optional('martialVersatility', 'Martial Versatility', 4, `When you gain an Ability Score Improvement, swap your Fighting Style${cls === 'fighter' ? ' or a maneuver' : ''} for another.`)
const harness = (level: number, steps: [number, number][]) =>
  optional('harnessDivinePower', 'Harness Divine Power', level, 'Spend a Channel Divinity use to regain a spell slot (up to half your proficiency bonus, rounded up).', { uses: { count: 1, recharge: 'long', steps } })
const cantripVersatility = (cls: string) => optional('cantripVersatility', 'Cantrip Versatility', 4, `When you gain an Ability Score Improvement, swap one ${cls} cantrip for another.`)

export const CLASS_CHOICES_2014: Record<string, ClassChoice[]> = {
  barbarian: [
    {
      id: 'primalKnowledge', name: 'Primal Knowledge', level: 3, topic: 'tashas', optional: true,
      options: [
        ...(['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] as const).map(skill => ({
          id: skill, name: SKILLS[skill].name, detail: 'Proficiency in this skill.', source: TCE, effects: [{ kind: 'skillProficiency' as const, skill }],
        })),
        { id: 'phb', name: 'Base rules', detail: 'Play without this optional feature.' },
      ],
    },
    optional('instinctivePounce', 'Instinctive Pounce', 7, 'When you rage, move up to half your speed for free.'),
  ],
  bard: [
    optional('magicalInspiration', 'Magical Inspiration', 2, 'A creature with your Bardic Inspiration die can add it to a healing or damage spell.'),
    optional('bardicVersatility', 'Bardic Versatility', 4, 'When you gain an Ability Score Improvement, swap an Expertise skill or a cantrip.'),
  ],
  cleric: [
    harness(2, [[2, 1], [6, 2], [18, 3]]),
    cantripVersatility('cleric'),
    replacement('blessedStrikes', 'Divine Strike', 8, 'Blessed Strikes', 'Instead of Divine Strike or Potent Spellcasting: once per turn, a cantrip or weapon hit deals an extra 1d8 radiant damage.'),
  ],
  druid: [
    optional('wildCompanion', 'Wild Companion', 2, 'Spend a Wild Shape use to cast Find Familiar without components; the familiar is a fey.'),
    cantripVersatility('druid'),
  ],
  fighter: [
    fightingStyle(1, [S.archery, S.defense, S.dueling, S.greatWeapon, S.protection, S.twoWeapon, S.blind, S.interception, S.superior, S.thrown, S.unarmed]),
    martialVersatility('fighter'),
  ],
  monk: [
    optional('dedicatedWeapon', 'Dedicated Weapon', 2, 'After a short or long rest, make one simple or martial weapon (not heavy or special) a monk weapon.'),
    optional('kiFueledAttack', 'Ki-Fueled Attack', 3, 'After spending ki on your action, make one weapon or unarmed attack as a bonus action.'),
    optional('quickenedHealing', 'Quickened Healing', 4, 'Spend 2 ki to heal one Martial Arts die plus your proficiency bonus.'),
    optional('focusedAim', 'Focused Aim', 5, 'After a miss, spend 1 to 3 ki to add +2 per point to the roll.'),
  ],
  paladin: [
    fightingStyle(2, [S.defense, S.dueling, S.greatWeapon, S.protection, S.blind, S.interception, S.blessed]),
    harness(3, [[3, 1], [7, 2], [15, 3]]),
    martialVersatility('paladin'),
  ],
  ranger: [
    { id: 'favoredEnemy', name: 'Favored Enemy', level: 1, topic: 'favoredEnemy', options: [...ENEMIES, FAVORED_FOE] },
    { id: 'favoredEnemy2', name: 'Favored Enemy', level: 6, topic: 'favoredEnemy', when: notFoe, options: ENEMIES },
    { id: 'favoredEnemy3', name: 'Favored Enemy', level: 14, topic: 'favoredEnemy', when: notFoe, options: ENEMIES },
    { id: 'naturalExplorer', name: 'Natural Explorer', level: 1, topic: 'naturalExplorer', options: [...TERRAINS, DEFT_EXPLORER] },
    { id: 'naturalExplorer2', name: 'Natural Explorer', level: 6, topic: 'naturalExplorer', when: notDeft, options: TERRAINS },
    { id: 'naturalExplorer3', name: 'Natural Explorer', level: 10, topic: 'naturalExplorer', when: notDeft, options: TERRAINS },
    fightingStyle(2, [S.archery, S.defense, S.dueling, S.twoWeapon, S.blind, S.druidic, S.thrown]),
    optional('spellcastingFocus', 'Spellcasting Focus', 2, 'Use a druidic focus for your ranger spells.'),
    replacement('primalAwareness', 'Primal Awareness', 3, "Primal Awareness (Tasha's)", 'Instead of sensing creature types: learn extra spells (Speak with Animals, Beast Sense and more at higher levels) that are always prepared, each free once per long rest.'),
    martialVersatility('ranger'),
    replacement('naturesVeil', 'Hide in Plain Sight', 10, "Nature's Veil", 'Instead of Hide in Plain Sight: as a bonus action, turn invisible until your next turn, a few times per long rest.', { uses: { count: 'pb', recharge: 'long' } }),
  ],
  rogue: [
    optional('steadyAim', 'Steady Aim', 3, "Bonus action: if you haven't moved, gain advantage on your next attack this turn, but you can't move."),
  ],
  sorcerer: [
    optional('sorcerousVersatility', 'Sorcerous Versatility', 4, 'When you gain an Ability Score Improvement, swap a Metamagic option or a cantrip.'),
    optional('magicalGuidance', 'Magical Guidance', 5, 'Spend 1 sorcery point to reroll a failed ability check.'),
  ],
  warlock: [
    optional('eldritchVersatility', 'Eldritch Versatility', 4, 'When you gain an Ability Score Improvement, swap a cantrip, your Pact Boon or (at 12th level) your Mystic Arcanum spell.'),
  ],
  wizard: [
    optional('cantripFormulas', 'Cantrip Formulas', 3, 'After a long rest, swap one wizard cantrip for another from your spellbook.'),
  ],
}

const expertise = (id: string, level: number, count: number, name = 'Expertise'): ClassPick => ({ id, name, level, kind: 'expertise', count })
const deft = { choice: 'naturalExplorer', option: 'deft-explorer' }

/** 2014 multi-picks, read by classPickSlots(). Rogue Expertise may also go to thieves' tools (noted in its why? text). */
export const CLASS_PICKS_2014: Record<string, ClassPick[]> = {
  bard: [expertise('expertise', 3, 2), expertise('expertise10', 10, 2)],
  rogue: [expertise('expertise', 1, 2), expertise('expertise6', 6, 2)],
  ranger: [
    { ...expertise('deftExplorer', 1, 1, 'Deft Explorer'), when: deft },
    { id: 'deftExplorerLanguages', name: 'Deft Explorer', level: 1, kind: 'language', count: 2, when: deft },
  ],
}

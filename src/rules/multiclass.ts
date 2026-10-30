import type { Character } from '../model/character'
import { getAbilityMods, getAbilityScores } from './abilities'
import { classChoices, featProficiencies, type FeatInput } from './choices'
import { classById } from './data/classes'
import {
  MULTICLASS_PREREQS, MULTICLASS_PROFICIENCIES, MULTICLASS_PROFICIENCIES_2024, NON_STACKING_FEATURES, NON_STACKING_RESOURCES, type MulticlassPrereq,
} from './data/multiclass'
import { rulesEdition } from './edition'
import { activeSubclasses } from './subclass'
import type { Abilities, Ability, ArmorCategory, ClassDef, WeaponCategory } from './types'

// Multiclassing (SRD 5.1 and 5.2): prerequisites, limited proficiencies, caster level and warnings.

type Classes = Pick<Character, 'classes'> & Partial<Pick<Character, 'rulesEdition' | 'customSubclasses'>>

/** The fields multiclass rules read; a builder draft has them too. */
export type MulticlassInput = Pick<Character, 'classes' | 'baseAbilities' | 'raceId' | 'subraceId' | 'freeAbilityBonuses'> &
  Partial<Pick<Character, 'rulesEdition' | 'backgroundId' | 'customBackground' | 'racialBonusTargets' | 'improvements' | 'originFeatId' | 'customOriginFeat' | 'featureChoices'>>

export const MAX_CHARACTER_LEVEL = 20

const classesOf = (c: Classes) =>
  c.classes.flatMap(cl => {
    const def = classById(cl.classId, rulesEdition(c))
    return def ? [{ def, level: cl.level }] : []
  })

const isMulticlass = (c: Classes) => classesOf(c).length > 1

const minimums = (p: Partial<Abilities>) => Object.entries(p) as [Ability, number][]

/** SRD minimums, or the ones a homebrew class sets. */
const prereqOf = (classId: string): MulticlassPrereq => MULTICLASS_PREREQS[classId] ?? { all: classById(classId)?.multiclass?.prereq }

/** "STR 13 and CHA 13", "STR 13 or DEX 13". */
export function prereqLabel(classId: string): string {
  const p = prereqOf(classId)
  const fmt = (list: [Ability, number][]) => list.map(([a, n]) => `${a.toUpperCase()} ${n}`)
  return [fmt(minimums(p.all ?? {})).join(' and '), fmt(minimums(p.any ?? {})).join(' or ')].filter(Boolean).join(', ')
}

export function meetsPrereq(classId: string, scores: Abilities): boolean {
  const p = prereqOf(classId)
  const all = minimums(p.all ?? {}).every(([a, n]) => scores[a] >= n)
  const any = minimums(p.any ?? {})
  return all && (any.length === 0 || any.some(([a, n]) => scores[a] >= n))
}

/** Why `classId` can't be added as a new class (empty when it can). Checks the new class and every current one. */
export function addClassIssues(c: MulticlassInput, classId: string): string[] {
  const def = classById(classId, rulesEdition(c))
  if (!def) return ['Unknown class.']
  if (c.classes.some(cl => cl.classId === classId)) return [`Already a ${def.name}.`]
  const out: string[] = []
  const level = c.classes.reduce((n, cl) => n + cl.level, 0)
  if (level >= MAX_CHARACTER_LEVEL) out.push(`Already at level ${MAX_CHARACTER_LEVEL}.`)
  const scores = getAbilityScores(c)
  for (const d of [...classesOf(c).map(x => x.def), def]) {
    if (!meetsPrereq(d.id, scores)) out.push(`${d.name} needs ${prereqLabel(d.id)}.`)
  }
  return out
}

/** Armor and weapon proficiencies: the first class in full, later classes only their multiclass grant, plus class choices (Divine Order). */
export function getProficiencies(c: Classes & FeatInput) {
  const armor = new Set<ArmorCategory>()
  const weapons = new Set<WeaponCategory>()
  const weaponIds = new Set<string>()
  const grants = rulesEdition(c) === '2024' ? MULTICLASS_PROFICIENCIES_2024 : MULTICLASS_PROFICIENCIES
  classesOf(c).forEach(({ def }, i) => {
    const grant: Pick<ClassDef, 'armor' | 'weapons' | 'weaponIds'> = i === 0 ? def : (grants[def.id] ?? def.multiclass ?? def)
    grant.armor.forEach(a => armor.add(a))
    grant.weapons.forEach(w => weapons.add(w))
    grant.weaponIds?.forEach(id => weaponIds.add(id))
  })
  for (const { subclass } of activeSubclasses(c)) {
    subclass.armor?.forEach(a => armor.add(a))
    subclass.weapons?.forEach(w => weapons.add(w))
  }
  for (const { picked } of classChoices(c)) {
    picked?.armor?.forEach(a => armor.add(a))
    picked?.weapons?.forEach(w => weapons.add(w))
  }
  const fromFeats = featProficiencies(c)
  fromFeats.armor.forEach(a => armor.add(a))
  fromFeats.weapons.forEach(w => weapons.add(w))
  return { armor, weapons, weaponIds }
}

export interface CasterLevel {
  /** Level used on the full-caster slot table. */
  casterLevel: number
  /** `rounding` is set for half casters. */
  parts: { classId: string; className: string; level: number; counts: number; rounding?: 'up' | 'down' }[]
  /** Human-readable math, e.g. "Wizard 5 + Paladin 4 ÷ 2 = 7". */
  explanation: string
}

/**
 * Shared spell slot caster level. Pact magic is separate. 2014: a single half caster uses its own table (rounds up
 * from level 2); multiclassed half casters round down. 2024: half casters always round up and cast from level 1.
 * One-third casters (homebrew) work the same way, from level 3.
 */
export function getCasterLevel(c: Classes): CasterLevel {
  const casters = classesOf(c).filter(x => x.def.caster === 'full' || x.def.caster === 'half' || x.def.caster === 'third')
  const single = rulesEdition(c) === '2024' || (casters.length === 1 && casters[0].def.caster !== 'full')
  // The Artificer always rounds up and casts from level 1.
  const up = (def: ClassDef) => single || !!def.roundsUp
  const parts = casters.map(({ def, level }) => {
    const by = def.caster === 'third' ? 3 : 2
    const from = def.caster === 'third' ? 3 : rulesEdition(c) === '2024' || def.roundsUp ? 1 : 2
    return {
      classId: def.id,
      className: def.name,
      level,
      rounding: def.caster === 'full' ? undefined : up(def) ? 'up' as const : 'down' as const,
      counts: def.caster === 'full' ? level : up(def) ? (level >= from ? Math.ceil(level / by) : 0) : Math.floor(level / by),
    }
  })
  const casterLevel = Math.min(MAX_CHARACTER_LEVEL, parts.reduce((n, p) => n + p.counts, 0))
  const terms = casters.map(({ def, level }) =>
    def.caster === 'full' ? `${def.name} ${level}` : `${def.name} ${level} ÷ ${def.caster === 'third' ? 3 : 2} (round ${up(def) ? 'up' : 'down'})`)
  const explanation = casters.length === 0 ? 'No spell slots.' : `${terms.join(' + ')} = caster level ${casterLevel}`
  return { casterLevel, parts, explanation }
}

/** Save DC and attack bonus for each spellcasting class, since multiclass casters use each class's own ability. */
export function getSpellcastingByClass(c: MulticlassInput & Pick<Character, 'classes'>) {
  const mods = getAbilityMods(getAbilityScores(c))
  const level = c.classes.reduce((n, cl) => n + cl.level, 0)
  const prof = 2 + Math.floor((Math.max(1, level) - 1) / 4)
  return classesOf(c).flatMap(({ def }) => {
    const ability = def.spellAbility
    if (!ability) return []
    return [{
      className: def.name,
      ability,
      saveDc: 8 + prof + mods[ability],
      attackBonus: prof + mods[ability],
      slots: def.caster === 'pact' ? ('pact' as const) : ('shared' as const),
    }]
  })
}

/** Rule reminders for a multiclassed character. Empty for a single class. */
export function multiclassWarnings(c: MulticlassInput): string[] {
  if (!isMulticlass(c)) return []
  const out: string[] = []
  const classes = classesOf(c)
  const level = classes.reduce((n, x) => n + x.level, 0)
  if (level > MAX_CHARACTER_LEVEL) out.push(`Total level ${level} is over ${MAX_CHARACTER_LEVEL}.`)

  const scores = getAbilityScores(c)
  const unmet = classes.filter(({ def }) => !meetsPrereq(def.id, scores))
  for (const { def } of unmet) out.push(`Multiclass prerequisite not met: ${def.name} needs ${prereqLabel(def.id)}.`)

  for (const feature of NON_STACKING_FEATURES) {
    const from = classes.filter(({ def, level: l }) => def.features.some(f => f.name === feature && f.level <= l))
    if (from.length > 1) out.push(`${feature} from ${from.map(x => x.def.name).join(' and ')} doesn't stack: you only get it once.`)
  }

  const mods = getAbilityMods(scores)
  for (const id of NON_STACKING_RESOURCES) {
    const from = classes.filter(({ def, level: l }) => def.resources.some(r => r.id === id && r.max(l, mods) > 0))
    const name = from[0]?.def.resources.find(r => r.id === id)?.name
    if (from.length > 1) out.push(`${name} from ${from.map(x => x.def.name).join(' and ')} adds options, not extra uses.`)
  }

  const shared = classes.filter(x => x.def.caster === 'full' || x.def.caster === 'half' || x.def.caster === 'third')
  const pact = classes.find(x => x.def.caster === 'pact')
  if (shared.length > 1) out.push('Prepare or learn spells for each class separately; slots are shared and can cast any of them.')
  if (pact && shared.length > 0) out.push('Pact Magic slots are separate from your other spell slots, but either kind can cast spells from both classes.')

  const skills = classes.slice(1).filter(({ def }) => MULTICLASS_PROFICIENCIES[def.id]?.skills)
  for (const { def } of skills) out.push(`Multiclassing into ${def.name} grants 1 extra skill: add it in your notes for now.`)
  return out
}

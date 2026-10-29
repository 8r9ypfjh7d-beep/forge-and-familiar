// Build planner: a character's route from the current level to 20. Pure, no React or storage.
// The plan only describes future levels; applying it gives a "what if" character to derive stats from.
import type { Feature } from '../content/types'
import type { Character, Improvement, PlannedLevel } from '../model/character'
import {
  ABILITIES, MAX_CHARACTER_LEVEL, addClassIssues, classById, derive, getAbilityScores, rulesEdition, totalLevel,
  type DerivedStats,
} from '../rules'

export type Need = 'subclass' | 'asi' | 'abilityCap'

/** One level of the route, with what it brings compared to the level before. */
export interface PlanStep {
  /** Character level after this step. */
  level: number
  entry: PlannedLevel
  /** Level in the class that takes this step. */
  classLevel: number
  /** That class's subclass after this step, if one is picked by now. */
  subclassId?: string
  /** True when this step adds a class the character didn't have. */
  newClass: boolean
  /** This class level is where its subclass is chosen. */
  subclassDue: boolean
  /** This class level grants an Ability Score Improvement (or a feat). */
  asiDue: boolean
  stats: DerivedStats
  hpGain: number
  /** Features gained at this step, by name. */
  features: { name: string; className: string }[]
  /** Proficiency bonus went up. */
  profUp: boolean
  /** Highest spell slot level went up (0 = no slots). */
  newSlotLevel?: number
  /** Multiclass prerequisite problems, in English (rules-engine text). */
  issues: string[]
  /** Picks this step still needs. */
  needs: Need[]
}

/** Highest spell slot level, counting pact slots. */
export function topSlotLevel(stats: Pick<DerivedStats, 'spellSlots'>): number {
  const { slots, pact } = stats.spellSlots
  let top = 0
  slots.forEach((n, i) => { if (n > 0) top = i + 1 })
  return Math.max(top, pact?.count ? pact.level : 0)
}

/** The plan's entries above the current level, one per level, in order. Gaps take the class of the level before. */
export function routeFor(c: Character, plan: PlannedLevel[] = c.levelPlan ?? []): PlannedLevel[] {
  const out: PlannedLevel[] = []
  let classId = c.classes[0]?.classId
  if (!classId) return out
  for (let level = totalLevel(c) + 1; level <= MAX_CHARACTER_LEVEL; level++) {
    const entry = plan.find(p => p.level === level)
    if (entry) classId = entry.classId
    out.push(entry ?? { level, classId })
  }
  return out
}

/** Applies one planned level: the class gains a level, and takes the planned subclass and ASI when due. */
export function applyLevel(c: Character, entry: PlannedLevel): Character {
  const edition = rulesEdition(c)
  const def = classById(entry.classId, edition)
  const has = c.classes.some(cl => cl.classId === entry.classId)
  const classes = has
    ? c.classes.map(cl => (cl.classId === entry.classId ? { ...cl, level: cl.level + 1 } : cl))
    : [...c.classes, { classId: entry.classId, level: 1 }]
  const cl = classes.find(x => x.classId === entry.classId)!
  if (def && cl.level === def.subclassLevel && entry.subclassId) cl.subclassId = entry.subclassId
  let improvements = c.improvements
  if (def?.asiLevels.includes(cl.level) && (entry.featId || entry.abilities)) {
    const imp: Improvement = { classId: entry.classId, level: cl.level, ...(entry.featId ? { featId: entry.featId } : { abilities: entry.abilities }) }
    improvements = [...(c.improvements ?? []).filter(i => i.classId !== imp.classId || i.level !== imp.level), imp]
  }
  return { ...c, classes, improvements }
}

/** The character as it would be at `level` if it follows the plan. */
export function planAt(c: Character, level: number, plan?: PlannedLevel[]): Character {
  return routeFor(c, plan).filter(e => e.level <= level).reduce(applyLevel, c)
}

const plusTotal = (a: PlannedLevel['abilities']) => Object.values(a ?? {}).reduce((n, v) => n + (v ?? 0), 0)

/** Every step of the route to 20 with its stats and what it adds. */
export function planSteps(c: Character, plan?: PlannedLevel[]): PlanStep[] {
  const edition = rulesEdition(c)
  let before = c
  let prev = derive(c)
  return routeFor(c, plan).map(entry => {
    const def = classById(entry.classId, edition)
    const newClass = !before.classes.some(cl => cl.classId === entry.classId)
    const issues = newClass ? addClassIssues(before, entry.classId) : []
    const after = applyLevel(before, entry)
    const taken = after.classes.find(cl => cl.classId === entry.classId)
    const classLevel = taken?.level ?? 1
    const stats = derive(after)
    const seen = new Set(prev.features.map(f => `${f.className}|${f.name}`))
    const subclassDue = !!def && classLevel === def.subclassLevel
    const asiDue = !!def?.asiLevels.includes(classLevel)
    const needs: Need[] = []
    if (subclassDue && !entry.subclassId) needs.push('subclass')
    if (asiDue && !entry.featId && plusTotal(entry.abilities) !== 2) needs.push('asi')
    // Item effects (a belt) are left out: the 20 cap is on the scores themselves.
    const scores = getAbilityScores({ ...before, inventory: [] })
    if (asiDue && !entry.featId && ABILITIES.some(a => scores[a] + (entry.abilities?.[a] ?? 0) > 20)) needs.push('abilityCap')
    const top = topSlotLevel(stats)
    const step: PlanStep = {
      level: entry.level,
      entry,
      classLevel,
      subclassId: taken?.subclassId,
      newClass,
      subclassDue,
      asiDue,
      stats,
      hpGain: stats.maxHp - prev.maxHp,
      features: stats.features.filter(f => !seen.has(`${f.className}|${f.name}`)).map(f => ({ name: f.name, className: f.className })),
      profUp: stats.proficiencyBonus > prev.proficiencyBonus,
      newSlotLevel: top > topSlotLevel(prev) ? top : undefined,
      issues,
      needs,
    }
    before = after
    prev = stats
    return step
  })
}

/** Sets (or replaces) the entry for one level. Later levels that followed the old class keep their own entries. */
export function setEntry(c: Character, entry: PlannedLevel): PlannedLevel[] {
  const current = totalLevel(c)
  const keep = (c.levelPlan ?? []).filter(p => p.level > current && p.level !== entry.level)
  return [...keep, entry].sort((a, b) => a.level - b.level)
}

/** Changes the class of one level; picks tied to the old class are dropped. */
export function setClass(c: Character, level: number, classId: string): PlannedLevel[] {
  const route = routeFor(c)
  // Fix the levels after it to their current class, so changing one level doesn't move the rest.
  const pinned = route.filter(e => e.level > level && !(c.levelPlan ?? []).some(p => p.level === e.level))
  const withRest = { ...c, levelPlan: [...(c.levelPlan ?? []), ...pinned] }
  return setEntry(withRest, { level, classId })
}

/** Fills every level up to 20 with one class (keeps nothing of the old plan). */
export function fillWith(c: Character, classId: string): PlannedLevel[] {
  const out: PlannedLevel[] = []
  for (let level = totalLevel(c) + 1; level <= MAX_CHARACTER_LEVEL; level++) out.push({ level, classId })
  return out
}

/**
 * Content-library features a step gains (all 20 levels, both editions), with their rules text.
 * Feature options (one Fighting Style), the ASI entry (the step asks for it) and subclass placeholders are left out.
 */
export function stepLibraryFeatures(all: Feature[], step: Pick<PlanStep, 'entry' | 'classLevel' | 'subclassId'>): Feature[] {
  return all.filter(f =>
    f.classId === step.entry.classId && f.level === step.classLevel && !f.parentId &&
    (!f.subclassId || f.subclassId === step.subclassId) && !/^Ability Score Improvement/.test(f.name) &&
    // Once a subclass is planned its own features replace "Martial Archetype feature" / "Fighter Subclass" placeholders.
    !(step.subclassId && / (feature|Subclass)$/.test(f.name)),
  )
}

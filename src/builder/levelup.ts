// Level Up: one more level, asking only for what that level brings. Pure, no React or storage.
import type { Character } from '../model/character'
import { XP_THRESHOLDS, derive, hpRollKey, improvementSlots, totalLevel, type CharacterDraft } from '../rules'
import { followPlan, routeFor } from '../planner/plan'
import { applyEdit, draftFrom } from './edit'
import type { Translate } from '../i18n/translate'
import { STEP_IDS, stepIssues, type StepId, type Term } from './validate'

/** XP the next level needs, or undefined at 20. */
export const xpForLevelUp = (c: Character) => XP_THRESHOLDS[totalLevel(c)]

/** The class the next level goes to: the build plan's pick for that level, else the first class. */
export function nextClass(c: Character): { classId: string; planned: boolean } {
  const level = totalLevel(c) + 1
  const planned = c.levelPlan?.some(p => p.level === level) ?? false
  return { classId: routeFor(c)[0]?.classId ?? c.classes[0]?.classId ?? '', planned }
}

/** The draft one level up in `classId` (a class the character doesn't have starts at 1). The build plan's picks fill in. */
export function levelUpDraft(c: Character, classId: string): CharacterDraft {
  const before = draftFrom(c)
  const has = before.classes.some(cl => cl.classId === classId)
  const classes = has
    ? before.classes.map(cl => (cl.classId === classId ? { ...cl, level: cl.level + 1 } : cl))
    : [...before.classes, { classId, level: 1 }]
  return followPlan(c, before, { ...before, classes })
}

/** The class and class level that the level-up adds. */
export function gainedLevel(c: Character, draft: CharacterDraft): { classId: string; level: number } | undefined {
  for (const cl of draft.classes) {
    const was = c.classes.find(x => x.classId === cl.classId)?.level ?? 0
    if (cl.level > was) return { classId: cl.classId, level: cl.level }
  }
  return undefined
}

/** Sets (or clears, with undefined) the rolled hit points of the gained level. */
export function withHpRoll(c: Character, draft: CharacterDraft, roll: number | undefined): CharacterDraft {
  const gained = gainedLevel(c, draft)
  if (!gained) return draft
  const hpRolls = { ...draft.hpRolls }
  const key = hpRollKey(gained.classId, gained.level)
  if (roll === undefined) delete hpRolls[key]
  else hpRolls[key] = roll
  return { ...draft, hpRolls }
}

/** ASI or feat slots this level opens. */
export function newImprovementSlots(c: Character, draft: CharacterDraft) {
  const had = new Set(improvementSlots(c).map(s => `${s.classId}.${s.level}`))
  return improvementSlots(draft).filter(s => !had.has(`${s.classId}.${s.level}`))
}

export interface LevelGain {
  level: number
  hp: number
  features: { name: string; className: string; text?: string }[]
  profUp: boolean
  /** The finished character, for the summary and saving. */
  after: Character
}

/** What the level gives: hit points, new features, a higher proficiency bonus. */
export function levelGain(c: Character, draft: CharacterDraft): LevelGain {
  const after = applyEdit(c, draft)
  const was = derive(c)
  const now = derive(after)
  const seen = new Set(was.features.map(f => `${f.className}|${f.name}`))
  return {
    level: totalLevel(after),
    hp: now.maxHp - was.maxHp,
    features: now.features.filter(f => !seen.has(`${f.className}|${f.name}`)).map(f => ({ name: f.name, className: f.className, text: f.text })),
    profUp: now.proficiencyBonus > was.proficiencyBonus,
    after,
  }
}

/**
 * Builder problems the level-up brings (a subclass or spell still to pick). Problems the character already had
 * stay out, so an old gap never blocks levelling up; the full editor still shows them.
 */
export function newIssues(c: Character, draft: CharacterDraft, t?: Translate, term?: Term): { step: StepId; message: string }[] {
  const old = draftFrom(c)
  return STEP_IDS.flatMap(step => {
    const before = new Set(stepIssues(step, old, t, term))
    return stepIssues(step, draft, t, term).filter(m => !before.has(m)).map(message => ({ step, message }))
  })
}

// Warlock Eldritch Invocations and Pact Boons: registers the official lists (data/books/invocations.ts) with the
// class options registry, counts the picks a class level allows, and checks prerequisites. Prerequisites only warn.
import type { Character } from '../model/character'
import { classOptionById, pickedClassOptions, registerClassOptions, type ClassOption, type ClassOptionKind } from './classOptions'
import { INVOCATIONS, INVOCATIONS_2024, PACT_BOONS } from './data/books/invocations'
import { featById } from './data/feats'
import { rulesEdition } from './edition'
import type { Feat, RulesEdition } from './types'

registerClassOptions('invocations', [...PACT_BOONS, ...INVOCATIONS, ...INVOCATIONS_2024])

type Owner = Partial<Pick<Character, 'rulesEdition' | 'classes' | 'classOptions'>>

/** [class level, picks known] steps per class and kind. */
const SLOTS: Record<RulesEdition, Record<string, Partial<Record<ClassOptionKind, [number, number][]>>>> = {
  '2014': { warlock: { invocation: [[2, 2], [5, 3], [7, 4], [9, 5], [12, 6], [15, 7], [18, 8]], pactBoon: [[3, 1]] } },
  '2024': { warlock: { invocation: [[1, 1], [2, 3], [5, 5], [7, 6], [9, 7], [12, 8], [15, 9], [18, 10]] } },
}

const classLevel = (c: Owner, classId: string) => c.classes?.find(cl => cl.classId === classId)?.level ?? 0

/** How many options of a kind the class level allows (Eldritch Invocations known). */
export function optionSlots(c: Owner, classId: string, kind: ClassOptionKind): number {
  const level = classLevel(c, classId)
  return (SLOTS[rulesEdition(c)][classId]?.[kind] ?? []).reduce((n, [from, v]) => (level >= from ? v : n), 0)
}

/** Kinds a class picks now, with how many its level allows. */
export const optionKindsFor = (c: Owner, classId: string): { kind: ClassOptionKind; count: number }[] =>
  Object.keys(SLOTS[rulesEdition(c)][classId] ?? {}).map(kind => ({ kind, count: optionSlots(c, classId, kind) })).filter(x => x.count > 0)

export type OptionIssue = { kind: 'level'; level: number } | { kind: 'requires'; names: string[] }

/** Why an option doesn't fit yet: class level too low or a required option not picked. */
export function optionIssues(c: Owner, option: ClassOption, classId: string): OptionIssue[] {
  const out: OptionIssue[] = []
  if (option.minLevel && classLevel(c, classId) < option.minLevel) out.push({ kind: 'level', level: option.minLevel })
  const have = new Set((c.classOptions ?? []).map(p => p.id))
  const missing = (option.requires ?? []).filter(id => !have.has(id)).map(id => classOptionById(id, rulesEdition(c))?.name ?? id)
  if (missing.length) out.push({ kind: 'requires', names: missing })
  return out
}

/** Warnings for derive(): unmet prerequisites and more picks than the class level allows. */
export function classOptionWarnings(c: Owner): string[] {
  const out: string[] = []
  for (const { pick, option } of pickedClassOptions(c)) {
    if (!pick.classId || !(option.kind === 'invocation' || option.kind === 'pactBoon')) continue
    for (const issue of optionIssues(c, option, pick.classId)) {
      out.push(issue.kind === 'level' ? `${option.name} needs class level ${issue.level}.` : `${option.name} needs ${issue.names.join(', ')}.`)
    }
  }
  for (const cl of c.classes ?? []) {
    for (const kind of Object.keys(SLOTS[rulesEdition(c)][cl.classId] ?? {})) {
      const picked = (c.classOptions ?? []).filter(p => p.kind === kind && p.classId === cl.classId).length
      const max = optionSlots(c, cl.classId, kind)
      if (picked > max) out.push(`${picked} ${kind === 'pactBoon' ? 'Pact Boons' : 'Eldritch Invocations'} picked; class level ${cl.level} allows ${max}.`)
    }
  }
  return out
}

/** Origin feats taken through an option (2024 Lessons of the First Ones). */
export const classOptionFeats = (c: Owner): Feat[] =>
  pickedClassOptions(c).flatMap(({ pick, option }) => {
    const f = option.choiceKind === 'originFeat' && pick.choice ? featById(pick.choice, rulesEdition(c)) : undefined
    return f ? [f] : []
  })

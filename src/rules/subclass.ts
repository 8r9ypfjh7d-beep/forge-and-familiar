// Which subclass each of a character's classes has, including the player's own custom subclass, and what it adds.
import type { Character, ClassLevel } from '../model/character'
import { classById } from './data/classes'
import { CUSTOM_SUBCLASS, currentSubclassId, subclassById, type SubclassDef } from './data/subclasses'
import { rulesEdition } from './edition'
import type { ItemEffect, SubclassData, SubclassFeature } from './types'

type Owner = Partial<Pick<Character, 'rulesEdition' | 'customSubclasses'>>

/** The class entry's subclass: an official or homebrew one, or the character's custom one. */
export function subclassOf(c: Owner, cl: Pick<ClassLevel, 'classId' | 'subclassId'>): SubclassDef | undefined {
  if (!cl.subclassId) return undefined
  if (cl.subclassId === CUSTOM_SUBCLASS) {
    const own = c.customSubclasses?.find(s => s.classId === cl.classId)
    return own ? { ...own, id: CUSTOM_SUBCLASS } : undefined
  }
  const sub = subclassById(cl.subclassId, rulesEdition(c))
  return sub?.classId === cl.classId ? sub : undefined
}

/** The character with old subclass ids (2024 Bladesinging, Knowledge, Purple Dragon Knight) renamed to today's ids. Same object when nothing changed. */
export function migrateSubclassIds<C extends Owner & Partial<Pick<Character, 'classes' | 'levelPlan'>>>(c: C): C {
  const edition = rulesEdition(c)
  const renamed = <T extends { subclassId?: string }>(x: T): T =>
    x.subclassId && currentSubclassId(x.subclassId, edition) !== x.subclassId ? { ...x, subclassId: currentSubclassId(x.subclassId, edition) } : x
  const classes = c.classes?.map(renamed)
  const levelPlan = c.levelPlan?.map(renamed)
  const changed = classes?.some((x, i) => x !== c.classes![i]) || levelPlan?.some((x, i) => x !== c.levelPlan![i])
  return changed ? { ...c, ...(classes && { classes }), ...(levelPlan && { levelPlan }) } : c
}

/** Class entries whose saved subclass isn't found (homebrew not on this device, a removed id). The id is kept, never dropped. */
export const missingSubclasses = (c: Owner & Partial<Pick<Character, 'classes'>>): Pick<ClassLevel, 'classId' | 'subclassId'>[] =>
  (c.classes ?? []).filter(cl => cl.subclassId && !subclassOf(c, cl))

/** Subclasses already in play (the class reached its subclass level), with that class's level. */
export function activeSubclasses(c: Owner & Partial<Pick<Character, 'classes'>>): { classId: string; level: number; subclass: SubclassDef }[] {
  return (c.classes ?? []).flatMap(cl => {
    const sub = subclassOf(c, cl)
    const from = classById(cl.classId, rulesEdition(c))?.subclassLevel ?? 99
    return sub && cl.level >= from ? [{ classId: cl.classId, level: cl.level, subclass: sub }] : []
  })
}

/** Subclass features the character has now. */
export const subclassFeatures = (c: Owner & Partial<Pick<Character, 'classes'>>): { level: number; subclass: SubclassDef; feature: SubclassFeature }[] =>
  activeSubclasses(c).flatMap(({ level, subclass }) => subclass.features.filter(f => f.level <= level).map(feature => ({ level, subclass, feature })))

/** Sheet changes from subclass features, labelled with the feature name. */
export const subclassEffects = (c: Owner & Partial<Pick<Character, 'classes'>>): { source: string; effect: ItemEffect }[] =>
  subclassFeatures(c).flatMap(({ feature }) => (feature.effects ?? []).map(effect => ({ source: feature.name, effect })))

/** Sheet changes from class features (Diamond Soul, Feral Instinct, Primal Champion), labelled with the feature name. */
export const classEffects = (c: Owner & Partial<Pick<Character, 'classes'>>): { source: string; effect: ItemEffect }[] =>
  (c.classes ?? []).flatMap(cl => (classById(cl.classId, rulesEdition(c))?.features ?? [])
    .filter(f => f.level <= cl.level)
    .flatMap(f => (f.effects ?? []).map(effect => ({ source: f.name, effect }))))

/** Spell names a class's subclass adds at its level (always prepared). */
export function subclassSpellNames(c: Owner & Partial<Pick<Character, 'classes'>>, classId: string): string[] {
  const active = activeSubclasses(c).find(x => x.classId === classId)
  return active ? (active.subclass.spells ?? []).filter(s => s.level <= active.level).flatMap(s => s.names) : []
}

/** Lower-case slug used in resource ids. */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Resource id for a subclass feature's uses. Every class's custom subclass has the id `custom`, so its class is part of the id. */
export const subclassResourceId = (subclass: SubclassDef, feature: Pick<SubclassFeature, 'name'>) =>
  subclass.id === CUSTOM_SUBCLASS ? `sub:custom:${subclass.classId}:${slug(feature.name)}` : `sub:${subclass.id}:${slug(feature.name)}`

/** A blank custom subclass for a class. */
export const blankSubclass = (classId: string): SubclassData => ({ classId, name: '', features: [] })

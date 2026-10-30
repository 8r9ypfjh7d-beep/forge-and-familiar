// Which subclass each of a character's classes has, including the player's own custom subclass, and what it adds.
import type { Character, ClassLevel } from '../model/character'
import { classById } from './data/classes'
import { CUSTOM_SUBCLASS, subclassById, type SubclassDef } from './data/subclasses'
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

/** Spell names a class's subclass adds at its level (always prepared). */
export function subclassSpellNames(c: Owner & Partial<Pick<Character, 'classes'>>, classId: string): string[] {
  const active = activeSubclasses(c).find(x => x.classId === classId)
  return active ? (active.subclass.spells ?? []).filter(s => s.level <= active.level).flatMap(s => s.names) : []
}

/** Lower-case slug used in resource ids. */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** A blank custom subclass for a class. */
export const blankSubclass = (classId: string): SubclassData => ({ classId, name: '', features: [] })

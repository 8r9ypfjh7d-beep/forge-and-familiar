// Subclass pick lists: which lists a character's subclasses offer now, how many picks each allows and what is picked.
// The options live in the shared class options registry (origin 'subclass'), so homebrew options of the same kind show up too.
import type { Character } from '../model/character'
import { classOptions, registerClassOptions, type ClassOption, type ClassOptionPick } from './classOptions'
import { SUBCLASS_OPTIONS, SUBCLASS_PICK_LISTS } from './data/books/subclassPicks'
import { rulesEdition } from './edition'
import { CUSTOM_SUBCLASS } from './data/subclasses'
import { activeSubclasses, blankSubclass } from './subclass'
import type { SubclassPickList } from './types'

registerClassOptions('subclass', SUBCLASS_OPTIONS)

type Owner = Partial<Pick<Character, 'classes' | 'rulesEdition' | 'customSubclasses' | 'classOptions'>>

export interface ActivePickList {
  classId: string
  /** Class level of the picking class. */
  level: number
  subclassId: string
  list: SubclassPickList
  /** Picks the class level allows. */
  max: number
  /** Options this subclass can pick: its own, plus homebrew ones of the kind not tied to another class or subclass. */
  options: ClassOption[]
  picked: ClassOptionPick[]
}

/** Picks allowed at a class level. */
export const pickCount = (list: SubclassPickList, level: number) => list.count.reduce((n, [from, v]) => (level >= from ? v : n), 0)

/** The pick lists the character's subclasses offer at their current levels. */
export function subclassPickLists(c: Owner): ActivePickList[] {
  const edition = rulesEdition(c)
  return activeSubclasses(c).flatMap(({ classId, level, subclass }) =>
    SUBCLASS_PICK_LISTS.filter(l => l.subclassIds.includes(subclass.id) && (!l.edition || l.edition === edition)).flatMap(list => {
      const max = pickCount(list, level)
      if (max <= 0) return []
      const options = classOptions(list.kind, edition).filter(o =>
        (!o.subclassIds || o.subclassIds.includes(subclass.id)) && (!o.classIds || o.classIds.includes(classId)))
      const picked = (c.classOptions ?? []).filter(p => p.kind === list.kind && p.classId === classId)
      return [{ classId, level, subclassId: subclass.id, list, max, options, picked }]
    }))
}

/** Picks a class's subclass lists no longer offer (subclass or level changed), so the builder can drop them. */
export function stalePicks(c: Owner): ClassOptionPick[] {
  const lists = subclassPickLists(c)
  const subKinds = new Set(SUBCLASS_PICK_LISTS.map(l => l.kind))
  return (c.classOptions ?? []).filter(p => subKinds.has(p.kind) && !lists.some(l => l.classId === p.classId && l.list.kind === p.kind))
}

/**
 * Sets one class's subclass and drops the old subclass's list picks (maneuvers, runes...).
 * Picking Custom also starts a blank custom subclass for that class if it has none yet.
 */
export function setSubclass(c: Owner, classId: string, subclassId: string): Owner {
  const classes = (c.classes ?? []).map(cl => (cl.classId === classId ? { ...cl, subclassId } : cl))
  const stale = stalePicks({ ...c, classes })
  const needsBlank = subclassId === CUSTOM_SUBCLASS && !c.customSubclasses?.some(s => s.classId === classId)
  return {
    classes,
    ...(needsBlank ? { customSubclasses: [...(c.customSubclasses ?? []), blankSubclass(classId)] } : {}),
    ...(stale.length ? { classOptions: (c.classOptions ?? []).filter(p => !stale.includes(p)) } : {}),
  }
}

/** Toggles an option on a list: picks it, or drops it when already picked. */
export function togglePick(c: Owner, at: Pick<ActivePickList, 'classId' | 'level' | 'list' | 'max'>, id: string): ClassOptionPick[] {
  const all = c.classOptions ?? []
  const mine = (p: ClassOptionPick) => p.kind === at.list.kind && p.classId === at.classId
  if (all.some(p => mine(p) && p.id === id)) return all.filter(p => !(mine(p) && p.id === id))
  // A single-pick list swaps its pick instead of adding a second one.
  const kept = at.max === 1 ? all.filter(p => !mine(p)) : all
  return [...kept, { kind: at.list.kind, id, classId: at.classId, level: at.level }]
}

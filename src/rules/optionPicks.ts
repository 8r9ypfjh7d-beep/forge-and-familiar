// How many class options (Artificer Infusions, 2024 plans...) each class lets the character learn, and which ones it may pick.
import type { Character } from '../model/character'
import { classOptionById, classOptions, registerClassOptions, type ClassOption, type ClassOptionPick } from './classOptions'
import { ARTIFICER_INFUSIONS, ARTIFICER_PLANS } from './data/books/artificer'
import { classById } from './data/classes'
import { rulesEdition } from './edition'

// Registered here, not in the data file: classOptions.ts reaches the class data through subclass.ts.
registerClassOptions('artificer', [...ARTIFICER_INFUSIONS, ...ARTIFICER_PLANS])

type Owner = Pick<Character, 'classes'> & Partial<Pick<Character, 'rulesEdition' | 'classOptions'>>

export interface OptionPickSlot {
  classId: string
  /** Class level now. */
  level: number
  kind: string
  /** Feature that grants the picks ("Infuse Item"). */
  name: string
  /** How many the class knows at this level. */
  count: number
  /** The character's picks of this kind for this class that still resolve. */
  picked: { pick: ClassOptionPick; option: ClassOption }[]
}

/** Every option list the character's class levels unlock, with the picks made so far. */
export function optionPickSlots(c: Owner): OptionPickSlot[] {
  const edition = rulesEdition(c)
  return c.classes.flatMap(cl => (classById(cl.classId, edition)?.optionPicks ?? []).flatMap(p => {
    const count = p.counts.reduce((n, [from, v]) => (cl.level >= from ? v : n), 0)
    if (!count) return []
    const picked = (c.classOptions ?? []).filter(x => x.kind === p.kind && (x.classId ?? cl.classId) === cl.classId).flatMap(pick => {
      const option = classOptionById(pick.id, edition)
      return option ? [{ pick, option }] : []
    })
    return [{ classId: cl.classId, level: cl.level, kind: p.kind, name: p.name, count, picked }]
  }))
}

/** Options a slot may pick from: the edition's list for this class and subclass, unlocked by the class level. */
export function optionsFor(c: Owner, slot: Pick<OptionPickSlot, 'classId' | 'kind' | 'level'>): ClassOption[] {
  const subclassId = c.classes.find(cl => cl.classId === slot.classId)?.subclassId
  return classOptions(slot.kind, rulesEdition(c)).filter(o =>
    (!o.classIds?.length || o.classIds.includes(slot.classId))
    && (!o.subclassIds?.length || (!!subclassId && o.subclassIds.includes(subclassId)))
    && (o.minLevel ?? 0) <= slot.level)
}

/** Adds or removes one pick (the builder never blocks going over the count; it warns). */
export function toggleClassOption(c: Owner, slot: Pick<OptionPickSlot, 'classId' | 'kind' | 'level'>, id: string): ClassOptionPick[] {
  const list = c.classOptions ?? []
  const has = list.some(x => x.kind === slot.kind && x.id === id && (x.classId ?? slot.classId) === slot.classId)
  return has
    ? list.filter(x => !(x.kind === slot.kind && x.id === id && (x.classId ?? slot.classId) === slot.classId))
    : [...list, { kind: slot.kind, id, classId: slot.classId, level: slot.level }]
}

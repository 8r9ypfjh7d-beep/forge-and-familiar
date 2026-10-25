// Spell lists: every SRD 5.1 spell plus homebrew ones, and which a character can learn.
import type { Character } from '../model/character'
import { SPELLS } from './data/spells'
import type { Spell } from './types'

let homebrew: Spell[] = []

export function registerHomebrewSpells(list: Spell[]): void {
  const srd = new Set(SPELLS.map(s => s.id))
  homebrew = list.filter(s => !srd.has(s.id))
}

export const allSpells = (): Spell[] => [...SPELLS, ...homebrew]

export const spellById = (id: string): Spell | undefined => SPELLS.find(s => s.id === id) ?? homebrew.find(s => s.id === id)

/** True when one of the character's classes or subclasses has the spell on its list. */
export function onSpellList(c: Pick<Character, 'classes'>, s: Spell): boolean {
  return c.classes.some(cl => s.classes.includes(cl.classId) || (!!cl.subclassId && !!s.subclasses?.includes(cl.subclassId)))
}

/** The spells a character's classes can learn, cantrips first, then by level and name. */
export function spellsFor(c: Pick<Character, 'classes'>): Spell[] {
  return allSpells().filter(s => onSpellList(c, s)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

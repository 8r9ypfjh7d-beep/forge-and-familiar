// Which library spells the pin form offers: the character's own lists by default, or every spell.
import type { Spell } from '../content'
import { canTake, type SpellAccess } from '../spellbook/access'

/** Spells to offer, by level then name. With no access (non-casters, low levels) every spell is offered. */
export function pickableSpells(spells: Spell[], access: SpellAccess[], everyClass: boolean, query = ''): Spell[] {
  const q = query.trim().toLowerCase()
  return spells
    .filter(s => everyClass || access.length === 0 || access.some(a => canTake(s, a)))
    .filter(s => !q || s.name.toLowerCase().includes(q))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

/** Spells grouped by level, cantrips first. */
export function byLevel(spells: Spell[]): [number, Spell[]][] {
  const groups = new Map<number, Spell[]>()
  for (const s of spells) groups.set(s.level, [...(groups.get(s.level) ?? []), s])
  return [...groups.entries()].sort((a, b) => a[0] - b[0])
}

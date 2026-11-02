// Ready-made casters come with their spells on the sheet: the builder's "Suggest spells for me" picks
// (beginner-friendly, valid counts, a wizard's extra book spells unprepared), so Level Up only asks for
// what the new level adds. Without the spell library (offline, load error) the hero is saved without them.
import { suggestedSpells } from '../builder/suggestSpells'
import { loadKind } from '../content'
import type { Character } from '../model/character'
import { editionOf } from '../spellbook'

/** One entry per id, the bundled SRD one first, as in the builder. */
function firstById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Map<string, T>()
  for (const x of list) if (!seen.has(x.id)) seen.set(x.id, x)
  return [...seen.values()]
}

export async function withStarterSpells(c: Character): Promise<Character> {
  try {
    const edition = editionOf(c)
    const [spells, classes, subclasses] = await Promise.all([loadKind('spells', { edition }), loadKind('classes', { edition }), loadKind('subclasses', { edition })])
    const known = suggestedSpells(c, { spells: firstById(spells), classes: firstById(classes), subclasses })
    return known.length ? { ...c, spells: known } : c
  } catch {
    return c
  }
}

// Spells for a random character: an attack cantrip first, then a mix (something that hurts, something that heals, the rest at random).
// SRD spells only. Randomness stays here; pass a seeded rng in tests.
import { loadKind, type CharacterClass, type Edition, type Spell, type Subclass } from '../content'
import type { KnownSpell } from '../model/character'
import { getAbilityScores, type CharacterDraft } from '../rules'
import { availableSpells, sourceFor, spellAccess } from '../spellbook/access'
import { canPickExtra, extraKey, extraList, extraSources } from '../spellbook/extra'
import { pick, type Rng } from './names'

export interface SpellLibrary { spells: Spell[]; classes: CharacterClass[]; subclasses: Subclass[] }

/** The edition's SRD spells and class spell tables. */
export async function loadSpellLibrary(edition: Edition): Promise<SpellLibrary> {
  const sources = [sourceFor(edition)]
  const [spells, classes, subclasses] = await Promise.all([loadKind('spells', { sources }), loadKind('classes', { sources }), loadKind('subclasses', { sources })])
  return { spells, classes, subclasses }
}

/** Deals damage: an attack roll, a save or automatic (some SRD entries lack the save field). */
export const isAttackSpell = (s: Spell) => !!(s.damage?.byCharacterLevel || s.damage?.bySlotLevel)
const isHealing = (s: Spell) => !!s.healBySlotLevel

/** `count` spells from `pool` not in `taken`: one that deals damage first, one that heals when there's room for 3+, then any. */
function mix(pool: Spell[], count: number, rng: Rng, taken: Set<string>): Spell[] {
  const out: Spell[] = []
  const take = (list: Spell[]) => {
    const free = list.filter(s => !taken.has(s.id))
    if (!free.length || out.length >= count) return
    const s = pick(free, rng)
    out.push(s)
    taken.add(s.id)
  }
  take(pool.filter(isAttackSpell))
  if (count >= 3) take(pool.filter(isHealing))
  while (out.length < count && pool.some(s => !taken.has(s.id))) take(pool)
  return out
}

/** Cantrips and known, prepared or spellbook spells for each spellcasting class, plus race and feat spell picks. */
export function randomSpells(d: CharacterDraft, lib: SpellLibrary, rng: Rng = Math.random): KnownSpell[] {
  const out: KnownSpell[] = []
  for (const a of spellAccess(d, lib.classes, lib.subclasses, getAbilityScores(d), undefined, lib.spells)) {
    const pool = availableSpells(lib.spells, a).filter(s => !a.alwaysPrepared.includes(s.id))
    const taken = new Set<string>()
    const cantrips = mix(pool.filter(s => s.level === 0), a.cantrips, rng, taken)
    const leveled = a.maxLevel > 0 ? mix(pool.filter(s => s.level > 0), a.spellbook ?? a.limit, rng, taken) : []
    out.push(...[...cantrips, ...leveled].map(s => ({ id: s.id, classId: a.classId })))
  }
  for (const source of extraSources(d)) {
    const list = source.fixedList ?? (source.lists.length ? pick(source.lists, rng) : extraList(source))
    const pool = lib.spells.filter(s => canPickExtra(s, source, list))
    const taken = new Set(out.map(k => k.id))
    const picks = [...mix(pool.filter(s => s.level === 0), source.cantrips, rng, taken), ...mix(pool.filter(s => s.level > 0), source.spells, rng, taken)]
    out.push(...picks.map(s => ({ id: s.id, classId: extraKey(source, list) })))
  }
  return out
}

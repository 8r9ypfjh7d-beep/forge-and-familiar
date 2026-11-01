// "Suggest spells for me" on the builder's Spells step: fills the empty picks with spells that suit a new player.
// The player's own picks stay; core (SRD) spells come before book ones, and a short list of well-loved spells first.
import type { CharacterClass, Spell, Subclass } from '../content'
import type { KnownSpell } from '../model/character'
import { getAbilityScores, type CharacterDraft } from '../rules'
import { availableSpells, canPickExtra, extraKey, extraList, extraSources, spellAccess } from '../spellbook'

export interface SuggestLibrary { spells: Spell[]; classes: CharacterClass[]; subclasses: Subclass[] }

/** Spells that are easy to use and useful in most games, best first. A class only gets the ones on its list. */
export const BEGINNER_SPELLS = [
  // Cantrips: one reliable attack, then utility.
  'eldritch-blast', 'fire-bolt', 'sacred-flame', 'vicious-mockery', 'produce-flame', 'shillelagh', 'guidance',
  'mage-hand', 'light', 'minor-illusion', 'ray-of-frost', 'prestidigitation', 'spare-the-dying', 'thaumaturgy', 'druidcraft', 'mending',
  // 1st level: defence, healing, crowd control.
  'cure-wounds', 'healing-word', 'bless', 'magic-missile', 'shield', 'mage-armor', 'sleep', 'guiding-bolt', 'hex',
  'hunters-mark', 'faerie-fire', 'entangle', 'goodberry', 'thunderwave', 'shield-of-faith', 'charm-person', 'detect-magic',
  'armor-of-agathys', 'hellish-rebuke', 'dissonant-whispers', 'burning-hands', 'command', 'feather-fall', 'divine-favor',
  // 2nd level and up.
  'misty-step', 'hold-person', 'spiritual-weapon', 'scorching-ray', 'lesser-restoration', 'invisibility', 'moonbeam', 'web',
  'fireball', 'counterspell', 'spirit-guardians', 'revivify', 'hypnotic-pattern', 'fly', 'haste', 'mass-healing-word',
  'polymorph', 'banishment', 'greater-invisibility', 'dimension-door', 'wall-of-force', 'cone-of-cold', 'greater-restoration', 'raise-dead',
]
const RANK = new Map(BEGINNER_SPELLS.map((id, i) => [id, i]))

/** Best first: the beginner list, then core spells over book ones, higher level before lower, then by name. */
function byAdvice(a: Spell, b: Spell): number {
  const ra = RANK.get(a.id) ?? Infinity
  const rb = RANK.get(b.id) ?? Infinity
  if (ra !== rb) return ra - rb
  if (!a.book !== !b.book) return a.book ? 1 : -1
  return b.level - a.level || a.name.localeCompare(b.name)
}

/** The first `count` spells of `pool` (sorted by advice) not in `taken`; marks them taken. */
function take(pool: Spell[], count: number, taken: Set<string>): Spell[] {
  const out: Spell[] = []
  for (const s of [...pool].sort(byAdvice)) {
    if (out.length >= count) break
    if (taken.has(s.id)) continue
    out.push(s)
    taken.add(s.id)
  }
  return out
}

/** The draft's spells with every empty class, race and feat pick filled. Existing picks are kept. */
export function suggestedSpells(d: CharacterDraft, lib: SuggestLibrary): KnownSpell[] {
  const saved = d.spells ?? []
  const out = [...saved]
  const byId = new Map(lib.spells.map(s => [s.id, s]))
  for (const a of spellAccess(d, lib.classes, lib.subclasses, getAbilityScores(d), undefined, lib.spells)) {
    const mine = saved.filter(k => k.classId === a.classId).map(k => byId.get(k.id)).filter((s): s is Spell => !!s)
    const taken = new Set(mine.map(s => s.id))
    const pool = availableSpells(lib.spells, a).filter(s => !a.alwaysPrepared.includes(s.id))
    const cantrips = take(pool.filter(s => s.level === 0), a.cantrips - mine.filter(s => s.level === 0).length, taken)
    out.push(...cantrips.map(s => ({ id: s.id, classId: a.classId })))
    if (a.maxLevel === 0) continue
    const leveled = mine.filter(s => s.level > 0 && !a.alwaysPrepared.includes(s.id))
    const target = a.spellbook ?? a.limit
    let prepared = saved.filter(k => k.classId === a.classId && k.prepared !== false && (byId.get(k.id)?.level ?? 0) > 0 && !a.alwaysPrepared.includes(k.id)).length
    for (const s of take(pool.filter(s => s.level > 0), target - leveled.length, taken)) {
      // A wizard's book holds more spells than they prepare: the extra ones go in the book unprepared.
      const inBookOnly = a.spellbook != null && prepared >= a.limit
      if (!inBookOnly) prepared++
      out.push({ id: s.id, classId: a.classId, ...(inBookOnly ? { prepared: false } : {}) })
    }
  }
  for (const source of extraSources(d)) {
    const list = extraList(source, saved)
    const key = extraKey(source, list)
    const mine = saved.filter(k => k.classId === key).map(k => byId.get(k.id)).filter((s): s is Spell => !!s)
    const taken = new Set(out.map(k => k.id))
    const pool = lib.spells.filter(s => canPickExtra(s, source, list))
    const picks = [
      ...take(pool.filter(s => s.level === 0), source.cantrips - mine.filter(s => s.level === 0).length, taken),
      ...take(pool.filter(s => s.level > 0), source.spells - mine.filter(s => s.level > 0).length, taken),
    ]
    out.push(...picks.map(s => ({ id: s.id, classId: key })))
  }
  return out
}

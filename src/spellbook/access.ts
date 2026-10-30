// Which spells a character can take: per spellcasting class, the highest spell level, cantrips, and how many spells.
// Pure: reads the class tables from the content library, so 2014 and 2024 rules each use their own numbers.
import type { CharacterClass, Edition, Spell, Subclass } from '../content'
import type { Character } from '../model/character'
import { subclassSpellNames } from '../rules/subclass'
import type { Abilities, Ability } from '../rules/types'

export interface SpellAccess {
  classId: string
  className: string
  level: number
  subclassId?: string
  ability: Ability
  /** Highest spell level the class can learn now (0 = cantrips only). */
  maxLevel: number
  /** Cantrips the class knows at this level; 0 means it has none. */
  cantrips: number
  /** "known" classes pick a fixed list; "prepared" ones choose daily from their whole list. */
  kind: 'known' | 'prepared'
  /** Spells of level 1+ known or prepared. */
  limit: number
  /** Wizards: spells in the spellbook (6 at 1st level, +2 each level). They prepare `limit` of them each day. */
  spellbook?: number
  /** Subclass spells that are always prepared and don't count against the limit. */
  alwaysPrepared: string[]
}

export const DEFAULT_EDITION: Edition = '2014'
/** The character's spell rules: its own spell setting, else its rules edition. */
export const editionOf = (c: Pick<Character, 'spellEdition' | 'rulesEdition'>): Edition => c.spellEdition ?? c.rulesEdition ?? DEFAULT_EDITION
export const sourceFor = (edition: Edition) => (edition === '2024' ? 'srd-5.2' : 'srd-5.1')

/** Mystic Arcanum: one spell each of levels 6–9 at warlock levels 11, 13, 15, 17 (both editions). */
const ARCANUM: [number, number][] = [[17, 9], [15, 8], [13, 7], [11, 6]]

/** Spells in a wizard's spellbook from leveling alone: six at 1st level and two more each level (both editions). */
export const wizardSpellbook = (level: number) => 6 + 2 * (Math.min(level, 20) - 1)

const mod = (score: number) => Math.floor((score - 10) / 2)

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Spell access for each spellcasting class the character has. Classes the library has no table for
 * (homebrew) are left out. `scores` are final ability scores; `halfCasters` the class ids that halve
 * their level for 2014 prepared counts (Paladin). `spells` resolves the spells the rules engine's
 * subclasses list by name (patrons from other books, custom subclasses); names the library lacks are skipped.
 */
export function spellAccess(
  c: Pick<Character, 'classes'> & Partial<Pick<Character, 'rulesEdition' | 'customSubclasses'>>,
  classes: CharacterClass[],
  subclasses: Subclass[],
  scores: Abilities,
  halfCasters: string[] = ['paladin', 'ranger'],
  spells: Pick<Spell, 'id' | 'name'>[] = [],
): SpellAccess[] {
  const byName = new Map(spells.map(s => [norm(s.name), s.id]))
  const out: SpellAccess[] = []
  for (const cl of c.classes) {
    const def = classes.find(k => k.id === cl.classId)
    const row = def?.levels.find(l => l.level === Math.min(cl.level, 20))
    if (!def?.spellcasting || !row?.spellcasting || cl.level < def.spellcasting.fromLevel) continue
    const sc = row.spellcasting
    let maxLevel = sc.slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0)
    if (cl.classId === 'warlock') maxLevel = Math.max(maxLevel, ARCANUM.find(([lvl]) => cl.level >= lvl)?.[1] ?? 0)
    const ability = def.spellcasting.ability
    const kind = sc.spellsKnown != null ? 'known' : 'prepared'
    const prepared2014 = Math.max(1, mod(scores[ability]) + (halfCasters.includes(cl.classId) ? Math.floor(cl.level / 2) : cl.level))
    const limit = sc.spellsKnown ?? sc.preparedSpells ?? prepared2014
    const sub = subclasses.find(s => s.id === cl.subclassId && s.classId === cl.classId)
    out.push({
      classId: cl.classId,
      className: def.name,
      level: cl.level,
      ...(cl.subclassId ? { subclassId: cl.subclassId } : {}),
      ability,
      maxLevel,
      cantrips: sc.cantripsKnown ?? 0,
      kind,
      limit,
      ...(cl.classId === 'wizard' ? { spellbook: wizardSpellbook(cl.level) } : {}),
      alwaysPrepared: [...new Set([
        ...(sub?.spells ?? []).filter(s => s.level <= cl.level).map(s => s.spell.id),
        ...subclassSpellNames(c, cl.classId).flatMap(n => byName.get(norm(n)) ?? []),
      ])],
    })
  }
  return out
}

/** Whether a class can take this spell now: on its list (or its subclass's), and of a level it can cast. */
export function canTake(spell: Spell, a: SpellAccess): boolean {
  const onList = spell.classes.includes(a.classId) || (!!a.subclassId && spell.subclasses.includes(a.subclassId)) || a.alwaysPrepared.includes(spell.id)
  if (!onList) return false
  return spell.level === 0 ? a.cantrips > 0 : spell.level <= a.maxLevel
}

/** Every spell the class can take, by level then name. */
export const availableSpells = (spells: Spell[], a: SpellAccess) =>
  spells.filter(s => canTake(s, a)).sort((x, y) => x.level - y.level || x.name.localeCompare(y.name))

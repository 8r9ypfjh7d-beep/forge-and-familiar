// Which spells a character can take: per spellcasting class, the highest spell level, cantrips, and how many spells.
// Pure: reads the class tables from the content library, so 2014 and 2024 rules each use their own numbers.
import type { CharacterClass, Edition, Spell, Subclass } from '../content'
import { bookSourceFor } from '../content/books/sources'
import type { Character } from '../model/character'
import { bookSpellcasting } from '../rules/data/books/artificer'
import { classById } from '../rules/data/classes'
import { rulesEdition } from '../rules/edition'
import { classSpellNames, subclassSpellNames } from '../rules/subclass'
import type { Abilities, Ability, ClassDef } from '../rules/types'

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
  /**
   * Bard Magical Secrets. 2014: this many spells may come from any class's list (2 at 10, 14 and 18, and 2 more for
   * College of Lore at 6); they count as bard spells known. 2024: the cleric, druid and wizard lists join the bard's at 10.
   */
  secrets?: { count?: number; lists?: string[] }
  /** Subclass spells that are always prepared and don't count against the limit (not a 2014 warlock's: see `listed`). */
  alwaysPrepared: string[]
  /** Class whose spell list it learns from, when not its own (homebrew classes borrow one). */
  listClassId?: string
  /** Extra spell ids on the class's list: its own list for classes the library has no table for (Artificer), or a 2014 patron's expanded spells. */
  listed?: string[]
}

export const DEFAULT_EDITION: Edition = '2014'
/** The character's spell rules: its own spell setting, else its rules edition. */
export const editionOf = (c: Pick<Character, 'spellEdition' | 'rulesEdition'>): Edition => c.spellEdition ?? c.rulesEdition ?? DEFAULT_EDITION
export const sourceFor = (edition: Edition) => (edition === '2024' ? 'srd-5.2' : 'srd-5.1')
/** Where an edition's spells come from: its SRD, then the official book spells (summaries only). */
export const spellSourcesFor = (edition: Edition) => [sourceFor(edition), bookSourceFor(edition)]

/** Mystic Arcanum: one spell each of levels 6–9 at warlock levels 11, 13, 15, 17 (both editions). */
const ARCANUM: [number, number][] = [[17, 9], [15, 8], [13, 7], [11, 6]]

/** Spells in a wizard's spellbook from leveling alone: six at 1st level and two more each level (both editions). */
export const wizardSpellbook = (level: number) => 6 + 2 * (Math.min(level, 20) - 1)

/** Bard Magical Secrets for this class entry, if any. */
function magicalSecrets(cl: Character['classes'][number], edition: Edition): Pick<SpellAccess, 'secrets'> {
  if (cl.classId !== 'bard') return {}
  if (edition === '2024') return cl.level >= 10 ? { secrets: { lists: ['cleric', 'druid', 'wizard'] } } : {}
  const count = 2 * [10, 14, 18].filter(l => cl.level >= l).length + (cl.subclassId === 'lore' && cl.level >= 6 ? 2 : 0)
  return count ? { secrets: { count } } : {}
}

/** 2014 Magical Secrets picks: bard spells that aren't on the bard's own list. */
export const isSecret = (spell: Pick<Spell, 'classes'>, a: SpellAccess) => !!a.secrets?.count && !spell.classes.includes(a.classId)

const mod = (score: number) => Math.floor((score - 10) / 2)

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const step = (steps: [number, number][], level: number) => steps.reduce((n, [from, v]) => (level >= from ? v : n), 0)

/** A homebrew class's access, from its own casting rules (the library has no table for it). */
function homebrewAccess(def: ClassDef, level: number, scores: Abilities): Omit<SpellAccess, 'alwaysPrepared'> | undefined {
  const sc = def.spellcasting
  const ability = def.spellAbility
  if (!sc || !ability || def.caster === 'none') return undefined
  // Slot level from the class alone: full casters use their level, half and third casters a share of it, pact magic tops out at 5th.
  const own = def.caster === 'full' ? level : def.caster === 'half' ? Math.ceil(level / 2) : def.caster === 'third' ? (level >= 3 ? Math.ceil(level / 3) : 0) : level
  const maxLevel = def.caster === 'pact' ? Math.min(5, Math.ceil(level / 2)) : own > 0 ? Math.min(9, Math.ceil(own / 2)) : 0
  const share = def.caster === 'half' ? Math.floor(level / 2) : def.caster === 'third' ? Math.floor(level / 3) : level
  return {
    classId: def.id,
    className: def.name,
    level,
    ability,
    maxLevel,
    cantrips: step(sc.cantrips, level),
    kind: sc.kind,
    limit: sc.kind === 'known' ? step(sc.known, level) : Math.max(1, mod(scores[ability]) + share),
    ...(sc.list !== def.id ? { listClassId: sc.list } : {}),
  }
}

/** Spell names the books use where the SRD has another (normalized). Named versions ("Bigby's Hand") also try without the wizard's name. */
const ALIASES: Record<string, string> = {
  bigbyshand: 'arcanehand', mordenkainenssword: 'arcanesword', nystulsmagicaura: 'arcanistsmagicaura',
  brandingsmite: 'shiningsmite', shiningsmite: 'brandingsmite',
}

/** The id of a spell by any of its names, or undefined. */
export function spellIdByName(byName: Map<string, string>, name: string): string | undefined {
  const n = norm(name)
  return byName.get(n) ?? byName.get(ALIASES[n] ?? '') ?? byName.get(norm(name.replace(/^[^']+'s\s+/, '')))
}

/**
 * Spell access for each spellcasting class the character has. Homebrew classes the library has no table for
 * use their own casting rules (ClassDef.spellcasting). `scores` are final ability scores; `halfCasters` the class ids that halve
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
    if (!def) {
      const own = classById(cl.classId, rulesEdition(c))
      const book = bookSpellcasting(cl.classId, rulesEdition(c))
      if (own && book) {
        const ability = own.spellAbility ?? 'int'
        // Half caster from level 1 that rounds up: spell level 1 at 1, 2 at 5, 3 at 9, 4 at 13, 5 at 17.
        const level = Math.min(cl.level, 20)
        out.push({
          classId: cl.classId, className: own.name, level, ...(cl.subclassId ? { subclassId: cl.subclassId } : {}),
          ability, maxLevel: Math.min(5, Math.ceil(level / 4)), cantrips: book.cantrips.reduce((n, [from, v]) => (level >= from ? v : n), 0),
          kind: 'prepared', limit: book.prepared(level, mod(scores[ability])),
          alwaysPrepared: [...new Set(subclassSpellNames(c, cl.classId).flatMap(n => spellIdByName(byName, n) ?? []))],
          listed: book.list.flatMap(names => names.flatMap(n => spellIdByName(byName, n) ?? [])),
        })
        continue
      }
      const access = own && homebrewAccess(own, Math.min(cl.level, 20), scores)
      if (access) out.push({ ...access, ...(cl.subclassId ? { subclassId: cl.subclassId } : {}), alwaysPrepared: [...new Set(subclassSpellNames(c, cl.classId).flatMap(n => spellIdByName(byName, n) ?? []))] })
      continue
    }
    const row = def.levels.find(l => l.level === Math.min(cl.level, 20))
    if (!def.spellcasting || !row?.spellcasting || cl.level < def.spellcasting.fromLevel) continue
    const sc = row.spellcasting
    let maxLevel = sc.slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0)
    if (cl.classId === 'warlock') maxLevel = Math.max(maxLevel, ARCANUM.find(([lvl]) => cl.level >= lvl)?.[1] ?? 0)
    const ability = def.spellcasting.ability
    const kind = sc.spellsKnown != null ? 'known' : 'prepared'
    const prepared2014 = Math.max(1, mod(scores[ability]) + (halfCasters.includes(cl.classId) ? Math.floor(cl.level / 2) : cl.level))
    const limit = sc.spellsKnown ?? sc.preparedSpells ?? prepared2014
    const sub = subclasses.find(s => s.id === cl.subclassId && s.classId === cl.classId)
    const granted = [...new Set([
      ...(sub?.spells ?? []).filter(s => s.level <= cl.level).map(s => s.spell.id),
      ...subclassSpellNames(c, cl.classId).flatMap(n => spellIdByName(byName, n) ?? []),
    ])]
    // The class's own always-prepared spells (2024 Ranger's Hunter's Mark): never just "expanded".
    const fromClass = classSpellNames(c, cl.classId).flatMap(n => spellIdByName(byName, n) ?? [])
    // A 2014 patron's expanded spells only join the warlock's list; they still cost a spell known. 2024's are always prepared.
    const expandedOnly = cl.classId === 'warlock' && (def.edition ?? rulesEdition(c)) === '2014'
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
      ...magicalSecrets(cl, def.edition),
      ...(expandedOnly ? { alwaysPrepared: fromClass, listed: granted } : { alwaysPrepared: [...new Set([...granted, ...fromClass])] }),
    })
  }
  return out
}

/** Whether a class can take this spell now: on its list (or its subclass's), and of a level it can cast. */
export function canTake(spell: Spell, a: SpellAccess): boolean {
  const onList = spell.classes.includes(a.listClassId ?? a.classId) || !!a.listed?.includes(spell.id) || (!!a.subclassId && spell.subclasses.includes(a.subclassId)) || a.alwaysPrepared.includes(spell.id)
    || !!a.secrets?.lists?.some(l => spell.classes.includes(l)) || (!!a.secrets?.count && spell.classes.length > 0)
  if (!onList) return false
  return spell.level === 0 ? a.cantrips > 0 : spell.level <= a.maxLevel
}

/** Every spell the class can take, by level then name. */
export const availableSpells = (spells: Spell[], a: SpellAccess) =>
  spells.filter(s => canTake(s, a)).sort((x, y) => x.level - y.level || x.name.localeCompare(y.name))

// Spells that come from outside a class: race and lineage spells, and feats that teach spells (Magic Initiate).
// Pure: reads the rules engine's race, background and feat data and the content library's spells.
import type { Spell, SpellSchool } from '../content'
import type { Character, KnownSpell } from '../model/character'
import { activeImprovements, getBackground, itemSpellCast, raceProfile, rulesEdition } from '../rules'

type Input = Pick<Character, 'raceId' | 'classes' | 'backgroundId'> &
  Partial<Pick<Character, 'subraceId' | 'traitChoices' | 'rulesEdition' | 'customBackground' | 'originFeatId' | 'improvements' | 'spells'>>

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export interface GrantedSpell {
  spell: Spell
  /** The trait that grants it (or the race, subrace or picked option when the trait isn't named). */
  from: string
  /** Character level it arrives at. */
  atLevel: number
  unlocked: boolean
}

/**
 * Spells a race, subrace, lineage or trait pick gives for free: the same spell effects the sheet casts from
 * "From your items" (raceProfile().spells), so the builder and the sheet always agree. Names the library lacks are skipped.
 */
export function grantedSpells(c: Input, spells: Spell[]): GrantedSpell[] {
  const byName = new Map(spells.map(s => [norm(s.name), s]))
  const out: GrantedSpell[] = []
  for (const g of raceProfile(c).spells) {
    const spell = byName.get(norm(itemSpellCast(g.spell).name))
    if (spell && !out.some(x => x.spell.id === spell.id)) out.push({ spell, from: g.trait ?? g.source, atLevel: g.atLevel, unlocked: g.unlocked })
  }
  return out
}

/** What a spell-teaching feat or trait lets you pick. */
interface PickRule {
  /** Class spell lists to choose from; the player picks one. Empty means any list. */
  lists: string[]
  cantrips: number
  /** Spells of level 1 to `spellLevel`. */
  spells: number
  spellLevel: number
  /** Only these schools for the leveled picks. */
  schools?: SpellSchool[]
  /** Spells it always gives, by id. */
  fixed?: string[]
}

const CASTER_LISTS_2014 = ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard']

/** Feats (by id, any book) that teach spells. Feats the rules engine doesn't have yet never match. */
export const SPELL_FEATS: Record<string, { '2014': PickRule; '2024': PickRule }> = {
  'magic-initiate': {
    '2014': { lists: CASTER_LISTS_2014, cantrips: 2, spells: 1, spellLevel: 1 },
    '2024': { lists: ['cleric', 'druid', 'wizard'], cantrips: 2, spells: 1, spellLevel: 1 },
  },
  'fey-touched': {
    '2014': { lists: [], cantrips: 0, spells: 1, spellLevel: 1, schools: ['divination', 'enchantment'], fixed: ['misty-step'] },
    '2024': { lists: [], cantrips: 0, spells: 1, spellLevel: 1, schools: ['divination', 'enchantment'], fixed: ['misty-step'] },
  },
  'shadow-touched': {
    '2014': { lists: [], cantrips: 0, spells: 1, spellLevel: 1, schools: ['illusion', 'necromancy'], fixed: ['invisibility'] },
    '2024': { lists: [], cantrips: 0, spells: 1, spellLevel: 1, schools: ['illusion', 'necromancy'], fixed: ['invisibility'] },
  },
  'telekinetic': {
    '2014': { lists: [], cantrips: 0, spells: 0, spellLevel: 0, fixed: ['mage-hand'] },
    '2024': { lists: [], cantrips: 0, spells: 0, spellLevel: 0, fixed: ['mage-hand'] },
  },
  'telepathic': {
    '2014': { lists: [], cantrips: 0, spells: 0, spellLevel: 0, fixed: ['detect-thoughts'] },
    '2024': { lists: [], cantrips: 0, spells: 0, spellLevel: 0, fixed: ['detect-thoughts'] },
  },
}

/** Subraces whose trait is a spell pick: the 2014 High Elf's wizard cantrip. */
const RACE_PICKS: Record<string, PickRule> = {
  'high-elf': { lists: ['wizard'], cantrips: 1, spells: 0, spellLevel: 0 },
}

export interface ExtraSource extends PickRule {
  /** Saved as the `classId` prefix of its picks: `extra:<slot>:<list>`. */
  slot: string
  /** What grants it: a feat id, or the subrace id. */
  grantId: string
  kind: 'feat' | 'race'
  /** The list the book fixes (a background's "Magic Initiate (Cleric)"), if any. */
  fixedList?: string
}

/**
 * Every non-class source of spell picks the character has: a High Elf's cantrip, and spell feats from the
 * 2024 background, the Human's origin feat and Ability Score Improvements the levels have reached.
 */
export function extraSources(c: Input): ExtraSource[] {
  const edition = rulesEdition(c)
  const out: ExtraSource[] = []
  if (edition === '2014' && c.subraceId && RACE_PICKS[c.subraceId]) {
    out.push({ ...RACE_PICKS[c.subraceId], slot: 'race', grantId: c.subraceId, kind: 'race', fixedList: RACE_PICKS[c.subraceId].lists[0] })
  }
  const feat = (slot: string, id: string | undefined, note?: string) => {
    const rule = id ? SPELL_FEATS[id]?.[edition] : undefined
    if (!rule) return
    const fixedList = note && rule.lists.includes(note.toLowerCase()) ? note.toLowerCase() : undefined
    out.push({ ...rule, slot, grantId: id!, kind: 'feat', ...(fixedList ? { fixedList } : {}) })
  }
  if (edition === '2024') {
    const bg = getBackground(c)
    feat('bg', bg?.feat?.id, bg?.feat?.note)
  }
  feat('origin', c.originFeatId)
  for (const imp of activeImprovements({ classes: c.classes, improvements: c.improvements })) feat(`asi-${imp.classId}-${imp.level}`, imp.featId)
  return out
}

/** The saved `classId` for a pick from this source and list. */
export const extraKey = (source: Pick<ExtraSource, 'slot'>, list: string) => `extra:${source.slot}:${list}`

/** The list the source's picks use: the book's, else the one the saved picks name, else the first. */
export function extraList(source: ExtraSource, spells: KnownSpell[] = []): string {
  if (source.fixedList) return source.fixedList
  const saved = spells.find(s => s.classId.startsWith(`extra:${source.slot}:`))?.classId.split(':')[2]
  return saved ?? source.lists[0] ?? ''
}

/** Whether a spell can be picked through this source and list. */
export function canPickExtra(spell: Spell, source: ExtraSource, list: string): boolean {
  if (source.fixed?.includes(spell.id)) return false
  if (list && !spell.classes.includes(list)) return false
  if (spell.level === 0) return source.cantrips > 0
  if (spell.level > source.spellLevel || source.spells === 0) return false
  return !source.schools || source.schools.includes(spell.school)
}

/** Spells saved through a non-class source. */
export const isExtraSpell = (k: KnownSpell) => k.classId.startsWith('extra:')

/**
 * Drops saved spells whose class or extra source the character no longer has, so changing a class or a feat
 * in the builder leaves no hidden picks behind.
 */
export function keepValidSpells(c: Input): KnownSpell[] {
  const classIds = new Set(c.classes.map(cl => cl.classId))
  const slots = new Set(extraSources(c).map(s => s.slot))
  return (c.spells ?? []).filter(k => (isExtraSpell(k) ? slots.has(k.classId.split(':')[1]) : classIds.has(k.classId)))
}

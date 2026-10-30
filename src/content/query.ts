// Search and filters over loaded entries. Pure: give it the arrays from loadKind().
import type { ContentEntry, Equipment, MagicItem, Monster, Rarity, Size, Spell, SpellSchool } from './types.ts'

/** `${source}:${kind}:${id}`, unique across every source. Use it for React keys and saved references. */
export const entryKey = (kind: string, e: { source: string; id: string }) => `${e.source}:${kind}:${e.id}`

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

const descriptionOf = (e: ContentEntry) => ('description' in e && typeof e.description === 'string' ? e.description : '')

/**
 * Text search: every word must appear in the name or description.
 * Ranked: exact name, name prefix, all words in the name, then description-only matches; ties by name.
 * `alias` gives a second name to match (the translated name), ranked like the name.
 */
export function searchEntries<T extends ContentEntry>(entries: T[], query: string, alias?: (e: T) => string): T[] {
  const q = fold(query.trim())
  if (!q) return entries
  const words = q.split(/\s+/)
  const scored: { e: T; score: number }[] = []
  for (const e of entries) {
    const name = fold(e.name)
    const other = alias ? fold(alias(e)) : ''
    const inName = words.every(w => name.includes(w)) || (!!other && words.every(w => other.includes(w)))
    if (!inName && !words.every(w => name.includes(w) || other.includes(w) || fold(descriptionOf(e)).includes(w))) continue
    const score = name === q || other === q ? 0 : name.startsWith(q) || (!!other && other.startsWith(q)) ? 1 : inName ? 2 : 3
    scored.push({ e, score })
  }
  return scored.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name)).map(s => s.e)
}

export interface SpellFilter {
  levels?: number[]
  schools?: SpellSchool[]
  classId?: string
  concentration?: boolean
  ritual?: boolean
}

export const filterSpells = (spells: Spell[], f: SpellFilter) =>
  spells.filter(s =>
    (!f.levels?.length || f.levels.includes(s.level)) &&
    (!f.schools?.length || f.schools.includes(s.school)) &&
    (!f.classId || s.classes.includes(f.classId)) &&
    (f.concentration == null || s.concentration === f.concentration) &&
    (f.ritual == null || s.ritual === f.ritual))

export interface MonsterFilter {
  minCr?: number
  maxCr?: number
  types?: string[]
  sizes?: Size[]
}

export const filterMonsters = (monsters: Monster[], f: MonsterFilter) =>
  monsters.filter(m =>
    (f.minCr == null || m.challengeRating >= f.minCr) &&
    (f.maxCr == null || m.challengeRating <= f.maxCr) &&
    (!f.types?.length || f.types.includes(m.type.toLowerCase())) &&
    (!f.sizes?.length || m.sizes.some(s => f.sizes!.includes(s))))

export interface ItemFilter {
  types?: Equipment['type'][]
  /** Equipment category id, e.g. martial-weapons, heavy-armor. */
  category?: string
}

export const filterEquipment = (items: Equipment[], f: ItemFilter) =>
  items.filter(i => (!f.types?.length || f.types.includes(i.type)) && (!f.category || i.categories.includes(f.category)))

export const filterMagicItems = (items: MagicItem[], f: { rarities?: Rarity[]; attunement?: boolean; category?: string }) =>
  items.filter(i =>
    (!f.rarities?.length || f.rarities.includes(i.rarity)) &&
    (f.attunement == null || !!i.attunement === f.attunement) &&
    (!f.category || i.category === f.category))

// Library search: spells, items, monsters, conditions and feats by name, next to the rules Q&A. Pure TS.
import { foldText, searchEntries, type Condition, type Equipment, type Feat, type MagicItem, type Monster, type Spell } from '../content'

export type LibKind = 'spells' | 'items' | 'monsters' | 'conditions' | 'feats'
/** The page's chips: "all" searches every kind by name and answers rules questions; "rules" is the Q&A only. */
export type LibMode = 'all' | 'rules' | LibKind
export const LIB_KINDS: LibKind[] = ['spells', 'items', 'monsters', 'conditions', 'feats']

export type LibHit =
  | { kind: 'spells'; entry: Spell }
  | { kind: 'items'; entry: Equipment | MagicItem }
  | { kind: 'monsters'; entry: Monster & { legacy?: boolean } }
  | { kind: 'conditions'; entry: Condition }
  | { kind: 'feats'; entry: Feat }

export type Library = { [K in LibKind]: Extract<LibHit, { kind: K }>['entry'][] }

export const hitKey = (h: LibHit) => `${h.kind}:${h.entry.source}:${h.entry.id}`

/** Hebrew (or other) display name of an entry, so a Hebrew search finds it too. */
export type AliasOf = (h: LibHit) => string

const wrap = <K extends LibKind>(kind: K, list: Library[K]): LibHit[] => list.map(entry => ({ kind, entry }) as LibHit)

const hasLetters = (q: string) => /[\p{L}\p{N}]/u.test(q)

/** One kind, ranked like `searchEntries` (name first, then description). Empty query lists the kind A–Z. */
export function searchKind(lib: Library, kind: LibKind, query: string, alias?: AliasOf): LibHit[] {
  const hits = wrap(kind, lib[kind])
  if (!hasLetters(query)) return [...hits].sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  // searchEntries ranks plain entries; wrap the hit as an entry so the alias can see its kind.
  const byEntry = new Map(hits.map(h => [h.entry, h]))
  return searchEntries(hits.map(h => h.entry), query, alias ? e => alias(byEntry.get(e)!) : undefined).map(e => byEntry.get(e)!)
}

/** Every kind, names only (descriptions are too noisy across kinds): exact names first, then prefixes, then the rest. */
export function searchAll(lib: Library, query: string, alias?: AliasOf, kinds: LibKind[] = LIB_KINDS): LibHit[] {
  const q = foldText(query.trim())
  if (!hasLetters(q)) return []
  const words = q.split(/\s+/)
  const scored: { h: LibHit; score: number }[] = []
  for (const kind of kinds) {
    for (const h of wrap(kind, lib[kind])) {
      const names = [foldText(h.entry.name), alias ? foldText(alias(h)) : ''].filter(Boolean)
      if (!names.some(n => words.every(w => n.includes(w)))) continue
      const score = names.includes(q) ? 0 : names.some(n => n.startsWith(q)) ? 1 : 2
      scored.push({ h, score })
    }
  }
  return scored.sort((a, b) => a.score - b.score || a.h.entry.name.localeCompare(b.h.entry.name)).map(s => s.h)
}

/** The hit whose name (or alias) is exactly the query: shown open above the rules answer. */
export const exactHit = (hits: LibHit[], query: string, alias?: AliasOf) => {
  const q = foldText(query.trim())
  return hits.find(h => foldText(h.entry.name) === q || (!!alias && foldText(alias(h)) === q))
}

/** Hebrew letters in a question: the rules text is English, so the page offers the Familiar instead. */
export const isHebrew = (q: string) => /[א-ת]/.test(q)

/** A question worth sending to the rules search: has at least one letter or digit. */
export const isQuestion = hasLetters

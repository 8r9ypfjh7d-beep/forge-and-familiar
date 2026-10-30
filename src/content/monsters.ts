// Monsters from every source at once: the SRD of a rules edition, the book monsters written for it, older-book
// monsters never reprinted for it (shown as legacy), and registered packs (homebrew, imports). Every screen that
// lists monsters (DM screen, combat tracker, NPC sheets, custom monsters) reads this file, so they agree.
import { BOOK_SOURCES, BOOK_TITLES, bookSourceFor } from './books/sources.ts'
import { listSources, loadKind, sourceById } from './library.ts'
import type { Edition, Monster } from './types.ts'

/** A loaded monster: `legacy` marks an older-edition book monster shown to a newer-edition campaign. Not saved. */
export type LoadedMonster = Monster & { legacy?: boolean }

const srdSourceFor = (edition: Edition) => (edition === '2024' ? 'srd-5.2' : 'srd-5.1')

/** SRD and book sources written for this edition. */
export const monsterSourcesFor = (edition: Edition) => [srdSourceFor(edition), bookSourceFor(edition)]

/** `${source}:${id}`: the same id lives in both editions (aboleth), so lists and saved references need both. */
export const monsterKey = (m: Pick<Monster, 'source' | 'id'>) => `${m.source}:${m.id}`

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Every monster a campaign on `edition` rules can use, in this order: the edition's SRD, its book monsters,
 * older-book monsters with no reprint under these rules (2014 Monsters of the Multiverse for a 2024 campaign, marked
 * `legacy`), then every registered pack (`hb:<packId>` homebrew, imports). A pack's own edition is not filtered:
 * the DM picked it on purpose.
 */
export async function loadMonsters(edition: Edition): Promise<LoadedMonster[]> {
  const [own, older, packs] = await Promise.all([
    loadKind('monsters', { sources: monsterSourcesFor(edition) }),
    // Only older books fall back: a 2014 campaign never sees 2024 stat blocks.
    edition === '2024' ? loadKind('monsters', { sources: [bookSourceFor('2014')] }) : Promise.resolve([] as Monster[]),
    loadKind('monsters', { sources: packSourceIds() }),
  ])
  const have = new Set(own.map(m => norm(m.name)))
  const legacy: LoadedMonster[] = older.filter(m => !have.has(norm(m.name))).map(m => ({ ...m, legacy: true }))
  return [...own, ...legacy, ...packs]
}

const SHIPPED_IDS = new Set(['srd-5.1', 'srd-5.2', ...BOOK_SOURCES.map(s => s.id)])
/** Registered packs: every source that is not SRD or books. Computed at call time so new packs count. */
const packSourceIds = () => listSources().filter(s => !SHIPPED_IDS.has(s.id)).map(s => s.id)

/**
 * The monster's name in `lang`. Hebrew comes from `monster.<id>` terms for SRD monsters (src/i18n/locales/monsters.he.ts)
 * or from the entry's own `nameHe` (book and pack monsters). `terms` is the locale's term table.
 */
export function monsterName(m: Pick<Monster, 'id' | 'name' | 'nameHe' | 'source'>, lang: 'en' | 'he', terms?: Record<string, string>): string {
  if (lang !== 'he') return m.name
  if (m.source.startsWith('srd-')) return terms?.[`monster.${m.id}`] ?? m.nameHe ?? m.name
  return m.nameHe ?? terms?.[`monster.${m.id}`] ?? m.name
}

/**
 * The note to show under a stat block: the SRD's CC-BY attribution, the book title plus the "our summary" note for
 * book monsters, or the pack's title for homebrew.
 */
export function monsterSourceNote(m: Pick<Monster, 'source' | 'book'>): { title: string; note: string } {
  const src = sourceById(m.source)
  if (!src) return { title: m.source, note: '' }
  if (m.book && BOOK_TITLES[m.book]) return { title: BOOK_TITLES[m.book], note: src.attribution }
  return { title: src.title, note: src.attribution }
}

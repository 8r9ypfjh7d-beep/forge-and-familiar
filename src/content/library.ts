// Runtime access to the content library: bundled SRD files load lazily (one chunk per source and kind),
// packs registered at runtime (homebrew, player imports) merge in after them.
import type { ContentEntryByKind, ContentFile, ContentKind, ContentManifest, ContentPack, Edition, SourceInfo } from './types.ts'
import { BOOK_SOURCES } from './books/sources.ts'

const manifests = import.meta.glob<ContentManifest>('./data/*/manifest.json', { eager: true, import: 'default' })
const files = import.meta.glob<ContentFile>(['./data/*/*.json', '!./data/*/manifest.json', './books/*.json'], { import: 'default' })
/** Book monsters: one file per book under `books/monsters/<edition>/`, so each book can be written on its own. */
const bookMonsterFiles = import.meta.glob<ContentFile>('./books/monsters/*/*.json', { import: 'default' })

/** The bundled sources, with upstream version and counts. */
export const BUNDLED: ContentManifest[] = Object.values(manifests).sort((a, b) => a.source.id.localeCompare(b.source.id))

const cache = new Map<string, Promise<unknown[]>>()
const packs = new Map<string, ContentPack>()
const listeners = new Set<() => void>()

/** Every source that ships with the app: the SRD files, then the book spells and monsters (`books/`). */
const SHIPPED: SourceInfo[] = [...BUNDLED.map(m => m.source), ...BOOK_SOURCES]

/** All sources: bundled SRD first, then book spells, then registered packs. */
export function listSources(): SourceInfo[] {
  return [...SHIPPED, ...[...packs.values()].map(p => p.source)]
}

export const sourceById = (id: string) => listSources().find(s => s.id === id)

/** Entries of one kind from one bundled source. Each file is fetched once per page load. */
function loadBundled<K extends ContentKind>(source: SourceInfo, kind: K): Promise<ContentEntryByKind[K][]> {
  if (source.id.startsWith('books-') && kind === 'monsters') return loadBookMonsters(source) as Promise<ContentEntryByKind[K][]>
  const path = source.id.startsWith('books-') ? `./books/${kind}-${source.edition}.json` : `./data/${source.id}/${kind}.json`
  return loadFile(path, files[path]) as Promise<ContentEntryByKind[K][]>
}

function loadFile(path: string, load?: () => Promise<ContentFile>): Promise<unknown[]> {
  if (!load) return Promise.resolve([])
  let pending = cache.get(path)
  if (!pending) {
    pending = load().then(f => f.entries)
    pending.catch(() => cache.delete(path))
    cache.set(path, pending)
  }
  return pending
}

/** Paths of the book monster files of one edition, in file-name order (one per book code). */
export const bookMonsterPaths = (edition: Edition) => Object.keys(bookMonsterFiles).filter(p => p.startsWith(`./books/monsters/${edition}/`)).sort()

function loadBookMonsters(source: SourceInfo): Promise<unknown[]> {
  return Promise.all(bookMonsterPaths(source.edition).map(p => loadFile(p, bookMonsterFiles[p]))).then(lists => lists.flat())
}

export interface LoadOptions {
  /** Only these source ids. Default: every source. */
  sources?: string[]
  /** Only sources of this edition. */
  edition?: Edition
}

const wanted = (s: SourceInfo, o: LoadOptions) => (!o.sources || o.sources.includes(s.id)) && (!o.edition || s.edition === o.edition)

/** Every entry of a kind across the chosen sources. Shipped entries come first, then packs in registration order. */
export async function loadKind<K extends ContentKind>(kind: K, options: LoadOptions = {}): Promise<ContentEntryByKind[K][]> {
  const bundled = await Promise.all(SHIPPED.filter(s => wanted(s, options)).map(s => loadBundled(s, kind)))
  const extra = [...packs.values()].filter(p => wanted(p.source, options)).map(p => (p.entries[kind] ?? []) as ContentEntryByKind[K][])
  return [...bundled, ...extra].flat()
}

/** One entry by id. With no source given, the first source that has it wins (SRD, then books, then packs). */
export async function getEntry<K extends ContentKind>(kind: K, id: string, options: LoadOptions = {}): Promise<ContentEntryByKind[K] | undefined> {
  return (await loadKind(kind, options)).find(e => e.id === id)
}

/** Adds or replaces a pack (by source id). Pass sanitized packs only: see `sanitizePack`. */
export function registerContentPack(pack: ContentPack): void {
  packs.set(pack.source.id, pack)
  for (const fn of listeners) fn()
}

export function unregisterContentPack(sourceId: string): void {
  if (packs.delete(sourceId)) for (const fn of listeners) fn()
}

/** Called when packs change, so open lists can reload. Returns an unsubscribe function. */
export function onContentChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

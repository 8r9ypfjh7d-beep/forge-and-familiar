// Runtime access to the content library: bundled SRD files load lazily (one chunk per source and kind),
// packs registered at runtime (homebrew, player imports) merge in after them.
import type { ContentEntryByKind, ContentFile, ContentKind, ContentManifest, ContentPack, Edition, SourceInfo } from './types.ts'

const manifests = import.meta.glob<ContentManifest>('./data/*/manifest.json', { eager: true, import: 'default' })
const files = import.meta.glob<ContentFile>(['./data/*/*.json', '!./data/*/manifest.json'], { import: 'default' })

/** The bundled sources, with upstream version and counts. */
export const BUNDLED: ContentManifest[] = Object.values(manifests).sort((a, b) => a.source.id.localeCompare(b.source.id))

const cache = new Map<string, Promise<unknown[]>>()
const packs = new Map<string, ContentPack>()
const listeners = new Set<() => void>()

/** All sources: bundled SRD first, then registered packs. */
export function listSources(): SourceInfo[] {
  return [...BUNDLED.map(m => m.source), ...[...packs.values()].map(p => p.source)]
}

export const sourceById = (id: string) => listSources().find(s => s.id === id)

/** Entries of one kind from one bundled source. Each file is fetched once per page load. */
function loadBundled<K extends ContentKind>(sourceId: string, kind: K): Promise<ContentEntryByKind[K][]> {
  const path = `./data/${sourceId}/${kind}.json`
  const load = files[path]
  if (!load) return Promise.resolve([])
  let pending = cache.get(path)
  if (!pending) {
    pending = load().then(f => f.entries)
    pending.catch(() => cache.delete(path))
    cache.set(path, pending)
  }
  return pending as Promise<ContentEntryByKind[K][]>
}

export interface LoadOptions {
  /** Only these source ids. Default: every source. */
  sources?: string[]
  /** Only sources of this edition. */
  edition?: Edition
}

const wanted = (s: SourceInfo, o: LoadOptions) => (!o.sources || o.sources.includes(s.id)) && (!o.edition || s.edition === o.edition)

/** Every entry of a kind across the chosen sources. Bundled entries come first, then packs in registration order. */
export async function loadKind<K extends ContentKind>(kind: K, options: LoadOptions = {}): Promise<ContentEntryByKind[K][]> {
  const bundled = await Promise.all(BUNDLED.filter(m => wanted(m.source, options)).map(m => loadBundled(m.source.id, kind)))
  const extra = [...packs.values()].filter(p => wanted(p.source, options)).map(p => (p.entries[kind] ?? []) as ContentEntryByKind[K][])
  return [...bundled, ...extra].flat()
}

/** One entry by id. With no source given, the first source that has it wins (SRD before packs). */
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

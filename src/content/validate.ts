// Checks generated content for broken links, and sanitizes content packs loaded at runtime.
import {
  CONTENT_FORMAT, CONTENT_KINDS, CONTENT_VERSION,
  type ContentEntryByKind, type ContentKind, type ContentPack, type Edition, type SourceInfo,
} from './types.ts'

type Content = Partial<{ [K in ContentKind]: ContentEntryByKind[K][] }>

/**
 * Lists problems in one source's content: duplicate ids, and links to entries that are not there.
 * The ingest script prints these; tests assert the bundled data has none it does not expect.
 */
export function checkContent(c: Content): string[] {
  const problems: string[] = []
  const idsOf = new Map<ContentKind, Set<string>>()
  for (const kind of CONTENT_KINDS) {
    const seen = new Set<string>()
    for (const e of c[kind] ?? []) {
      if (seen.has(e.id)) problems.push(`${kind}: duplicate id ${e.id}`)
      seen.add(e.id)
    }
    idsOf.set(kind, seen)
  }
  const link = (from: string, kind: ContentKind, id: string | undefined) => {
    if (id && !idsOf.get(kind)!.has(id)) problems.push(`${from} → missing ${kind} ${id}`)
  }
  for (const s of c.spells ?? []) for (const id of s.classes) link(`spell ${s.id}`, 'classes', id)
  for (const k of c.classes ?? []) {
    for (const l of k.levels) for (const id of l.features) link(`class ${k.id} level ${l.level}`, 'features', id)
    for (const s of k.subclasses) link(`class ${k.id}`, 'subclasses', s.id)
  }
  for (const s of c.subclasses ?? []) {
    link(`subclass ${s.id}`, 'classes', s.classId)
    for (const f of s.features) link(`subclass ${s.id}`, 'features', f.feature.id)
    for (const sp of s.spells) link(`subclass ${s.id}`, 'spells', sp.spell.id)
  }
  for (const f of c.features ?? []) {
    link(`feature ${f.id}`, 'classes', f.classId)
    link(`feature ${f.id}`, 'features', f.parentId)
  }
  for (const r of c.races ?? []) {
    for (const t of r.traits) link(`race ${r.id}`, 'traits', t.id)
    for (const s of r.subraces) link(`race ${r.id}`, 'subraces', s.id)
  }
  for (const s of c.subraces ?? []) {
    link(`subrace ${s.id}`, 'races', s.raceId)
    for (const t of s.traits) link(`subrace ${s.id}`, 'traits', t.id)
  }
  for (const e of c.equipment ?? []) for (const x of e.contents ?? []) link(`equipment ${e.id}`, 'equipment', x.item.id)
  for (const m of c['magic-items'] ?? []) for (const v of m.variants) link(`magic item ${m.id}`, 'magic-items', v.id)
  for (const b of c.backgrounds ?? []) link(`background ${b.id}`, 'feats', b.feat?.id)
  return problems
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

/**
 * Validates a pack from a file or another device. Keeps known kinds only, entries need a string id and name,
 * and every entry is stamped with the pack's source so it cannot pose as SRD or book text. Returns null if unusable.
 */
export function sanitizePack(input: unknown): ContentPack | null {
  if (!isObj(input) || input.format !== CONTENT_FORMAT || typeof input.version !== 'number' || input.version > CONTENT_VERSION) return null
  const s = isObj(input.source) ? input.source : {}
  const id = str(s.id, 80)
  const title = str(s.title)
  if (!id || !title || id.startsWith('srd-') || id.startsWith('books-')) return null
  const edition: Edition = s.edition === '2024' ? '2024' : '2014'
  const source: SourceInfo = { id, title, edition, license: str(s.license) ?? 'unspecified', attribution: str(s.attribution, 2000) ?? title }
  const entries: ContentPack['entries'] = {}
  const raw = isObj(input.entries) ? input.entries : {}
  for (const kind of CONTENT_KINDS) {
    const list = raw[kind]
    if (!Array.isArray(list)) continue
    const kept = list
      .filter((e): e is Record<string, unknown> => isObj(e) && !!str(e.id) && !!str(e.name))
      .map(e => ({ ...e, source: id, edition }))
    // Entries are shallow-checked: the compendium shows them, the rules engine never trusts their numbers.
    if (kept.length) (entries as Record<string, unknown[]>)[kind] = kept
  }
  return { format: CONTENT_FORMAT, version: CONTENT_VERSION, source, entries }
}

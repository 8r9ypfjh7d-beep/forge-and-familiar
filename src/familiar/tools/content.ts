// Content tools: search the library (SRD 5.1/5.2, our book summaries, registered homebrew packs) and the SRD rules text.
import { CONTENT_KINDS, filterMonsters, filterSpells, getEntry, loadKind, searchEntries, sourceById, type ContentEntry, type ContentKind, type Edition } from '../../content'
import { breadcrumb, excerpt, search } from '../../rulesqa/search'
import { loadRules } from '../../rulesqa/load'
import { num, registerTool, str, type ToolEnv } from './registry'

const KINDS = CONTENT_KINDS as readonly string[]
const MAX_TEXT = 3500

const kindOf = (v: unknown): ContentKind => {
  const k = str(v)
  if (!KINDS.includes(k)) throw new Error(`Unknown kind "${k}". Use one of: ${KINDS.join(', ')}.`)
  return k as ContentKind
}

const editionOf = (args: Record<string, unknown>, env: ToolEnv): Edition | undefined => {
  const e = str(args.edition)
  return e === '2014' || e === '2024' ? e : env.edition
}

/** How a source may be used, so the model knows a book entry is our summary and SRD needs credit. */
export function sourceNote(sourceId: string): string {
  if (sourceId.startsWith('srd-')) return 'SRD text, CC-BY-4.0 (Wizards of the Coast). Quote at most two sentences.'
  if (sourceId.startsWith('books-')) return 'Our own short summary of an official book; not the book text. Explain in your own words and name the book.'
  return 'Homebrew written by the group.'
}

const cut = (s: string, max = MAX_TEXT) => (s.length > max ? `${s.slice(0, max)}… (cut)` : s)

const descOf = (e: ContentEntry, locale: string) => {
  const he = locale === 'he' && 'descriptionHe' in e && typeof e.descriptionHe === 'string' ? e.descriptionHe : ''
  return he || ('description' in e && typeof e.description === 'string' ? e.description : '')
}

/** One line per hit: enough for the model to pick, then call get_entry. */
export function summarize(kind: ContentKind, e: ContentEntry): Record<string, unknown> {
  const out: Record<string, unknown> = { id: e.id, name: e.name, source: e.source, edition: e.edition }
  const x = e as unknown as Record<string, unknown>
  if (kind === 'spells') Object.assign(out, { level: x.level, school: x.school, classes: x.classes, concentration: x.concentration, ritual: x.ritual })
  if (kind === 'monsters') Object.assign(out, { cr: x.challengeRating, type: x.type, size: x.sizes })
  if (kind === 'magic-items') Object.assign(out, { rarity: x.rarity, attunement: x.attunement })
  if (kind === 'equipment') Object.assign(out, { type: x.type })
  if ('book' in x && x.book) out.book = x.book
  return out
}

registerTool({
  declaration: {
    name: 'search_content',
    description:
      'Search the D&D content library (SRD 5.1 for 2014 rules, SRD 5.2 for 2024 rules, our summaries of official book spells, and the group\'s homebrew). ' +
      'Returns up to `limit` short hits; call get_entry for the full text. Search in English.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: [...KINDS], description: 'What to search.' },
        query: { type: 'string', description: 'Words to match in the name or text. Empty to list by filters.' },
        edition: { type: 'string', enum: ['2014', '2024'], description: 'Rules edition. Default: the edition of the character or campaign on screen.' },
        spellLevel: { type: 'number', description: 'Spells only: level 0-9.' },
        spellClass: { type: 'string', description: 'Spells only: class id, e.g. wizard.' },
        minCr: { type: 'number', description: 'Monsters only.' },
        maxCr: { type: 'number', description: 'Monsters only.' },
        limit: { type: 'number', description: 'Max hits, default 10, at most 25.' },
      },
      required: ['kind'],
    },
  },
  label: a => str(a.query) || str(a.kind),
  async run(args, env) {
    const kind = kindOf(args.kind)
    const edition = editionOf(args, env)
    let entries: ContentEntry[] = await loadKind(kind, edition ? { edition } : {})
    if (kind === 'spells') {
      const lvl = num(args.spellLevel)
      entries = filterSpells(entries as never, { levels: lvl == null ? undefined : [lvl], classId: str(args.spellClass) || undefined })
    }
    if (kind === 'monsters') entries = filterMonsters(entries as never, { minCr: num(args.minCr), maxCr: num(args.maxCr) })
    const hits = searchEntries(entries, str(args.query))
    const limit = Math.min(25, Math.max(1, num(args.limit) ?? 10))
    return { total: hits.length, hits: hits.slice(0, limit).map(e => summarize(kind, e)) }
  },
})

registerTool({
  declaration: {
    name: 'get_entry',
    description: 'The full entry for one library item by kind and id (from search_content): text, numbers and links. Book entries are our own summaries.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: [...KINDS] },
        id: { type: 'string', description: 'Entry id, e.g. fireball.' },
        source: { type: 'string', description: 'Source id from the search hit (srd-5.1, srd-5.2, books-2024, hb:...). Optional.' },
      },
      required: ['kind', 'id'],
    },
  },
  label: a => str(a.id),
  async run(args, env) {
    const kind = kindOf(args.kind)
    const source = str(args.source)
    const id = str(args.id)
    const entry = (await getEntry(kind, id, source ? { sources: [source] } : env.edition ? { edition: env.edition } : {})) ?? (await getEntry(kind, id))
    if (!entry) return { error: `No ${kind} with id ${id}. Try search_content.` }
    const { description: _d, descriptionHe: _h, ...rest } = entry as unknown as Record<string, unknown>
    const json = JSON.stringify(rest)
    return {
      entry: JSON.parse(json.length > MAX_TEXT ? JSON.stringify(summarize(kind, entry)) : json),
      text: cut(descOf(entry, env.locale)),
      sourceTitle: sourceById(entry.source)?.title ?? entry.source,
      usage: sourceNote(entry.source),
    }
  },
})

registerTool({
  declaration: {
    name: 'rules_lookup',
    description: 'Look up the SRD 5.1 rules text (combat, movement, spellcasting, conditions, resting, ability checks...). Returns the best passages with their section. Ask in English.',
    parameters: {
      type: 'object',
      properties: { question: { type: 'string', description: 'The rules question in plain English, e.g. "opportunity attack when moving away".' } },
      required: ['question'],
    },
  },
  label: a => str(a.question, 60),
  async run(args) {
    const question = str(args.question, 400)
    const { index, source } = await loadRules()
    const hits = search(index, question, 3)
    return {
      passages: hits.map(h => ({ section: breadcrumb(h.passage), excerpt: excerpt(index, h.passage, question), text: cut(h.passage.text, 1800) })),
      usage: `${source}. Quote at most two sentences; name the section.`,
    }
  },
})

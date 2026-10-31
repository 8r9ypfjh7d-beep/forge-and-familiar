// Turns a pasted lore document into chapters and entries, pure. `# Heading` starts a chapter,
// `## Heading` an entry in it; a `Letter: ...` style prefix on an entry's heading picks its type.
import { ENTRY_TYPES, type EntryType } from './types'

export interface ImportedEntry { kind: EntryType; title: string; text: string }
export interface ImportedChapter { title: string; entries: ImportedEntry[] }

/** Words that pick a type when they start a heading, in English and Hebrew. */
const TYPE_WORDS: Record<string, EntryType> = {
  note: 'note', letter: 'letter', journal: 'journal', diary: 'journal', prophecy: 'prophecy', poem: 'prophecy', song: 'prophecy',
  book: 'book', excerpt: 'book', poster: 'poster', wanted: 'poster', notice: 'poster', rumor: 'rumor', rumour: 'rumor',
  place: 'place', location: 'place', person: 'person', npc: 'person', faction: 'faction', relic: 'relic', item: 'relic',
  picture: 'image', image: 'image', map: 'map', table: 'table',
  'פתק': 'note', 'מכתב': 'letter', 'יומן': 'journal', 'נבואה': 'prophecy', 'שיר': 'prophecy', 'ספר': 'book', 'כרזה': 'poster',
  'שמועה': 'rumor', 'מקום': 'place', 'דמות': 'person', 'סיעה': 'faction', 'חפץ': 'relic', 'תמונה': 'image', 'מפה': 'map',
}

/** "Letter: From Gundren" → letter, "From Gundren". Anything else is a note with the heading as is. */
export function typedTitle(heading: string): { kind: EntryType; title: string } {
  const m = /^([^:：]{2,20})[:：]\s*(.+)$/.exec(heading.trim())
  if (m) {
    const word = m[1].trim().toLowerCase()
    const kind = TYPE_WORDS[word] ?? (ENTRY_TYPES as string[]).find(k => k === word) as EntryType | undefined
    if (kind) return { kind, title: m[2].trim() }
  }
  return { kind: 'note', title: heading.trim() }
}

/** Splits a document into chapters of entries. Text under a chapter heading before its first entry becomes an "Overview" entry. */
export function splitDocument(doc: string, overviewTitle = 'Overview', looseTitle = 'Imported'): ImportedChapter[] {
  const chapters: ImportedChapter[] = []
  let chapter: ImportedChapter | null = null
  let entry: ImportedEntry | null = null
  let lead: string[] = []

  const flushLead = () => {
    if (chapter && lead.join('\n').trim()) chapter.entries.unshift({ kind: 'note', title: overviewTitle, text: lead.join('\n').trim() })
    lead = []
  }
  const ensureChapter = (title: string) => {
    flushLead()
    chapter = { title, entries: [] }
    chapters.push(chapter)
    entry = null
  }

  for (const line of doc.replace(/\r\n?/g, '\n').split('\n')) {
    const h1 = /^#\s+(.+)$/.exec(line)
    const h2 = /^#{2,3}\s+(.+)$/.exec(line)
    if (h1) { ensureChapter(h1[1].trim()); continue }
    if (h2) {
      if (!chapter) ensureChapter(looseTitle)
      entry = { ...typedTitle(h2[1]), text: '' }
      chapter!.entries.push(entry)
      continue
    }
    if (entry) entry.text += (entry.text ? '\n' : '') + line
    else if (chapter) lead.push(line)
    else if (line.trim()) { ensureChapter(looseTitle); lead.push(line) }
  }
  flushLead()
  for (const c of chapters) for (const e of c.entries) e.text = e.text.trim()
  return chapters.filter(c => c.entries.length)
}

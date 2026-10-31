// Pure Codex rules: who sees what, what counts as unread, chapters, hidden blocks, the Tonight queue.
// No storage here, so the same checks run on the backend (supabase/migrations) and in tests.
import type { Party } from '../party/types'
import { hiddenCount, readableText } from './markup'
import type { LoreChapter, LoreEntry } from './types'

export type Handout = LoreEntry

export const isDm = (party: Party, userId: string) => party.dmId === userId

/** The DM sees every entry, drafts included. Players see revealed ones addressed to them while they are in the party. */
export function canSee(h: LoreEntry, party: Party, userId: string): boolean {
  if (h.partyId !== party.id) return false
  if (isDm(party, userId)) return true
  if (!h.sentAt || !party.members.some(m => m.userId === userId)) return false
  return h.to === 'all' || h.to.includes(userId)
}

/** Entries this user can see, newest first (drafts on top for the DM). */
export function visibleHandouts(list: LoreEntry[], party: Party, userId: string): LoreEntry[] {
  return list
    .filter(h => canSee(h, party, userId))
    .sort((a, b) => (b.sentAt ?? '9999').localeCompare(a.sentAt ?? '9999') || b.createdAt.localeCompare(a.createdAt))
}
export const visibleEntries = visibleHandouts

export const isUnread = (h: LoreEntry, party: Party, userId: string) =>
  !isDm(party, userId) && canSee(h, party, userId) && !h.seenBy[userId]

export const unreadCount = (list: LoreEntry[], party: Party, userId: string) =>
  list.filter(h => isUnread(h, party, userId)).length

/** Players the entry reaches: everyone but the DM, or the listed ones still in the party. */
export function recipients(h: LoreEntry, party: Party): string[] {
  const players = party.members.map(m => m.userId).filter(id => id !== party.dmId)
  return h.to === 'all' ? players : players.filter(id => h.to.includes(id))
}

export function markSeen(h: LoreEntry, userId: string, at = new Date().toISOString()): LoreEntry {
  return h.seenBy[userId] ? h : { ...h, seenBy: { ...h.seenBy, [userId]: at } }
}

/** Reveal: players it is addressed to can open it from now on. Leaves the Tonight queue. */
export function send(h: LoreEntry, at = new Date().toISOString()): LoreEntry {
  if (h.sentAt) return h
  const { tonight: _t, ...rest } = h
  return { ...rest, sentAt: at, updatedAt: at }
}

/** Back to a draft: players lose it and read receipts reset. */
export function unsend(h: LoreEntry, at = new Date().toISOString()): LoreEntry {
  return { ...h, sentAt: undefined, seenBy: {}, updatedAt: at }
}

/** Opens or closes one hidden block of the text for everyone who can see the entry. */
export function setBlockRevealed(h: LoreEntry, index: number, open: boolean, at = new Date().toISOString()): LoreEntry {
  const cur = new Set(h.revealed ?? [])
  if (open) cur.add(index); else cur.delete(index)
  return { ...h, revealed: [...cur].sort((a, b) => a - b), updatedAt: at }
}

/** Hidden blocks that are still closed, so the DM sees "2 secrets left". */
export const closedBlocks = (h: LoreEntry) => hiddenCount(h.text) - (h.revealed ?? []).filter(i => i < hiddenCount(h.text)).length

/** Hidden blocks a reader may see: everything for the DM, only revealed ones for players. */
export const openBlocks = (h: LoreEntry, party: Party, userId: string): number[] | 'all' => isDm(party, userId) ? 'all' : h.revealed ?? []

export type HandoutProblem = 'title' | 'image' | 'text' | 'url' | 'recipients'

/** Known virtual tabletops, by host, so a table link can say where it goes. */
const TABLES: [RegExp, string][] = [
  [/(^|\.)owlbear\.rodeo$/, 'Owlbear Rodeo'],
  [/(^|\.)talespire\.com$/, 'TaleSpire'],
  [/(^|\.)roll20\.net$/, 'Roll20'],
  [/(^|\.)forge-vtt\.com$/, 'Foundry (The Forge)'],
  [/(^|\.)dndbeyond\.com$/, 'D&D Beyond Maps'],
]

/** A table link that is safe to open: https only. Returns the cleaned link and the site's name, or null. */
export function tableLink(raw: string | undefined): { url: string; site: string } | null {
  if (!raw?.trim()) return null
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'https:' || !u.hostname.includes('.')) return null
  const host = u.hostname.toLowerCase()
  return { url: u.href, site: TABLES.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, '') }
}

export function problems(h: Pick<LoreEntry, 'kind' | 'title' | 'text' | 'image' | 'to'> & { url?: string; imageUrl?: string }): HandoutProblem[] {
  const out: HandoutProblem[] = []
  if (!h.title.trim()) out.push('title')
  if (h.kind === 'note' && !h.text.trim()) out.push('text')
  if ((h.kind === 'image' || h.kind === 'map') && !h.image && !h.imageUrl) out.push('image')
  if (h.kind === 'table' && !tableLink(h.url)) out.push('url')
  if (h.to !== 'all' && h.to.length === 0) out.push('recipients')
  return out
}

// ---------- Chapters ----------

/** Pseudo-chapter id for entries that sit in no chapter. */
export const UNSORTED = ''

/** Chapters in order, each with the entries the reader may see, in chapter order. Empty chapters are kept for the
 * DM and shown to players only when they tease something; the unsorted group comes last when it has anything. */
export function chaptersFor(chapters: LoreChapter[], entries: LoreEntry[], party: Party, userId: string): { chapter: LoreChapter | null; entries: LoreEntry[] }[] {
  const dm = isDm(party, userId)
  const seen = visibleHandouts(entries, party, userId)
  const inChapter = (id: string) => seen.filter(e => (e.chapterId ?? UNSORTED) === id).sort(byOrder)
  const known = new Set(chapters.map(c => c.id))
  const out: { chapter: LoreChapter | null; entries: LoreEntry[] }[] = [...chapters].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
    .map(chapter => ({ chapter, entries: inChapter(chapter.id) }))
    .filter(g => dm || g.entries.length > 0 || g.chapter!.teasers > 0)
  const loose = seen.filter(e => !e.chapterId || !known.has(e.chapterId)).sort(byOrder)
  if (loose.length) out.push({ chapter: null, entries: loose })
  return out
}

const byOrder = (a: LoreEntry, b: LoreEntry) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt)

/** Teaser counts per chapter from the DM's full list; chapters whose count changed come back for saving. */
export function teaserCounts(chapters: LoreChapter[], entries: LoreEntry[]): LoreChapter[] {
  return chapters.flatMap(c => {
    const n = entries.filter(e => e.chapterId === c.id && !e.sentAt && e.teaser).length
    return n === c.teasers ? [] : [{ ...c, teasers: n }]
  })
}

/** Next order value at the end of a chapter. */
export const nextOrder = (entries: LoreEntry[], chapterId: string | undefined) =>
  Math.max(-1, ...entries.filter(e => (e.chapterId ?? UNSORTED) === (chapterId ?? UNSORTED)).map(e => e.order ?? 0)) + 1

/** Moves an entry up or down inside its chapter; returns the entries whose order changed. */
export function moveEntry(entries: LoreEntry[], id: string, by: -1 | 1, at = new Date().toISOString()): LoreEntry[] {
  const me = entries.find(e => e.id === id)
  if (!me) return []
  const peers = entries.filter(e => (e.chapterId ?? UNSORTED) === (me.chapterId ?? UNSORTED)).sort(byOrder)
  const i = peers.findIndex(e => e.id === id)
  const j = i + by
  if (j < 0 || j >= peers.length) return []
  const swapped = [...peers]
  ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
  return swapped.map((e, k) => ({ ...e, order: k, updatedAt: at })).filter(e => e.order !== entries.find(x => x.id === e.id)?.order)
}

// ---------- Tonight queue ----------

/** Drafts the DM queued for this session, in queue order. */
export const tonightQueue = (entries: LoreEntry[]) =>
  entries.filter(e => !e.sentAt && e.tonight !== undefined).sort((a, b) => a.tonight! - b.tonight!)

export function toggleTonight(entries: LoreEntry[], h: LoreEntry, at = new Date().toISOString()): LoreEntry {
  if (h.tonight !== undefined) { const { tonight: _t, ...rest } = h; return { ...rest, updatedAt: at } }
  return { ...h, tonight: Math.max(0, ...tonightQueue(entries).map(e => e.tonight! + 1)), updatedAt: at }
}

// ---------- Timeline, links, search ----------

/** What the party found, in the order it was revealed (oldest first). */
export const timeline = (entries: LoreEntry[], party: Party, userId: string) =>
  visibleHandouts(entries, party, userId).filter(e => e.sentAt).sort((a, b) => a.sentAt!.localeCompare(b.sentAt!))

/** The entry a [[link]] points at, among those the reader may see; null keeps the link as plain text (no leaks). */
export function resolveLink(title: string, visible: LoreEntry[]): LoreEntry | null {
  const key = title.trim().toLowerCase()
  return visible.find(e => e.title.trim().toLowerCase() === key) ?? null
}

/** Case-insensitive search over title, readable text and meta lines. */
export function searchEntries(entries: LoreEntry[], party: Party, userId: string, query: string): LoreEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  return entries.filter(e => {
    const body = readableText(e.text, openBlocks(e, party, userId))
    return [e.title, body, ...Object.values(e.meta ?? {})].some(s => s?.toLowerCase().includes(q))
  })
}

/** Entries revealed since `since` that this player has not opened: candidates for the reveal moment. */
export const newArrivals = (entries: LoreEntry[], party: Party, userId: string, since: string) =>
  visibleHandouts(entries, party, userId).filter(e => e.sentAt && e.sentAt > since && isUnread(e, party, userId))

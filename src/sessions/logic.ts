// Pure rules for session notes: who sees what, starting and sharing a session, turning jots into a recap,
// leads across sessions, unread notes. No storage, no React.
import type { Party } from '../party/types'
import type { Jot, Lead, SessionNote, SessionSecret } from './types'

export const isDm = (party: Party, userId: string) => party.dmId === userId

/** Players see shared notes only; the DM sees every note of the party. */
export const canSee = (n: SessionNote, party: Party, userId: string) =>
  n.partyId === party.id && (isDm(party, userId) || !!n.sharedAt)

/** Notes the reader may see, newest session first. */
export function visibleNotes(list: SessionNote[], party: Party, userId: string): SessionNote[] {
  return list.filter(n => canSee(n, party, userId)).sort(byNewest)
}

export function byNewest(a: SessionNote, b: SessionNote): number {
  return b.number - a.number || b.playedOn.localeCompare(a.playedOn) || b.createdAt.localeCompare(a.createdAt)
}

export const nextNumber = (list: SessionNote[]) => list.reduce((m, n) => Math.max(m, n.number), 0) + 1

/** Today in the device's time zone, YYYY-MM-DD. */
export function today(now = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** A fresh, private note for tonight's game, numbered after the others. */
export function startSession(party: Party, dmId: string, list: SessionNote[], now = new Date(), id: string = crypto.randomUUID()): SessionNote {
  const at = now.toISOString()
  return {
    id, partyId: party.id, fromId: dmId, number: nextNumber(list.filter(n => n.partyId === party.id)), title: '',
    playedOn: today(now), recap: '', people: [], loot: [], leads: [], createdAt: at, updatedAt: at,
  }
}

export const emptySecret = (n: Pick<SessionNote, 'id' | 'partyId'>, at = new Date().toISOString()): SessionSecret =>
  ({ id: n.id, partyId: n.partyId, jots: [], notes: '', nextTime: '', updatedAt: at })

/** The DM's session still being played or written up: the newest one not shared yet. */
export function currentSession(list: SessionNote[], party: Party): SessionNote | undefined {
  return list.filter(n => n.partyId === party.id && !n.sharedAt).sort(byNewest)[0]
}

/** The session before this one, for "Your plan from last time". */
export function previousSession(list: SessionNote[], n: SessionNote): SessionNote | undefined {
  return list.filter(x => x.partyId === n.partyId && x.id !== n.id && byNewest(x, n) > 0).sort(byNewest)[0]
}

/** The newest shared session: "Last time..." on the campaign page. */
export const lastShared = (list: SessionNote[], party: Party) =>
  list.filter(n => n.partyId === party.id && n.sharedAt).sort(byNewest)[0]

export type ShareProblem = 'recap'

/** What is missing before a note can be shared. A recap is the one thing players need. */
export const problems = (n: Pick<SessionNote, 'recap'>): ShareProblem[] => (n.recap.trim() ? [] : ['recap'])

export const share = (n: SessionNote, at = new Date().toISOString()): SessionNote => ({ ...n, sharedAt: n.sharedAt ?? at, updatedAt: at })

export function unshare(n: SessionNote, at = new Date().toISOString()): SessionNote {
  const { sharedAt: _s, ...rest } = n
  return { ...rest, updatedAt: at }
}

export const addJot = (s: SessionSecret, text: string, at = new Date().toISOString(), id: string = crypto.randomUUID()): SessionSecret =>
  text.trim() ? { ...s, jots: [...s.jots, { id, at, text: text.trim() }], updatedAt: at } : s

export const removeJot = (s: SessionSecret, id: string, at = new Date().toISOString()): SessionSecret =>
  ({ ...s, jots: s.jots.filter(j => j.id !== id), updatedAt: at })

/** A starting recap from the jots: one list line each, after whatever the recap already says. */
export function recapFromJots(recap: string, jots: Jot[]): string {
  const lines = jots.map(j => `- ${j.text}`).filter(l => !recap.includes(l))
  if (!lines.length) return recap
  return [recap.trimEnd(), lines.join('\n')].filter(Boolean).join('\n\n')
}

/** One item per non-empty line, trimmed, without list dashes, duplicates dropped. */
export function linesToList(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\s*[-*•]\s*/, '').trim()
    if (line && !out.includes(line)) out.push(line)
  }
  return out
}

export const listToLines = (list: string[]) => list.join('\n')

/** Leads edited as lines; a line that matches an old lead keeps its id and done state. */
export function linesToLeads(text: string, old: Lead[], makeId: () => string = () => crypto.randomUUID()): Lead[] {
  return linesToList(text).map(line => old.find(l => l.text === line) ?? { id: makeId(), text: line })
}

export const addToList = (list: string[], text: string) => (text.trim() && !list.includes(text.trim()) ? [...list, text.trim()] : list)

export function addLead(n: SessionNote, text: string, at = new Date().toISOString(), id: string = crypto.randomUUID()): SessionNote {
  const line = text.trim()
  if (!line || n.leads.some(l => l.text === line)) return n
  return { ...n, leads: [...n.leads, { id, text: line }], updatedAt: at }
}

export function toggleLead(n: SessionNote, leadId: string, at = new Date().toISOString()): SessionNote {
  return {
    ...n, updatedAt: at,
    leads: n.leads.map(l => {
      if (l.id !== leadId) return l
      if (l.doneAt) { const { doneAt: _d, ...open } = l; return open }
      return { ...l, doneAt: at }
    }),
  }
}

export interface LeadRow { lead: Lead; note: SessionNote }

/** Every lead the reader can see, open ones first (newest session first), then done ones. */
export function allLeads(list: SessionNote[], party: Party, userId: string): LeadRow[] {
  const rows = visibleNotes(list, party, userId).flatMap(note => note.leads.map(lead => ({ lead, note })))
  return [...rows.filter(r => !r.lead.doneAt), ...rows.filter(r => r.lead.doneAt)]
}

/** Players' unread shared notes. The DM has nothing unread. */
export function unread(list: SessionNote[], party: Party, userId: string, seen: string[]): SessionNote[] {
  if (isDm(party, userId)) return []
  return visibleNotes(list, party, userId).filter(n => !seen.includes(n.id))
}

/** Words to search a note by (recap, people, loot, leads, title). */
export function matches(n: SessionNote, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [n.title, n.recap, ...n.people, ...n.loot, ...n.leads.map(l => l.text), String(n.number)].join('\n').toLowerCase().includes(q)
}

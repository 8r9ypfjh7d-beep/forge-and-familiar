// Pure rules for the DM's session notes: starting a session, jots, people, loot and leads across sessions.
// Only the DM sees them; the party's own story lives in Party notes (src/notes). No storage, no React.
import type { Party } from '../party/types'
import type { Lead, SessionNote, SessionSecret } from './types'

export const isDm = (party: Party, userId: string) => party.dmId === userId

/** Session notes are the DM's own. (Recaps once shared with players moved to Party notes.) */
export const canSee = (n: SessionNote, party: Party, userId: string) => n.partyId === party.id && isDm(party, userId)

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

/** The session being played: the newest one, while it is dated today or yesterday (a game that ran past midnight). */
export function currentSession(list: SessionNote[], party: Party, now = new Date()): SessionNote | undefined {
  const newest = list.filter(n => n.partyId === party.id).sort(byNewest)[0]
  const yesterday = today(new Date(now.getTime() - 86_400_000))
  return newest && newest.playedOn >= yesterday ? newest : undefined
}

/** The session before this one, for "Your plan from last time". */
export function previousSession(list: SessionNote[], n: SessionNote): SessionNote | undefined {
  return list.filter(x => x.partyId === n.partyId && x.id !== n.id && byNewest(x, n) > 0).sort(byNewest)[0]
}

/** Takes an old shared recap back to the DM only (its text now lives in Party notes). */
export function unshare(n: SessionNote, at = new Date().toISOString()): SessionNote {
  const { sharedAt: _s, ...rest } = n
  return { ...rest, updatedAt: at }
}

export const addJot = (s: SessionSecret, text: string, at = new Date().toISOString(), id: string = crypto.randomUUID()): SessionSecret =>
  text.trim() ? { ...s, jots: [...s.jots, { id, at, text: text.trim() }], updatedAt: at } : s

export const removeJot = (s: SessionSecret, id: string, at = new Date().toISOString()): SessionSecret =>
  ({ ...s, jots: s.jots.filter(j => j.id !== id), updatedAt: at })

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

/** Words to search a note by (recap, people, loot, leads, title). */
export function matches(n: SessionNote, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [n.title, n.recap, ...n.people, ...n.loot, ...n.leads.map(l => l.text), String(n.number)].join('\n').toLowerCase().includes(q)
}

// Pure journal helpers: building records, the per-session timeline, search and plain-text export.
import type { Journal, Loot, Npc, Quest, QuestStatus, SessionDate, SessionNote } from './types'

const newId = () => crypto.randomUUID()

/** Today as YYYY-MM-DD in local time, the default stamp for new records. */
export function today(now = new Date()): SessionDate {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** Local calendar day of an ISO timestamp. */
export const dateOf = (iso: string): SessionDate => today(new Date(iso))

export function formatDate(d: SessionDate): string {
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return d
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export const emptyJournal = (characterId: string): Journal =>
  ({ characterId, notes: [], npcs: [], quests: [], loot: [], updatedAt: new Date().toISOString() })

export function newNote(date: SessionDate, recapSessionId?: string): SessionNote {
  const at = new Date().toISOString()
  return { id: newId(), date, title: '', body: '', recapSessionId, createdAt: at, updatedAt: at }
}

export const newNpc = (date: SessionDate): Npc =>
  ({ id: newId(), name: '', role: '', place: '', attitude: 'unknown', alive: true, notes: '', metOn: date })

export const newQuest = (date: SessionDate): Quest =>
  ({ id: newId(), title: '', giver: '', reward: '', status: 'active', objectives: [], notes: '', startedOn: date })

export const newLoot = (date: SessionDate): Loot =>
  ({ id: newId(), name: '', qty: 1, source: '', notes: '', foundOn: date })

export const newObjective = (text: string) => ({ id: newId(), text, done: false })

/** Replaces the record with the same id, or adds it. */
export function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex(x => x.id === item.id)
  if (i < 0) return [...list, item]
  const next = list.slice()
  next[i] = item
  return next
}

export const removeById = <T extends { id: string }>(list: T[], id: string): T[] => list.filter(x => x.id !== id)

/** Changes a quest's status, stamping or clearing the date it closed. */
export function setQuestStatus(q: Quest, status: QuestStatus, date: SessionDate): Quest {
  return { ...q, status, closedOn: status === 'active' ? undefined : (q.status === status ? q.closedOn : date) }
}

export function questProgress(q: Quest): { done: number; total: number } {
  return { done: q.objectives.filter(o => o.done).length, total: q.objectives.length }
}

export interface SessionDay {
  date: SessionDate
  notes: SessionNote[]
  npcsMet: Npc[]
  questsStarted: Quest[]
  questsClosed: Quest[]
  loot: Loot[]
}

/** Everything in the journal grouped by the session it is stamped with, newest session first. */
export function timeline(j: Journal): SessionDay[] {
  const days = new Map<SessionDate, SessionDay>()
  const day = (date: SessionDate) => {
    let d = days.get(date)
    if (!d) days.set(date, d = { date, notes: [], npcsMet: [], questsStarted: [], questsClosed: [], loot: [] })
    return d
  }
  for (const n of j.notes) day(n.date).notes.push(n)
  for (const n of j.npcs) day(n.metOn).npcsMet.push(n)
  for (const q of j.quests) {
    day(q.startedOn).questsStarted.push(q)
    if (q.closedOn) day(q.closedOn).questsClosed.push(q)
  }
  for (const l of j.loot) day(l.foundOn).loot.push(l)
  for (const d of days.values()) d.notes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/** Session dates already used in the journal, newest first. */
export const sessionDates = (j: Journal): SessionDate[] => timeline(j).map(d => d.date)

const QUEST_ORDER: Record<QuestStatus, number> = { active: 0, done: 1, failed: 2 }

export const sortQuests = (list: Quest[]) =>
  [...list].sort((a, b) => QUEST_ORDER[a.status] - QUEST_ORDER[b.status] || b.startedOn.localeCompare(a.startedOn))

export const sortNpcs = (list: Npc[]) => [...list].sort((a, b) => a.name.localeCompare(b.name))

export const sortLoot = (list: Loot[]) => [...list].sort((a, b) => b.foundOn.localeCompare(a.foundOn))

export function lootTotalGp(list: Loot[]): number {
  return list.reduce((sum, l) => sum + (l.valueGp ?? 0), 0)
}

const has = (q: string, ...fields: (string | undefined)[]) => fields.some(f => f?.toLowerCase().includes(q))

/** Keeps the records whose text matches the query, case-insensitive. A blank query keeps everything. */
export function searchJournal(j: Journal, query: string): Journal {
  const q = query.trim().toLowerCase()
  if (!q) return j
  return {
    ...j,
    notes: j.notes.filter(n => has(q, n.title, n.body)),
    npcs: j.npcs.filter(n => has(q, n.name, n.role, n.place, n.notes)),
    quests: j.quests.filter(x => has(q, x.title, x.giver, x.reward, x.notes, ...x.objectives.map(o => o.text))),
    loot: j.loot.filter(l => has(q, l.name, l.source, l.notes)),
  }
}

const ATTITUDE: Record<Npc['attitude'], string> = { friendly: 'friendly', neutral: 'neutral', hostile: 'hostile', unknown: 'attitude unknown' }

/** The journal as plain text, for pasting into Discord or a doc. */
export function journalToText(characterName: string, j: Journal): string {
  const out: string[] = [`${characterName}'s journal`]
  for (const d of timeline(j)) {
    out.push('', `== ${formatDate(d.date)} ==`)
    for (const n of d.notes) {
      if (n.title) out.push(n.title)
      if (n.body.trim()) out.push(n.body.trim())
    }
    if (d.npcsMet.length) out.push(`Met: ${d.npcsMet.map(n => n.name || 'Unnamed').join(', ')}`)
    if (d.questsStarted.length) out.push(`New quests: ${d.questsStarted.map(q => q.title || 'Untitled').join(', ')}`)
    for (const q of d.questsClosed) out.push(`Quest ${q.status === 'done' ? 'completed' : 'failed'}: ${q.title || 'Untitled'}`)
    if (d.loot.length) out.push(`Loot: ${d.loot.map(l => (l.qty > 1 ? `${l.qty}× ` : '') + (l.name || 'Item')).join(', ')}`)
  }
  const open = sortQuests(j.quests).filter(q => q.status === 'active')
  if (open.length) {
    out.push('', '== Open quests ==')
    for (const q of open) {
      const { done, total } = questProgress(q)
      out.push(`- ${q.title || 'Untitled'}${q.giver ? ` (from ${q.giver})` : ''}${total ? ` ${done}/${total}` : ''}`)
      for (const o of q.objectives) out.push(`  [${o.done ? 'x' : ' '}] ${o.text}`)
    }
  }
  if (j.npcs.length) {
    out.push('', '== People ==')
    for (const n of sortNpcs(j.npcs)) {
      const bits = [n.role, n.place, ATTITUDE[n.attitude], n.alive ? '' : 'dead'].filter(Boolean)
      out.push(`- ${n.name || 'Unnamed'}${bits.length ? `: ${bits.join(', ')}` : ''}`)
    }
  }
  return out.join('\n')
}

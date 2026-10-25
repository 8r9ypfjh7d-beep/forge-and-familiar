// Session poll store. Async like src/party/store.ts so a hosted backend can replace localStorage later.
import { addOption, choose, makePoll, removeOption, setVote } from './poll'
import type { Availability, SessionPoll } from './types'

const KEY = 'ff.sessions.v1'
const CHANGED = 'ff:sessions-changed'

function readPolls(): SessionPoll[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? (list as SessionPoll[]) : []
  } catch {
    return []
  }
}

function writePolls(list: SessionPoll[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked; nothing else to do offline.
  }
  window.dispatchEvent(new Event(CHANGED))
}

function update(id: string, change: (p: SessionPoll) => SessionPoll) {
  const list = readPolls()
  const i = list.findIndex(p => p.id === id)
  if (i < 0) return
  list[i] = change(list[i])
  writePolls(list)
}

/** The party's polls, newest first. The first one is the current plan. */
export async function listPolls(partyId: string): Promise<SessionPoll[]> {
  return readPolls().filter(p => p.partyId === partyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function startPoll(partyId: string, userId: string): Promise<SessionPoll> {
  const poll = makePoll(partyId, userId, new Date())
  writePolls([...readPolls(), poll])
  return poll
}

export async function proposeDate(pollId: string, userId: string, startsAt: Date): Promise<void> {
  update(pollId, p => addOption(p, startsAt, userId, new Date()))
}

export async function dropDate(pollId: string, optionId: string): Promise<void> {
  update(pollId, p => removeOption(p, optionId, new Date()))
}

export async function answer(pollId: string, userId: string, optionId: string, a: Availability | undefined): Promise<void> {
  update(pollId, p => setVote(p, userId, optionId, a, new Date()))
}

export async function lockIn(pollId: string, optionId: string | undefined): Promise<void> {
  update(pollId, p => choose(p, optionId, new Date()))
}

/** Calls fn whenever polls change, in this tab or another one. Returns an unsubscribe function. */
export function onSessionsChanged(fn: () => void): () => void {
  const other = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener(CHANGED, fn)
  window.addEventListener('storage', other)
  return () => {
    window.removeEventListener(CHANGED, fn)
    window.removeEventListener('storage', other)
  }
}

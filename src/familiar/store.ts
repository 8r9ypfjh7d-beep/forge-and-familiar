// Conversations stay on this device, per user: ff.familiar.v1.<userId>. Nothing is stored on the server.
import type { Content, FamiliarContext, Thread, ToolUse } from './types'

export const MAX_THREADS = 20
const key = (userId: string) => `ff.familiar.v1.${userId}`

function read(userId: string): Thread[] {
  try {
    const raw = localStorage.getItem(key(userId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter(t => t && typeof t.id === 'string' && Array.isArray(t.contents)) : []
  } catch {
    return []
  }
}

function write(userId: string, threads: Thread[]) {
  const sorted = [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_THREADS)
  try {
    localStorage.setItem(key(userId), JSON.stringify(sorted))
  } catch {
    // Storage full: drop the oldest half and try once more.
    try { localStorage.setItem(key(userId), JSON.stringify(sorted.slice(0, Math.ceil(sorted.length / 2)))) } catch { /* give up */ }
  }
}

export const listThreads = (userId: string): Thread[] => read(userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
export const getThread = (userId: string, id: string) => read(userId).find(t => t.id === id)

export function newThread(context: FamiliarContext, now = new Date().toISOString()): Thread {
  return { id: `th-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, title: '', context, contents: [], tools: {}, createdAt: now, updatedAt: now }
}

/** The first question, shortened, as the thread's title. */
export const titleFor = (text: string) => (text.trim().replace(/\s+/g, ' ').length > 60 ? `${text.trim().replace(/\s+/g, ' ').slice(0, 57)}…` : text.trim().replace(/\s+/g, ' '))

export function saveTurn(userId: string, thread: Thread, contents: Content[], tools: ToolUse[], firstQuestion: string): Thread {
  const next: Thread = {
    ...thread,
    title: thread.title || titleFor(firstQuestion),
    contents,
    tools: tools.length ? { ...thread.tools, [contents.length - 1]: tools } : thread.tools,
    updatedAt: new Date().toISOString(),
  }
  write(userId, [next, ...read(userId).filter(t => t.id !== thread.id)])
  return next
}

/** Marks an Apply card tapped (or undone) on a saved thread. */
export function setApplied(userId: string, thread: Thread, proposalId: string, state: 'applied' | 'undone'): Thread {
  const saved = read(userId).find(t => t.id === thread.id) ?? thread
  const next: Thread = { ...saved, applied: { ...saved.applied, [proposalId]: state } }
  write(userId, [next, ...read(userId).filter(t => t.id !== thread.id)])
  return next
}

export function deleteThread(userId: string, id: string) {
  write(userId, read(userId).filter(t => t.id !== id))
}

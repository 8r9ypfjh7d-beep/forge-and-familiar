// Pure hand-out rules: who sees what and what counts as unread. No storage here,
// so the same checks can run on a backend once accounts exist.
import type { Party } from '../party/types'
import type { Handout } from './types'

export const isDm = (party: Party, userId: string) => party.dmId === userId

/** The DM sees every hand-out, drafts included. Players see sent ones addressed to them while they are in the party. */
export function canSee(h: Handout, party: Party, userId: string): boolean {
  if (h.partyId !== party.id) return false
  if (isDm(party, userId)) return true
  if (!h.sentAt || !party.members.some(m => m.userId === userId)) return false
  return h.to === 'all' || h.to.includes(userId)
}

/** Hand-outs this user can see, newest first (drafts on top for the DM). */
export function visibleHandouts(list: Handout[], party: Party, userId: string): Handout[] {
  return list
    .filter(h => canSee(h, party, userId))
    .sort((a, b) => (b.sentAt ?? '9999').localeCompare(a.sentAt ?? '9999') || b.createdAt.localeCompare(a.createdAt))
}

export const isUnread = (h: Handout, party: Party, userId: string) =>
  !isDm(party, userId) && canSee(h, party, userId) && !h.seenBy[userId]

export const unreadCount = (list: Handout[], party: Party, userId: string) =>
  list.filter(h => isUnread(h, party, userId)).length

/** Players the hand-out reaches: everyone but the DM, or the listed ones still in the party. */
export function recipients(h: Handout, party: Party): string[] {
  const players = party.members.map(m => m.userId).filter(id => id !== party.dmId)
  return h.to === 'all' ? players : players.filter(id => h.to.includes(id))
}

export function markSeen(h: Handout, userId: string, at = new Date().toISOString()): Handout {
  return h.seenBy[userId] ? h : { ...h, seenBy: { ...h.seenBy, [userId]: at } }
}

export function send(h: Handout, at = new Date().toISOString()): Handout {
  return h.sentAt ? h : { ...h, sentAt: at, updatedAt: at }
}

/** Back to a draft: players lose it and read receipts reset. */
export function unsend(h: Handout, at = new Date().toISOString()): Handout {
  return { ...h, sentAt: undefined, seenBy: {}, updatedAt: at }
}

export type HandoutProblem = 'title' | 'image' | 'text' | 'recipients'

export function problems(h: Pick<Handout, 'kind' | 'title' | 'text' | 'image' | 'to'>): HandoutProblem[] {
  const out: HandoutProblem[] = []
  if (!h.title.trim()) out.push('title')
  if (h.kind === 'note' && !h.text.trim()) out.push('text')
  if (h.kind !== 'note' && !h.image) out.push('image')
  if (h.to !== 'all' && h.to.length === 0) out.push('recipients')
  return out
}

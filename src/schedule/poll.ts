// Pure scheduling rules: proposing dates, voting, ranking and calendar export.
// No storage or clock here; callers pass `now`, so the same logic can run on a backend later.
import type { Availability, SessionOption, SessionPoll } from './types'

export const DEFAULT_DURATION_MINUTES = 4 * 60
/** How long before a locked-in session the app and the calendar file remind players. */
export const REMINDER_LEAD_HOURS = 24

const touch = (p: SessionPoll, change: Partial<SessionPoll>, now: Date): SessionPoll =>
  ({ ...p, ...change, updatedAt: now.toISOString() })

export function makePoll(partyId: string, createdBy: string, now: Date, id: string = crypto.randomUUID()): SessionPoll {
  const at = now.toISOString()
  return { id, partyId, createdBy, durationMinutes: DEFAULT_DURATION_MINUTES, options: [], votes: {}, createdAt: at, updatedAt: at }
}

/** Adds a date and marks the proposer as available for it. Proposing the same start twice is a no-op. */
export function addOption(p: SessionPoll, startsAt: Date, userId: string, now: Date, id: string = crypto.randomUUID()): SessionPoll {
  const iso = startsAt.toISOString()
  if (Number.isNaN(startsAt.getTime()) || p.options.some(o => o.startsAt === iso)) return p
  const options = [...p.options, { id, startsAt: iso, proposedBy: userId }].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return setVote(touch(p, { options }, now), userId, id, 'yes', now)
}

export function removeOption(p: SessionPoll, optionId: string, now: Date): SessionPoll {
  const votes = Object.fromEntries(Object.entries(p.votes).map(([u, v]) => {
    const { [optionId]: _, ...rest } = v
    return [u, rest]
  }))
  return touch(p, {
    options: p.options.filter(o => o.id !== optionId),
    votes,
    chosenOptionId: p.chosenOptionId === optionId ? undefined : p.chosenOptionId,
  }, now)
}

/** Sets or clears (undefined) one player's answer for one date. */
export function setVote(p: SessionPoll, userId: string, optionId: string, answer: Availability | undefined, now: Date): SessionPoll {
  if (!p.options.some(o => o.id === optionId)) return p
  const { [optionId]: _, ...rest } = p.votes[userId] ?? {}
  const mine = answer ? { ...rest, [optionId]: answer } : rest
  return touch(p, { votes: { ...p.votes, [userId]: mine } }, now)
}

/** Locks in a date, or reopens the poll with undefined. */
export function choose(p: SessionPoll, optionId: string | undefined, now: Date): SessionPoll {
  if (optionId !== undefined && !p.options.some(o => o.id === optionId)) return p
  return touch(p, { chosenOptionId: optionId }, now)
}

export const chosenOption = (p: SessionPoll): SessionOption | undefined =>
  p.options.find(o => o.id === p.chosenOptionId)

export const endsAt = (p: SessionPoll, o: SessionOption) =>
  new Date(new Date(o.startsAt).getTime() + p.durationMinutes * 60_000)

export interface OptionTally {
  option: SessionOption
  yes: number
  maybe: number
  no: number
  /** Current members who haven't answered. */
  pending: number
  past: boolean
}

/** Counts answers from current members only, so players who left the party stop counting. */
export function tally(p: SessionPoll, memberIds: string[], now: Date): OptionTally[] {
  return p.options.map(option => {
    const t: OptionTally = { option, yes: 0, maybe: 0, no: 0, pending: 0, past: new Date(option.startsAt) <= now }
    for (const id of memberIds) {
      const a = p.votes[id]?.[option.id]
      if (a) t[a]++
      else t.pending++
    }
    return t
  })
}

/** The best future date: fewest "no", then most "yes", then most "maybe", then soonest. Undefined if no future date has a "yes". */
export function bestOption(tallies: OptionTally[]): OptionTally | undefined {
  return tallies
    .filter(t => !t.past && t.yes > 0)
    .sort((a, b) => a.no - b.no || b.yes - a.yes || b.maybe - a.maybe || a.option.startsAt.localeCompare(b.option.startsAt))[0]
}

/** True from REMINDER_LEAD_HOURS before the start until the session ends. */
export function reminderDue(p: SessionPoll, now: Date, leadHours = REMINDER_LEAD_HOURS): boolean {
  const o = chosenOption(p)
  if (!o) return false
  const start = new Date(o.startsAt).getTime()
  return now.getTime() >= start - leadHours * 3_600_000 && now < endsAt(p, o)
}

/** A locked-in session that has ended, so the party can plan the next one. */
export function isFinished(p: SessionPoll, now: Date): boolean {
  const o = chosenOption(p)
  return !!o && endsAt(p, o) <= now
}

/** "in 3 days", "in 5 hours" in the given language. Coarse on purpose, for a glanceable countdown. Undefined once it has started. */
export function relativeTime(target: Date, now: Date, locale = 'en'): string | undefined {
  const mins = Math.round((target.getTime() - now.getTime()) / 60_000)
  if (mins <= 0) return undefined
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  if (mins < 60) return rtf.format(mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 36) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsText = (s: string) => s.replace(/[\\;,]/g, m => `\\${m}`).replace(/\r?\n/g, '\\n')

/** An iCalendar file for the locked-in session, with an alarm so phones remind players even with the app closed. */
export function toIcs(p: SessionPoll, partyName: string, now: Date): string | undefined {
  const o = chosenOption(p)
  if (!o) return undefined
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Forge & Familiar//Session scheduler//EN',
    'BEGIN:VEVENT',
    `UID:${p.id}-${o.id}@forge-and-familiar`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(new Date(o.startsAt))}`,
    `DTEND:${icsDate(endsAt(p, o))}`,
    `SUMMARY:${icsText(`D&D: ${partyName}`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(`${partyName} session tomorrow`)}`,
    `TRIGGER:-PT${REMINDER_LEAD_HOURS}H`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

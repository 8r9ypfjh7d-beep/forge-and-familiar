// Pure session updates. Each returns a new Session, or the same one when nothing changed,
// so recording the same save twice (two tabs, a reload) adds nothing.
import type { RollResult } from '../dice/types'
import type { Character } from '../model/character'
import { diffCharacter, sameTracked, track } from './diff'
import type { Session, SessionEvent } from './types'

/** Steps kept per character for undo, matching the sheet's own history length. */
const MAX_STEPS = 30
/**
 * Storage only holds the result, so an undo looks the same as an action that exactly reverses
 * the last one (9 damage, then 9 healing). Only a quick reversal counts as an undo.
 */
const UNDO_WINDOW_MS = 2 * 60_000

const newId = () => crypto.randomUUID()

export function startSession(opts: { ownerId: string; title: string; characters: Character[]; at?: string }): Session {
  const at = opts.at ?? new Date().toISOString()
  const steps: Session['steps'] = {}
  for (const c of opts.characters) steps[c.id] = [{ snapshot: track(c), eventIds: [], at }]
  return { id: newId(), ownerId: opts.ownerId, title: opts.title, startedAt: at, characterIds: opts.characters.map(c => c.id), events: [], steps }
}

export function endSession(s: Session, at = new Date().toISOString()): Session {
  return s.endedAt ? s : { ...s, endedAt: at }
}

/**
 * Records a character's latest save. Going straight back to the snapshot before the last one
 * is treated as an undo on the sheet, and takes that step's events back out.
 */
export function recordCharacter(s: Session, c: Character, at = new Date().toISOString()): Session {
  if (s.endedAt || !s.characterIds.includes(c.id)) return s
  const steps = s.steps[c.id] ?? []
  const now = track(c)
  const top = steps[steps.length - 1]
  if (top && sameTracked(top.snapshot, now)) return s

  const below = steps[steps.length - 2]
  if (below && top && sameTracked(below.snapshot, now) && Date.parse(at) - Date.parse(top.at) < UNDO_WINDOW_MS) {
    const dropped = new Set(top.eventIds)
    return { ...s, events: s.events.filter(e => !dropped.has(e.id)), steps: { ...s.steps, [c.id]: steps.slice(0, -1) } }
  }

  const events: SessionEvent[] = top
    ? diffCharacter(top.snapshot, c).map(body => ({ ...body, id: newId(), at, characterId: c.id, characterName: c.name }))
    : []
  const next = [...steps, { snapshot: now, eventIds: events.map(e => e.id), at }]
  // Keep the first snapshot so the session always knows where everyone started.
  const trimmed = next.length > MAX_STEPS ? [next[0], ...next.slice(-(MAX_STEPS - 1))] : next
  return { ...s, events: [...s.events, ...events], steps: { ...s.steps, [c.id]: trimmed } }
}

/** Adds rolls made during the session by its characters, or with no character (table rolls). */
export function recordRolls(s: Session, rolls: readonly RollResult[]): Session {
  if (s.endedAt) return s
  const seen = new Set(s.events.flatMap(e => (e.kind === 'roll' ? [e.roll.id] : [])))
  const fresh = rolls
    .filter(r => !seen.has(r.id) && r.timestamp >= s.startedAt && (!r.roller || s.characterIds.includes(r.roller.characterId)))
    .map((r): SessionEvent => ({
      kind: 'roll', roll: r, id: newId(), at: r.timestamp,
      characterId: r.roller?.characterId, characterName: r.roller?.characterName ?? 'Table',
    }))
  if (fresh.length === 0) return s
  const events = [...s.events, ...fresh].sort((x, y) => x.at.localeCompare(y.at))
  return { ...s, events }
}

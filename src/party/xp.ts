// XP from the DM: awards live in the party stash (any member may write it; only the DM gives XP), and
// each player's device adds them to the character they brought, once. Pure, no React or storage.
import type { Character } from '../model/character'
import { XP_THRESHOLDS, levelForXp, totalLevel, xpAtLevel, xpReady } from '../rules'
import type { Party, XpAward } from './types'

export const AWARD_LIMIT = 50

/** Awards for `userId`'s character `characterId`, oldest first. */
export function awardsFor(party: Party, userId: string, characterId: string): XpAward[] {
  return (party.stash?.awards ?? [])
    .filter(a => a.to.some(x => x.userId === userId && x.characterId === characterId))
    .sort((a, b) => a.at.localeCompare(b.at))
}

/**
 * Adds one award: plain XP, or a milestone level, which lifts XP to the next level above the one XP already
 * reaches (so two milestones before levelling up give two levels).
 */
export function addAward(c: Character, award: XpAward): Character {
  // A character can be in more than one party, so it remembers twice what one stash keeps.
  const applied = [...(c.appliedAwards ?? []), award.id].slice(-AWARD_LIMIT * 2)
  let xp = c.xp
  if (award.level) xp = Math.max(xp, xpAtLevel(award.level))
  else if (award.milestone) {
    const reached = Math.max(totalLevel(c), levelForXp(xp))
    const next = XP_THRESHOLDS[reached]
    if (next !== undefined) xp = Math.max(xp, next)
  } else xp = Math.max(0, xp + Math.trunc(award.xp ?? 0))
  return { ...c, xp, appliedAwards: applied }
}

/** The character with every award from its parties added that it hasn't taken yet; the same object when there is none. */
export function takeAwards(c: Character, parties: Party[]): Character {
  const done = new Set(c.appliedAwards ?? [])
  const fresh = parties.flatMap(p => awardsFor(p, c.ownerId, c.id)).filter(a => !done.has(a.id))
  return fresh.reduce(addAward, c)
}

/** A level the DM gave: a milestone or a catch-up to a level (not plain XP). */
export const isLevelAward = (a: XpAward) => !!(a.milestone || a.level)

/**
 * Where one player is with the DM's last level: 'sent' (their device hasn't picked it up yet), 'choosing' (XP
 * reaches a higher level than the sheet has, so Level Up waits for their choices), 'done' (the sheet caught up),
 * 'idle' (no level given yet), 'unknown' (the DM can't read the character).
 */
export type LevelUpStatus = 'sent' | 'choosing' | 'done' | 'idle' | 'unknown'

export interface PartyLevelRow {
  userId: string
  characterId: string
  name?: string
  /** The character's level now; 0 when unknown. */
  level: number
  /** The level its XP reaches, which Level Up takes it to. */
  xpLevel: number
  status: LevelUpStatus
}

/** One row per player who brings a character (the DM left out), for the DM's party level card. */
export function partyLevels(party: Party, characters: Record<string, Character | undefined>): PartyLevelRow[] {
  return party.members.flatMap((m): PartyLevelRow[] => {
    if (!m.characterId || m.userId === party.dmId) return []
    const c = characters[m.characterId]
    if (!c) return [{ userId: m.userId, characterId: m.characterId, level: 0, xpLevel: 0, status: 'unknown' as const }]
    const last = awardsFor(party, m.userId, m.characterId).filter(isLevelAward).at(-1)
    const level = totalLevel(c)
    const status: LevelUpStatus = last && !(c.appliedAwards ?? []).includes(last.id) ? 'sent'
      : xpReady(c) ? 'choosing' : last ? 'done' : 'idle'
    return [{ userId: m.userId, characterId: m.characterId, name: c.name, level, xpLevel: Math.min(20, Math.max(level, levelForXp(c.xp))), status }]
  })
}

/** The level a row will reach once everything given so far is taken: one more when a level is still on its way. */
export const levelAfter = (r: PartyLevelRow) => (r.status === 'sent' ? Math.min(20, Math.max(r.level, r.xpLevel) + 1) : r.xpLevel)

/** The highest level anyone in the party has or is about to have: the catch-up target for the rest. */
export const partyTop = (rows: PartyLevelRow[]) => rows.reduce((n, r) => Math.max(n, levelAfter(r)), 0)

/**
 * The DM's level award this player's device just took for this character and still has to choose for: the newest
 * level award in `parties`, when the character's XP now reaches a level its sheet doesn't have. Else undefined.
 */
export function pendingLevel(c: Character, parties: Party[]): { party: Party; award: XpAward; level: number } | undefined {
  if (!xpReady(c)) return undefined
  const done = new Set(c.appliedAwards ?? [])
  const found = parties.flatMap(party => awardsFor(party, c.ownerId, c.id).filter(a => done.has(a.id)).map(award => ({ party, award })))
    .sort((a, b) => a.award.at.localeCompare(b.award.at)).at(-1)
  return found && { ...found, level: totalLevel(c) + 1 }
}

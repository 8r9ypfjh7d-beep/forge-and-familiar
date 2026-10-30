// XP from the DM: awards live in the party stash (any member may write it; only the DM gives XP), and
// each player's device adds them to the character they brought, once. Pure, no React or storage.
import type { Character } from '../model/character'
import { XP_THRESHOLDS, levelForXp, totalLevel } from '../rules'
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
  if (award.milestone) {
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

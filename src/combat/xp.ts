// XP after a fight: the monsters the party beat and an equal share for each player. Pure, no React or storage.
import type { Party as Campaign } from '../party/types'
import type { Combatant, Encounter } from './types'

export interface FightCreature {
  id: string
  name: string
  xp: number
  /** At 0 HP when the fight ended: ticked by default. */
  beaten: boolean
}

/** The fight's monster and NPC rows that are worth XP (their stat block says how much). */
export function fightCreatures(enc: Encounter, xpOf: (c: Combatant) => number | undefined, isDown: (c: Combatant) => boolean): FightCreature[] {
  return enc.combatants.flatMap(c => {
    const xp = c.kind === 'npc' ? Math.max(0, Math.floor(xpOf(c) ?? 0)) : 0
    return xp > 0 ? [{ id: c.id, name: c.name, xp, beaten: isDown(c) }] : []
  })
}

/** The campaign's players who share the XP: those whose character fought, else every player who brings one. */
export function fightPlayers(campaign: Campaign, enc: Encounter): { userId: string; characterId: string }[] {
  const all = campaign.members.flatMap(m => (m.characterId && m.userId !== campaign.dmId ? [{ userId: m.userId, characterId: m.characterId }] : []))
  const fought = new Set(enc.combatants.flatMap(c => (c.kind === 'pc' && c.characterId ? [c.characterId] : [])))
  const inFight = all.filter(m => fought.has(m.characterId))
  return inFight.length ? inFight : all
}

/** Each player's equal share of the XP, rounded down (SRD: divide the total evenly). */
export const xpShare = (total: number, players: number) => (players > 0 ? Math.floor(Math.max(0, total) / players) : 0)

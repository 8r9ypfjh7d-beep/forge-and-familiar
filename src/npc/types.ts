// Saved NPC sheet shape: a named creature the DM runs, built on a monster stat block the way a
// hero is built on a race and class. Nothing derived (modifiers, slot counts, legendary counts) is stored:
// src/monsters/block reads those from the block.
import type { ConditionId } from '../rules/types'
import type { Block } from '../monsters/block'

export const NPC_SCHEMA_VERSION = 1

export interface NpcSheet {
  id: string
  /** The DM account. Only the owner (and the admin) can read it; players never see NPC sheets. */
  ownerId: string
  schemaVersion: number
  /** Campaign it belongs to. Missing: shows in every campaign the DM runs. */
  partyId?: string
  /** The individual: "Captain Vexa". `block.name` stays the creature: "Bandit Captain". */
  name: string
  /** "Leader of the Red Hand", shown under the name. */
  role?: string
  portrait?: string
  /** DM-only: motivation, voice, what they know. */
  notes: string
  /** Where the block came from, for "Reset to book" and CC-BY attribution. Missing: built from scratch. */
  base?: { source: string; id: string; name: string }
  /** The stat block as the DM wants it: a Monster copy, edited. `hitPoints` is this NPC's max HP (rolled, average or typed). */
  block: Block
  state: NpcState
  createdAt: string
  updatedAt: string
}

/** Play state, owned by the NPC sheet; the initiative tracker writes it through src/npc/engine. */
export interface NpcState {
  currentHp: number
  tempHp: number
  conditions: ConditionId[]
  /** Spent uses per action name. Recharge actions: 1 while spent, 0 once recharged. */
  uses: Record<string, number>
  /** Legendary actions spent this round; back to 0 at the start of the NPC's turn. */
  legendaryUsed: number
  legendaryResistanceUsed: number
  /** Used spell slots, index 0 = 1st level, length 9. */
  slotsUsed: number[]
  /** Spent per-day spell uses, keyed by spellcasting group label ("1/day each"). */
  spellUses: Record<string, number>
}

export const freshState = (maxHp: number): NpcState => ({
  currentHp: maxHp, tempHp: 0, conditions: [], uses: {}, legendaryUsed: 0, legendaryResistanceUsed: 0,
  slotsUsed: Array<number>(9).fill(0), spellUses: {},
})

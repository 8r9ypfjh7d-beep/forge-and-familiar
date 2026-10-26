// A player's request to the DM: a new item, effect or ability for their character, or anything else.
// Saved shape. One list per device (ff.requests.v1); links carry requests and answers between devices.
import type { CustomAction } from '../model/character'
import type { ItemEffect } from '../rules/types'

export type RequestKind = 'item' | 'effect' | 'ability' | 'other'
export const REQUEST_KINDS: RequestKind[] = ['item', 'effect', 'ability', 'other']

/**
 * pending: waiting for the DM. later: approved, the DM weaves it into the story and grants it when the moment comes.
 * granted: added to the character. denied: not this time.
 */
export type RequestStatus = 'pending' | 'later' | 'granted' | 'denied'

export interface DmRequest {
  id: string
  /** UserProfile id (account id) of the player who asked. */
  fromId: string
  fromName: string
  characterId: string
  characterName: string
  kind: RequestKind
  title: string
  /** Description: what it is, what it does, why the character should have it. */
  details: string
  /** Dice it rolls when used: an attack or a save, then dice like 2d6+STR with a damage type. */
  roll?: CustomAction['roll']
  /** Extra damage on every attack while it is on (an item's or a switched-on effect's), e.g. 1d6 fire. */
  extraDamage?: { damage: string; type?: string }
  /** Stat changes: AC, saves, checks, attack, damage, speed, ability scores. */
  stats?: ItemEffect[]
  createdAt: string
  status: RequestStatus
  /** The DM's answer to the player. */
  reply?: string
  /** The DM's private story idea for a "later" request. Never sent to the player. */
  storyNote?: string
  decidedAt?: string
  /** Player's device: the grant was added to the character. */
  applied?: boolean
}

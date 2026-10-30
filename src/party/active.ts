// The party (campaign) a player is playing in right now. Picked on entering the app; its DM gets the
// DM pages, everyone else the player pages. The last pick is remembered per player for next time.
import { isAdmin } from '../accounts/roster'
import type { Party } from './types'

const LAST = (userId: string) => `ff.activeParty.v1.${userId}`
/** Set once the player picked this visit, so a reload in the same tab doesn't ask again. */
const PICKED = (userId: string) => `ff.partyPicked.v1.${userId}`
/** Saved when the player chose to play without a party. */
export const NO_PARTY = 'none'

export const lastPartyId = (userId: string): string | null => {
  try { return localStorage.getItem(LAST(userId)) } catch { return null }
}

export const pickedThisVisit = (userId: string): boolean => {
  try { return sessionStorage.getItem(PICKED(userId)) === '1' } catch { return false }
}

/** Marks this visit as picked, so a party made or joined mid-game doesn't pop the picker up. */
export function markPicked(userId: string) {
  try {
    sessionStorage.setItem(PICKED(userId), '1')
  } catch {
    // Storage blocked: the app may ask again.
  }
}

/** Remembers the pick; null plays without a party (player pages). */
export function rememberParty(userId: string, partyId: string | null) {
  try {
    localStorage.setItem(LAST(userId), partyId ?? NO_PARTY)
  } catch {
    // Storage blocked: the app asks again next time.
  }
  markPicked(userId)
}

/** The party in play: the remembered one while the player is still in it, or their only party. */
export function activeParty(parties: readonly Party[], lastId: string | null): Party | undefined {
  if (lastId === NO_PARTY) return undefined
  return parties.find(p => p.id === lastId) ?? (parties.length === 1 ? parties[0] : undefined)
}

/** Whether this player runs the party: the DM pages follow the party, not the account. */
export const isPartyDm = (party: Party | undefined, userId: string) => !!party && party.dmId === userId

/** Whether this player may end the campaign for everyone: its DM, or the admin. */
export const canEndParty = (party: Party, userId: string) => isPartyDm(party, userId) || isAdmin(userId)

/** Where tapping a campaign on the home screen leads: its DM runs the game, a player opens the sheet they
 *  bring when it is on this device, else the party page to pick (or find) their character. */
export type CampaignTarget = { kind: 'dm' } | { kind: 'sheet'; id: string } | { kind: 'party'; partyId: string }

export function campaignTarget(party: Party, userId: string, ownCharacterIds: readonly string[]): CampaignTarget {
  if (isPartyDm(party, userId)) return { kind: 'dm' }
  const brings = party.members.find(m => m.userId === userId)?.characterId
  return brings && ownCharacterIds.includes(brings) ? { kind: 'sheet', id: brings } : { kind: 'party', partyId: party.id }
}

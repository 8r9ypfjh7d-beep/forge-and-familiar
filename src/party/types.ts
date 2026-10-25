// Saved party shape. A party links players (UserProfile ids) and the character each brings.
export interface PartyMember {
  userId: string
  /** The character this player brings. Unset means watching only (e.g. the DM). */
  characterId?: string
  joinedAt: string
}

export interface Party {
  id: string
  name: string
  /** Invite code, stored normalised (6 chars, no dash). Shown as ABC-DEF. */
  code: string
  /** UserProfile.id of the creator, shown as the party's DM. */
  dmId: string
  members: PartyMember[]
  /** Shared inventory and gold. Missing on parties made before the stash existed. */
  stash?: PartyStash
  createdAt: string
  updatedAt: string
}

export type Coin = 'cp' | 'sp' | 'ep' | 'gp' | 'pp'
export type Coins = Record<Coin, number>

export interface StashItem {
  id: string
  name: string
  qty: number
  /** SRD item id when picked from the item list; unset for loot typed by hand. */
  itemId?: string
  note?: string
  /** UserProfile.id of the member carrying it. Unset means it is in the party bag. */
  heldBy?: string
}

export interface StashLogEntry {
  at: string
  userId: string
  text: string
}

/** Shared loot and gold. Anyone in the party can change it; every change is logged. */
export interface PartyStash {
  items: StashItem[]
  coins: Coins
  /** Newest first, capped at STASH_LOG_LIMIT. */
  log: StashLogEntry[]
}

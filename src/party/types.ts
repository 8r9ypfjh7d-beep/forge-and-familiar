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
  /** When the DM ended it. An ended campaign keeps everything and leaves every list but Ended campaigns,
   *  where its DM (or the admin) can bring it back or delete it for good. */
  endedAt?: string
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

/** XP the DM gave: an amount, or a milestone level. Each player's device adds it to the named character once. */
export interface XpAward {
  id: string
  at: string
  /** The DM's UserProfile id. */
  by: string
  xp?: number
  milestone?: boolean
  /** Who gets it: the player and the character they brought when it was given. */
  to: { userId: string; characterId: string }[]
}

/** Shared loot and gold. Anyone in the party can change it; every change is logged. */
export interface PartyStash {
  items: StashItem[]
  coins: Coins
  /** XP awards from the DM, newest first, capped at AWARD_LIMIT. Missing on older stashes. */
  awards?: XpAward[]
  /** Newest first, capped at STASH_LOG_LIMIT. */
  log: StashLogEntry[]
}

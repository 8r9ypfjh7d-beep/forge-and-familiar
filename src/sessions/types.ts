// Saved shape of the DM's session notes. Each game night gets one note: the part players read once the DM
// shares it (recap, people met, loot, leads) and a private part only the DM ever sees (jots during play,
// own notes, the plan for next time). The two halves are stored apart so the server can hide the private one.

/** Something the party should follow up on. Done leads stay listed, struck through. */
export interface Lead {
  id: string
  text: string
  /** When the DM ticked it off; unset while open. */
  doneAt?: string
}

/** The part of a session the players read after the DM shares it. */
export interface SessionNote {
  id: string
  partyId: string
  /** UserProfile.id of the DM who wrote it. */
  fromId: string
  /** "Session 4". Starts at 1 and counts up; the DM may change it. */
  number: number
  title: string
  /** Day of play, YYYY-MM-DD. */
  playedOn: string
  /** What happened, in lore markup (src/lore/markup.ts): **bold**, *italic*, lists, [[Lore entry]] links. */
  recap: string
  /** People and creatures the party met, one per line. */
  people: string[]
  /** Treasure and items found, one per line. */
  loot: string[]
  leads: Lead[]
  /** Unset while only the DM sees it. Set when shared with every player. */
  sharedAt?: string
  createdAt: string
  updatedAt: string
}

/** One quick line the DM typed during play. */
export interface Jot {
  id: string
  at: string
  text: string
}

/** The DM's private half of a session. Same id as its SessionNote. Never shown to players. */
export interface SessionSecret {
  id: string
  partyId: string
  jots: Jot[]
  /** The DM's own notes: what really happened behind the curtain, rulings, reminders. */
  notes: string
  /** Prep for the next game; shown again when the DM starts the next session. */
  nextTime: string
  updatedAt: string
}

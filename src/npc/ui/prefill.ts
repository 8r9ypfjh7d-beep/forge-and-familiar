// What the NPC creator opens with. The route (#/npc/new) carries no data, so the screen that opens the
// creator (DM screen's Monsters tab, a text NPC's "Give stats") leaves the prefill here for one read.
import type { Npc } from '../../dm/types'

export interface NpcPrefill {
  /** A library stat block to start from. */
  monster?: { source: string; id: string }
  /** A text NPC from the DM screen that becomes a sheet; it is removed from the list once the sheet is saved. */
  text?: Npc
  /** Made from a fight plan on the DM screen: the sheet joins this plan and the DM goes back to Fights. */
  fightPlanId?: string
  /** The campaign being run. */
  partyId?: string
}

const KEY = 'ff.npc.prefill'

export function stashNpcPrefill(p: NpcPrefill) {
  try { sessionStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private mode: the creator opens blank */ }
}

/** Reads and clears the prefill. */
export function takeNpcPrefill(): NpcPrefill | undefined {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return raw ? (JSON.parse(raw) as NpcPrefill) : undefined
  } catch {
    return undefined
  }
}

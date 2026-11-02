// Players roll initiative on their own phones (sheet "Initiative" button). The DM's tracker fills a party
// row that is still waiting with that roll, so nobody reads numbers across the table. Pure, no React.
import type { RollResult } from '../dice'
import type { Encounter } from './types'

/** Rolls this long before the fight was set up still count: the DM often calls for initiative while opening it. */
export const EARLY_MS = 5 * 60_000

/**
 * For each party row still waiting for initiative: the latest initiative roll its character made since the fight
 * was set up (or since it last ended), skipping rolls already used once (`used`), so clearing a row stays cleared.
 */
export function phoneInitiatives(enc: Encounter, rolls: readonly RollResult[], used: ReadonlySet<string> = new Set()): { combatantId: string; roll: RollResult }[] {
  const since = enc.endedAt ? Date.parse(enc.endedAt) : Date.parse(enc.createdAt) - EARLY_MS
  const out: { combatantId: string; roll: RollResult }[] = []
  for (const c of enc.combatants) {
    if (c.kind !== 'pc' || c.initiative !== null || !c.characterId) continue
    let best: RollResult | undefined
    for (const r of rolls) {
      if (r.type !== 'initiative' || r.roller?.characterId !== c.characterId || used.has(r.id)) continue
      const at = Date.parse(r.timestamp)
      if (!(at >= since)) continue
      if (!best || at > Date.parse(best.timestamp)) best = r
    }
    if (best) out.push({ combatantId: c.id, roll: best })
  }
  return out
}

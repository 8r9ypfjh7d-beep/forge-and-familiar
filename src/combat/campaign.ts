// The campaign's party as tracker rows: every character a member brings, read from this device or, for a
// character on a player's phone, from the cloud (members may read each other's brought characters).
import type { Party as Campaign } from '../party/types'
import { fetchPartyCharacters } from '../party/cloud'
import { derive } from '../rules'
import { getCharacter } from '../storage'
import type { Combatant } from './types'

/** Character ids the campaign's players bring (the DM's own watching seat left out). */
export const campaignCharacterIds = (campaign: Campaign) =>
  campaign.members.filter(m => m.userId !== campaign.dmId).flatMap(m => (m.characterId ? [m.characterId] : []))

/** Party rows for the characters not yet in the fight. Characters that cannot be found are skipped. */
export async function campaignRows(campaign: Campaign, inFight: Iterable<string | undefined>, newId: () => string): Promise<Omit<Combatant, 'conditions'>[]> {
  const have = new Set(inFight)
  const ids = campaignCharacterIds(campaign).filter(id => !have.has(id))
  const local = await Promise.all(ids.map(getCharacter))
  const missing = ids.filter((_, i) => !local[i])
  const remote = new Map((missing.length ? await fetchPartyCharacters(missing).catch(() => []) : []).map(c => [c.id, c]))
  return ids.flatMap((id, i) => {
    const c = local[i] ?? remote.get(id)
    return c ? [{ id: newId(), name: c.name, kind: 'pc' as const, characterId: c.id, initiative: null, initBonus: derive(c).initiative }] : []
  })
}

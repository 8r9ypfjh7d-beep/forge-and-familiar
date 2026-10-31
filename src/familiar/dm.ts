// The DM side of the Familiar: the DM screen's context card, the data the DM tools read, and the DM's quick chips.
// `dmCard` is pure; `dmToolData` reads this device and the cloud the same way the DM screen does.
import { rosterName } from '../accounts'
import { activePlan, difficulty, partyBudget, planXp } from '../dm/logic'
import { loadDm } from '../dm/store'
import type { DmState } from '../dm/types'
import type { MessageKey } from '../i18n'
import type { Character } from '../model/character'
import { crLabel } from '../monsters/format'
import { listNpcs } from '../npc/store'
import type { NpcSheet } from '../npc/types'
import { fetchAccountNames, fetchPartyCharacters } from '../party/cloud'
import type { Party } from '../party/types'
import { derive } from '../rules'
import { getCharacter } from '../storage'
import type { DmToolData } from './tools/dm'

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s)

export interface DmCardInput {
  campaign?: Party
  dmState?: DmState
  npcSheets?: NpcSheet[]
  /** The campaign's characters already loaded (for names and levels); optional. */
  characters?: Character[]
}

/** The DM screen on one card: campaign, party levels and budget, the open encounter, other plans, NPCs. No player secrets. */
export function dmCard({ campaign, dmState, npcSheets = [], characters = [] }: DmCardInput): string {
  const lines: string[] = []
  if (campaign) {
    const seats = campaign.members.filter(m => m.userId !== campaign.dmId)
    lines.push(`Campaign: ${campaign.name}. ${seats.length} player(s); the asker is its DM. Call get_party for the characters' current stats.`)
  } else lines.push('No campaign picked on the DM screen (admin view).')
  if (characters.length) lines.push(`Characters: ${characters.map(c => `${c.name} (level ${derive(c).level})`).join(', ')}.`)
  if (dmState) {
    const budget = partyBudget(dmState.party)
    lines.push(`Budget party: ${dmState.party.map(g => `${g.count} at level ${g.level}`).join(', ')}. XP budget Low ${budget.low}, Moderate ${budget.moderate}, High ${budget.high} (SRD 5.2).`)
    const plan = activePlan(dmState)
    if (plan) {
      const xp = planXp(plan)
      const monsters = plan.monsters.map(m => `${m.count} x ${m.name} (CR ${crLabel(m.cr)}${m.npcId ? `, NPC sheet npc:${m.npcId}` : `, id ${m.monsterId}`})`).join(', ') || 'no monsters yet'
      lines.push(`Open encounter "${plan.name}": ${monsters}. ${xp} XP, ${difficulty(xp, budget)}.`)
      if (plan.notes) lines.push(`Its DM notes: ${cut(plan.notes.replace(/\s+/g, ' '), 500)}`)
    }
    const others = dmState.plans.filter(p => p !== plan).map(p => p.name)
    if (others.length) lines.push(`Other plans: ${others.slice(0, 12).join(', ')}.`)
    if (dmState.npcs.length) lines.push(`Quick NPCs: ${dmState.npcs.slice(0, 15).map(n => `${n.name}${n.role ? ` (${n.role})` : ''}`).join(', ')}.`)
  }
  if (npcSheets.length) lines.push(`NPC sheets: ${npcSheets.slice(0, 15).map(n => `${n.name} (${n.block.name}, CR ${crLabel(n.block.challengeRating)}, id npc:${n.id})`).join(', ')}.`)
  return lines.join('\n')
}

/** Every character a campaign's players bring, from this device first, then the cloud. Missing ones are skipped. */
export async function loadCampaignCharacters(ids: string[]): Promise<Character[]> {
  const local = await Promise.all(ids.map(id => getCharacter(id)))
  const missing = ids.filter((_, i) => !local[i])
  const remote = new Map((missing.length ? await fetchPartyCharacters(missing).catch(() => []) : []).map(c => [c.id, c]))
  return ids.flatMap((id, i) => { const c = local[i] ?? remote.get(id); return c ? [c] : [] })
}

/** What the DM tools read, for the DM screen of `userId` running `campaign`. Put it in `ToolEnv.data.dm`. */
export async function dmToolData(userId: string, campaign?: Party): Promise<DmToolData> {
  const [dmState, npcSheets, names] = await Promise.all([
    loadDm(userId).catch(() => undefined),
    listNpcs(userId, campaign?.id).catch(() => []),
    fetchAccountNames().catch(() => ({} as Record<string, string>)),
  ])
  return {
    campaign,
    dmState,
    npcSheets,
    getCharacters: loadCampaignCharacters,
    playerName: id => names[id] ?? rosterName(id),
  }
}

/** Starter questions on the DM screen (plan: "Explain grapple", "Is this fight fair?", ...). */
export const DM_CHIPS: readonly MessageKey[] = [
  'familiar.dm.chip.fair',
  'familiar.dm.chip.turn',
  'familiar.dm.chip.ruling',
  'familiar.dm.chip.npc',
  'familiar.dm.chip.monsters',
]

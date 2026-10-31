// What the Familiar knows about from the screen the user is on, before a screen sets its own (sheet, builder, DM screen).
// Pure: the app's view, the character on screen and the campaign in play in; context, card, role and subject out.
import type { MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import { rulesEdition } from '../../rules'
import { characterCard } from '../context'
import { dmCard, dmToolData, loadCampaignCharacters } from '../dm'
import type { Party } from '../../party/types'
import type { FamiliarContext } from '../types'

export interface ScreenSetup {
  context: FamiliarContext
  role: 'player' | 'dm'
  edition?: '2014' | '2024'
  card?: string
  /** i18n key and vars for the "About Vex" line. */
  subject?: { key: MessageKey; vars?: Record<string, string> }
}

/** Screens about one character of your own: the sheet and its side pages. */
const CHARACTER_VIEWS = ['sheet', 'edit', 'levelup', 'levels', 'plan', 'print']
/** DM pages. A watched player sheet stays DM help: the DM asks as the DM. */
const DM_VIEWS = ['dm', 'combat', 'npc', 'watch']

export function screenFor(view: { kind: string }, s: { character?: Character; isDm: boolean; partyDm: boolean; campaign?: { id: string; name: string } }): ScreenSetup {
  if (DM_VIEWS.includes(view.kind) && s.isDm) {
    const c = s.campaign
    return { context: c ? { kind: 'dm', partyId: c.id } : { kind: 'dm' }, role: 'dm', subject: c ? { key: 'familiar.aboutCampaign', vars: { name: c.name } } : { key: 'familiar.aboutDm' } }
  }
  const role = s.partyDm ? 'dm' : 'player'
  if (CHARACTER_VIEWS.includes(view.kind) && s.character) {
    const c = s.character
    let card: string | undefined
    try { card = characterCard(c) } catch { card = undefined }
    return { context: { kind: 'character', characterId: c.id }, role: 'player', edition: rulesEdition(c), card, subject: { key: 'familiar.aboutCharacter', vars: { name: c.name } } }
  }
  if (view.kind === 'build' || view.kind === 'starters') return { context: { kind: 'builder' }, role: 'player', subject: { key: 'familiar.aboutDraft' } }
  return { context: { kind: 'general' }, role }
}

/** The DM screen's card and tool data, loaded when the DM asks (src/familiar/dm.ts). */
export async function dmPrepare(userId: string, campaign?: Party) {
  const dm = await dmToolData(userId, campaign)
  const characters = campaign ? await loadCampaignCharacters(campaign.members.flatMap(m => (m.characterId ? [m.characterId] : []))).catch(() => []) : []
  return { card: dmCard({ campaign, dmState: dm.dmState, npcSheets: dm.npcSheets, characters }), data: { dm } }
}

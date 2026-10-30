// Who may open which character sheet. Pure, no React, no storage.
//
// The rule mirrors the server (characters_read + characters_party_read): a character is readable by
// its owner, by the admin, and by everyone in a party where its owner brings it, the DM included.
// NPC sheets (src/npc) are not characters and never pass through here: they are DM pages, guarded
// by canOpen('npc') in src/nav, and their rows are owner-only in the database.
import { isAdmin } from '../accounts'
import type { Character } from '../model/character'
import type { Party } from './types'

export interface Viewer {
  /** The open profile. */
  userId: string
  /** The parties this profile is in (what the device knows). */
  parties: readonly Party[]
}

/** Whether a party member brings this character to a party the viewer is in. */
export function broughtToSharedParty(character: Pick<Character, 'id' | 'ownerId'>, viewer: Viewer): boolean {
  return viewer.parties.some(p =>
    p.members.some(m => m.userId === viewer.userId) &&
    p.members.some(m => m.userId === character.ownerId && m.characterId === character.id))
}

/** Whether the viewer may see this character's sheet. */
export function canViewCharacter(character: Pick<Character, 'id' | 'ownerId'>, viewer: Viewer): boolean {
  if (character.ownerId === viewer.userId) return true
  if (isAdmin(viewer.userId)) return true
  return broughtToSharedParty(character, viewer)
}

/** Whether the viewer runs a party this character is brought to: the DM of its table. */
export function isDmOf(character: Pick<Character, 'id' | 'ownerId'>, viewer: Viewer): boolean {
  return viewer.parties.some(p => p.dmId === viewer.userId && p.members.some(m => m.userId === character.ownerId && m.characterId === character.id))
}

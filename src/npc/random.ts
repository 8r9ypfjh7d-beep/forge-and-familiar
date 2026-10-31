// A random NPC for the creator's 🎲 button, pure: the caller passes the monster list and a chooser.
// Favours creatures a DM names (humanoids, CR up to 5) so the result reads as a person, not a dragon.
import type { Block } from '../monsters/block'
import { randomName, randomNpc, randomPick, type Chooser, type NpcIdea } from '../dm/logic'

export interface RandomNpcPick {
  monster: Block
  name: string
  idea: NpcIdea
}

/** Picks a creature and a persona. Falls back to the whole list when no humanoid fits. */
export function randomNpcPick(monsters: Block[], pick: Chooser = randomPick): RandomNpcPick | undefined {
  if (!monsters.length) return undefined
  const people = monsters.filter(m => /humanoid/i.test(m.type) && m.challengeRating <= 5)
  const pool = people.length ? people : monsters
  const monster = pool[pick(pool.length)]
  const idea = randomNpc(pick)
  return { monster, name: idea.name || randomName(pick), idea }
}

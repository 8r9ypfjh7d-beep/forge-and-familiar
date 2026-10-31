// Damage and healing landing on any row: monsters through the encounter, party members through the sheet
// engine. A party member whose character lives on a player's phone (read-only here) only gets a log line.
import type { Character } from '../../model/character'
import { heal, takeDamage } from '../../sheet/engine'
import { addLog, damageNpc, healNpc, noteDamage, type Party } from '../engine'
import type { Encounter } from '../types'

export type Outcome = Encounter | { encounter: Encounter; characters: Character[] }

export function applyDamage(e: Encounter, party: Party, remote: ReadonlySet<string>, targetId: string, amount: number, checkId: string): Outcome {
  const c = e.combatants.find(x => x.id === targetId)
  if (!c || amount <= 0) return e
  if (c.kind === 'npc') return damageNpc(e, c.id, amount, checkId)
  const pc = c.characterId ? party[c.characterId] : undefined
  if (!pc) return e
  if (c.characterId && remote.has(c.characterId)) return addLog(e, 'combat.log.hitRemote', { name: c.name, amount })
  return { encounter: noteDamage(addLog(e, 'combat.log.takes', { name: c.name, amount }), c.id, amount, checkId), characters: [takeDamage(pc, amount)] }
}

export function applyHeal(e: Encounter, party: Party, remote: ReadonlySet<string>, targetId: string, amount: number): Outcome {
  const c = e.combatants.find(x => x.id === targetId)
  if (!c || amount <= 0) return e
  if (c.kind === 'npc') return healNpc(e, c.id, amount)
  const pc = c.characterId ? party[c.characterId] : undefined
  if (!pc || (c.characterId && remote.has(c.characterId))) return e
  return { encounter: addLog(e, 'combat.log.heals', { name: c.name, amount }), characters: [heal(pc, amount)] }
}

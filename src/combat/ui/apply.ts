// Damage and healing landing on any row: monsters through the encounter, NPC sheets through src/npc
// (resistances, immunities and vulnerabilities apply), party members through the sheet engine.
// A party member whose character lives on a player's phone (read-only here) gets a queued hit
// that the player's device applies once it sees the live combat row.
import type { Monster } from '../../content'
import type { Character } from '../../model/character'
import { heal as healNpcSheet, npcDefense, setCondition, takeDamage as damageNpcSheet, type NpcSheet } from '../../npc'
import type { ConditionId } from '../../rules/types'
import { heal, takeDamage } from '../../sheet/engine'
import { addHit, addLog, damageNpc, healNpc, noteDamage, type Party } from '../engine'
import type { NpcSheets } from '../npcRows'
import type { Encounter } from '../types'

export type Outcome = Encounter | { encounter: Encounter; characters?: Character[]; npcs?: NpcSheet[] }

/** Damage as one number, or as typed parts ("1d8 slashing + 2d6 fire") so an NPC's defenses apply to each. */
export type Damage = number | { amount: number; type?: string }[]

const parts = (d: Damage) => (typeof d === 'number' ? [{ amount: d }] : d).filter(p => p.amount > 0)

const DEFENSE_KEYS = { immune: 'combat.log.immune', resistant: 'combat.log.resists', vulnerable: 'combat.log.vulnerable' } as const

/**
 * `block` is a library monster row's stat block: typed damage then meets its immunities, resistances and
 * vulnerabilities, as on an NPC sheet.
 */
export function applyDamage(e: Encounter, party: Party, remote: ReadonlySet<string>, targetId: string, damage: Damage, checkId: string, npcs: NpcSheets = {}, block?: Monster, critical = false): Outcome {
  const c = e.combatants.find(x => x.id === targetId)
  const list = parts(damage)
  const amount = list.reduce((n, p) => n + p.amount, 0)
  if (!c || amount <= 0) return e
  const sheet = c.npcId ? npcs[c.npcId] : undefined
  if (sheet) {
    let s = sheet
    let dealt = 0
    let next = e
    for (const p of list) {
      const hit = damageNpcSheet(s, p.amount, p.type)
      s = hit.npc
      dealt += hit.dealt
      if (hit.defense && p.type) next = addLog(next, DEFENSE_KEYS[hit.defense], { name: c.name, type: p.type })
    }
    next = addLog(next, s.state.currentHp <= 0 ? 'combat.log.takesDown' : 'combat.log.takes', { name: c.name, amount: dealt })
    return { encounter: noteDamage(next, c.id, dealt, checkId), npcs: [s] }
  }
  if (c.kind === 'npc' && block) {
    const as = { block, state: { conditions: c.conditions } } as unknown as NpcSheet
    let next = e
    let dealt = 0
    for (const p of list) {
      const d = npcDefense(as, p.type)
      dealt += d === 'immune' ? 0 : d === 'resistant' ? Math.floor(p.amount / 2) : d === 'vulnerable' ? p.amount * 2 : p.amount
      if (d && p.type) next = addLog(next, DEFENSE_KEYS[d], { name: c.name, type: p.type })
    }
    return damageNpc(next, c.id, dealt, checkId)
  }
  if (c.kind === 'npc') return damageNpc(e, c.id, amount, checkId)
  const pc = c.characterId ? party[c.characterId] : undefined
  if (!pc) return e
  if (c.characterId && remote.has(c.characterId)) {
    return addHit(addLog(e, 'combat.log.hitRemote', { name: c.name, amount }), { id: checkId, characterId: c.characterId, kind: 'damage', amount, at: new Date().toISOString(), ...(critical ? { critical } : {}) })
  }
  // A critical hit on a party member at 0 HP counts as two failed death saves (sheet engine).
  return { encounter: noteDamage(addLog(e, 'combat.log.takes', { name: c.name, amount }), c.id, amount, checkId), characters: [takeDamage(pc, amount, { critical })] }
}

export function applyHeal(e: Encounter, party: Party, remote: ReadonlySet<string>, targetId: string, amount: number, npcs: NpcSheets = {}): Outcome {
  const c = e.combatants.find(x => x.id === targetId)
  if (!c || amount <= 0) return e
  const sheet = c.npcId ? npcs[c.npcId] : undefined
  if (sheet) return { encounter: addLog(e, 'combat.log.heals', { name: c.name, amount }), npcs: [healNpcSheet(sheet, amount)] }
  if (c.kind === 'npc') return healNpc(e, c.id, amount)
  const pc = c.characterId ? party[c.characterId] : undefined
  if (!pc) return e
  if (c.characterId && remote.has(c.characterId)) {
    return addHit(addLog(e, 'combat.log.healRemote', { name: c.name, amount }), { id: crypto.randomUUID(), characterId: c.characterId, kind: 'heal', amount, at: new Date().toISOString() })
  }
  return { encounter: addLog(e, 'combat.log.heals', { name: c.name, amount }), characters: [heal(pc, amount)] }
}

/** Sets an NPC sheet's hand-set conditions; ones its block is immune to are refused (src/npc setCondition). */
export function applyNpcConditions(e: Encounter, sheet: NpcSheet, next: ConditionId[]): Outcome {
  let s = sheet
  for (const x of s.state.conditions) if (!next.includes(x)) s = setCondition(s, x, false)
  for (const x of next) s = setCondition(s, x, true)
  return { encounter: e, npcs: [s] }
}

/** Runs changes one after another, each seeing the characters and NPC sheets the previous ones changed. */
export function chain(e: Encounter, party: Party, npcs: NpcSheets, steps: ((e: Encounter, party: Party, npcs: NpcSheets) => Outcome)[]): Outcome {
  let enc = e
  const p: Party = { ...party }
  const n: NpcSheets = { ...npcs }
  const characters = new Map<string, Character>()
  const sheets = new Map<string, NpcSheet>()
  for (const step of steps) {
    const out = step(enc, p, n)
    if ('encounter' in out) {
      enc = out.encounter
      for (const c of out.characters ?? []) { p[c.id] = c; characters.set(c.id, c) }
      for (const s of out.npcs ?? []) { n[s.id] = s; sheets.set(s.id, s) }
    } else enc = out
  }
  return { encounter: enc, characters: [...characters.values()], npcs: [...sheets.values()] }
}

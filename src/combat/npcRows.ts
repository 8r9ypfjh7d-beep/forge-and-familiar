// Rows that play a DM-private NPC sheet (src/npc): the sheet owns HP, conditions, limited uses and
// legendary actions; the row carries a copy so the tracker, playerView and the live row read it
// like any monster row. Pure, no storage.
import type { NpcSheet } from '../npc/types'
import { conSave, initBonus } from '../monsters/block'
import type { Combatant, Encounter } from './types'

/** NPC sheets by id, as loaded by the tracker. */
export type NpcSheets = Record<string, NpcSheet | undefined>

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const spentOf = (s: NpcSheet) => Object.fromEntries(Object.entries(s.state.uses).filter(([, n]) => n > 0))

/** A new tracker row for an NPC sheet. */
export function npcCombatant(npc: NpcSheet, id: string): Combatant & { initBonus: number } {
  return {
    id, name: npc.name, kind: 'npc', npcId: npc.id, initiative: null,
    initBonus: initBonus(npc.block), conSave: conSave(npc.block), ac: npc.block.armorClass[0]?.value,
    hp: { current: npc.state.currentHp, max: npc.block.hitPoints, temp: npc.state.tempHp },
    conditions: [...npc.state.conditions], spent: spentOf(npc), legendaryUsed: npc.state.legendaryUsed,
  }
}

/** Copies each linked sheet's play state onto its row. Returns the same encounter when nothing changed. */
export function mirrorNpcs(enc: Encounter, npcs: NpcSheets): Encounter {
  let changed = false
  const combatants = enc.combatants.map(c => {
    const s = c.npcId ? npcs[c.npcId] : undefined
    if (!s) return c
    const patch = {
      hp: { current: s.state.currentHp, max: s.block.hitPoints, temp: s.state.tempHp },
      ac: s.block.armorClass[0]?.value ?? c.ac,
      conditions: [...s.state.conditions],
      spent: spentOf(s),
      legendaryUsed: s.state.legendaryUsed,
    }
    if (same(patch, { hp: c.hp, ac: c.ac, conditions: c.conditions, spent: c.spent ?? {}, legendaryUsed: c.legendaryUsed ?? 0 })) return c
    changed = true
    return { ...c, ...patch }
  })
  return changed ? { ...enc, combatants } : enc
}

/**
 * Row changes a step made through the encounter engine (spending an action, a recharge, legendary
 * actions back at the start of the turn, damage from code that only knows rows) written to the
 * linked sheets. Sheets the step already changed itself (`touched`) are left as they are.
 */
export function npcChangesFromRows(before: Encounter, after: Encounter, npcs: NpcSheets, touched: ReadonlySet<string> = new Set()): NpcSheet[] {
  const out: NpcSheet[] = []
  for (const c of after.combatants) {
    const s = c.npcId ? npcs[c.npcId] : undefined
    const was = before.combatants.find(x => x.id === c.id)
    if (!s || !was || touched.has(s.id)) continue
    const state = { ...s.state }
    if (!same(was.spent ?? {}, c.spent ?? {})) state.uses = { ...(c.spent ?? {}) }
    if ((was.legendaryUsed ?? 0) !== (c.legendaryUsed ?? 0)) state.legendaryUsed = c.legendaryUsed ?? 0
    if (c.hp && !same(was.hp, c.hp)) { state.currentHp = Math.max(0, Math.min(s.block.hitPoints, c.hp.current)); state.tempHp = Math.max(0, c.hp.temp) }
    if (!same(was.conditions, c.conditions)) state.conditions = [...c.conditions]
    if (!same(state, s.state)) out.push({ ...s, state })
  }
  return out
}

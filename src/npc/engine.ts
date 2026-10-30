// Every NPC sheet change, pure: each function takes an NpcSheet and returns a new one, with no dice
// or storage, so the UI can undo by keeping the old value. Rolls are made by the caller through src/dice.
import type { MonsterAction } from '../content'
import type { ConditionId } from '../rules/types'
import { damageAfterDefenses, type DamageDefense } from '../rules/damage'
import { actionUses, legendaryCount, legendaryResistance, perDayGroups, spellSlots, type Block } from '../monsters/block'
import { NPC_SCHEMA_VERSION, freshState, type NpcSheet, type NpcState } from './types'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const int = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback)

export function newNpc(input: { id: string; ownerId: string; name: string; block: Block; base?: NpcSheet['base']; partyId?: string; role?: string; notes?: string; portrait?: string }, now = new Date().toISOString()): NpcSheet {
  const { id, ownerId, name, block, base, partyId, role, notes, portrait } = input
  return normalize({
    id, ownerId, schemaVersion: NPC_SCHEMA_VERSION, name, block, notes: notes ?? '', state: freshState(block.hitPoints),
    createdAt: now, updatedAt: now,
    ...(base ? { base } : {}), ...(partyId ? { partyId } : {}), ...(role ? { role } : {}), ...(portrait ? { portrait } : {}),
  })
}

/** Fills gaps in an older or hand-edited save so every screen can rely on the shape. Nothing derived is written. */
export function normalize(npc: NpcSheet): NpcSheet {
  const max = Math.max(1, int(npc.block.hitPoints, 1))
  const s: Partial<NpcState> = npc.state ?? {}
  const slots = Array.isArray(s.slotsUsed) ? s.slotsUsed.map(n => Math.max(0, int(n))) : []
  const state: NpcState = {
    currentHp: clamp(int(s.currentHp, max), 0, max),
    tempHp: Math.max(0, int(s.tempHp)),
    conditions: Array.isArray(s.conditions) ? [...new Set(s.conditions)] : [],
    uses: Object.fromEntries(Object.entries(s.uses ?? {}).map(([k, v]) => [k, Math.max(0, int(v))])),
    legendaryUsed: Math.max(0, int(s.legendaryUsed)),
    legendaryResistanceUsed: Math.max(0, int(s.legendaryResistanceUsed)),
    slotsUsed: [...slots, ...Array<number>(9).fill(0)].slice(0, 9),
    spellUses: Object.fromEntries(Object.entries(s.spellUses ?? {}).map(([k, v]) => [k, Math.max(0, int(v))])),
  }
  return { ...npc, schemaVersion: NPC_SCHEMA_VERSION, notes: npc.notes ?? '', block: { ...npc.block, hitPoints: max }, state }
}

const withState = (npc: NpcSheet, patch: Partial<NpcState>): NpcSheet => ({ ...npc, state: { ...npc.state, ...patch } })

export const maxHp = (npc: NpcSheet) => npc.block.hitPoints
export const isDown = (npc: NpcSheet) => npc.state.currentHp <= 0

/** Defense lines are free text ("fire", "bludgeoning, piercing, and slashing from nonmagical attacks"); a whole-word match counts. */
const covers = (line: string, type: string) => line.toLowerCase() === type || line.toLowerCase().split(/[^a-z]+/).includes(type)

export type NpcDefense = DamageDefense | 'vulnerable'

/** The defense that applies to one damage type: immunity beats resistance beats vulnerability. Petrified resists everything. */
export function npcDefense(npc: NpcSheet, type: string | undefined): NpcDefense | undefined {
  if (!type) return undefined
  const t = type.toLowerCase()
  const { block: m, state } = npc
  if (m.damageImmunities.some(l => covers(l, t))) return 'immune'
  if (m.damageResistances.some(l => covers(l, t)) || state.conditions.includes('petrified')) return 'resistant'
  if (m.damageVulnerabilities.some(l => covers(l, t))) return 'vulnerable'
  return undefined
}

export interface NpcHit {
  npc: NpcSheet
  /** Damage after defenses, before temp HP. */
  dealt: number
  defense?: NpcDefense
  /** Hit points lost from the real pool (temp HP took the rest). */
  lost: number
}

/** Damage with an optional type: vulnerability doubles, resistance halves, immunity takes none; temp HP goes first. */
export function takeDamage(npc: NpcSheet, amount: number, type?: string): NpcHit {
  const defense = npcDefense(npc, type)
  const raw = Math.max(0, int(amount))
  const dealt = defense === 'vulnerable' ? raw * 2 : damageAfterDefenses(raw, defense === 'immune' || defense === 'resistant' ? defense : undefined)
  const fromTemp = Math.min(npc.state.tempHp, dealt)
  const lost = Math.min(npc.state.currentHp, dealt - fromTemp)
  const next = withState(npc, { tempHp: npc.state.tempHp - fromTemp, currentHp: npc.state.currentHp - lost })
  return { npc: next, dealt, lost, ...(defense ? { defense } : {}) }
}

export function heal(npc: NpcSheet, amount: number): NpcSheet {
  return withState(npc, { currentHp: clamp(npc.state.currentHp + Math.max(0, int(amount)), 0, maxHp(npc)) })
}

/** Temporary hit points don't stack: the higher amount stays. */
export function setTempHp(npc: NpcSheet, amount: number): NpcSheet {
  return withState(npc, { tempHp: Math.max(npc.state.tempHp, Math.max(0, int(amount))) })
}

export function setHp(npc: NpcSheet, current: number): NpcSheet {
  return withState(npc, { currentHp: clamp(int(current), 0, maxHp(npc)) })
}

/** Sets or clears a condition. Conditions the block is immune to are refused. */
export function setCondition(npc: NpcSheet, condition: ConditionId, on: boolean): NpcSheet {
  if (on && npc.block.conditionImmunities.some(l => covers(l, condition))) return npc
  const has = npc.state.conditions.includes(condition)
  if (on === has) return npc
  return withState(npc, { conditions: on ? [...npc.state.conditions, condition] : npc.state.conditions.filter(c => c !== condition) })
}

/** Spends (or with a negative count, returns) uses of a limited action. Unlimited actions are untouched. */
export function useAction(npc: NpcSheet, action: MonsterAction, count = 1): NpcSheet {
  const total = actionUses(action)
  if (total == null) return npc
  const spent = clamp((npc.state.uses[action.name] ?? 0) + count, 0, total)
  return withState(npc, { uses: { ...npc.state.uses, [action.name]: spent } })
}

/** Sets the spent uses of an action straight (the sheet's pips). */
export function setUses(npc: NpcSheet, action: MonsterAction, spent: number): NpcSheet {
  const total = actionUses(action)
  if (total == null) return npc
  return withState(npc, { uses: { ...npc.state.uses, [action.name]: clamp(int(spent), 0, total) } })
}

/** A recharge roll at the start of the turn: the action comes back when the d6 (or the dice) meets the minimum. */
export function rechargeRoll(npc: NpcSheet, action: MonsterAction, rolled: number): NpcSheet {
  if (action.usage?.type !== 'recharge') return npc
  if (rolled < action.usage.minimum) return npc
  return withState(npc, { uses: { ...npc.state.uses, [action.name]: 0 } })
}

export function spendLegendary(npc: NpcSheet, cost = 1): NpcSheet {
  const total = legendaryCount(npc.block)
  if (!total) return npc
  return withState(npc, { legendaryUsed: clamp(npc.state.legendaryUsed + cost, 0, total) })
}

export function useLegendaryResistance(npc: NpcSheet): NpcSheet {
  const total = legendaryResistance(npc.block)
  if (!total || npc.state.legendaryResistanceUsed >= total) return npc
  return withState(npc, { legendaryResistanceUsed: npc.state.legendaryResistanceUsed + 1 })
}

/** Spends a slot of that level (1–9), or with `back`, returns one. */
export function spendSlot(npc: NpcSheet, level: number, back = false): NpcSheet {
  const i = level - 1
  const max = spellSlots(npc.block)[i] ?? 0
  if (i < 0 || i > 8 || !max) return npc
  const used = [...npc.state.slotsUsed]
  used[i] = clamp(used[i] + (back ? -1 : 1), 0, max)
  return withState(npc, { slotsUsed: used })
}

/** Spends one use of a per-day spell group ("1/day each"), or with `back`, returns it. */
export function spendSpellUse(npc: NpcSheet, groupLabel: string, back = false): NpcSheet {
  const max = perDayGroups(npc.block)[groupLabel]
  if (!max) return npc
  const used = clamp((npc.state.spellUses[groupLabel] ?? 0) + (back ? -1 : 1), 0, max)
  return withState(npc, { spellUses: { ...npc.state.spellUses, [groupLabel]: used } })
}

/** Start of the NPC's turn: legendary actions come back. Recharge rolls are the caller's (rechargeRoll). */
export function startTurn(npc: NpcSheet): NpcSheet {
  return npc.state.legendaryUsed ? withState(npc, { legendaryUsed: 0 }) : npc
}

const restUses = (npc: NpcSheet, rests: ('short' | 'long')[]): Record<string, number> => {
  const keep: Record<string, number> = {}
  const all = [...npc.block.traits, ...npc.block.actions, ...npc.block.bonusActions, ...npc.block.reactions, ...(npc.block.lairActions ?? [])]
  for (const [name, spent] of Object.entries(npc.state.uses)) {
    const a = all.find(x => x.name === name)
    const u = a?.usage
    const back = !u || u.type === 'recharge' || (u.type === 'per day' && rests.includes('long')) ||
      (u.type === 'per rest' && u.rests.some(r => rests.includes(r.toLowerCase() as 'short' | 'long')))
    if (!back && spent) keep[name] = spent
  }
  return keep
}

/** A short rest: per-rest and recharge actions come back, nothing else. */
export function shortRest(npc: NpcSheet): NpcSheet {
  return withState(npc, { uses: restUses(npc, ['short']), legendaryUsed: 0 })
}

/** A long rest: full HP, every use, slot and legendary resistance back; temp HP gone. */
export function longRest(npc: NpcSheet): NpcSheet {
  return withState(npc, {
    currentHp: maxHp(npc), tempHp: 0, uses: restUses(npc, ['short', 'long']), legendaryUsed: 0, legendaryResistanceUsed: 0,
    slotsUsed: Array<number>(9).fill(0), spellUses: {},
  })
}

/** A new max HP (rolled, average or typed) keeps the damage taken so far. */
export function setMaxHp(npc: NpcSheet, max: number): NpcSheet {
  const next = Math.max(1, int(max, 1))
  const damage = maxHp(npc) - npc.state.currentHp
  return { ...npc, block: { ...npc.block, hitPoints: next }, state: { ...npc.state, currentHp: clamp(next - damage, 0, next) } }
}

/** Puts the book's block back, keeping the NPC's own name, max HP choice and play state where it still fits. */
export function resetToBook(npc: NpcSheet, book: Block): NpcSheet {
  return normalize({ ...npc, block: { ...book, hitPoints: npc.block.hitPoints } })
}

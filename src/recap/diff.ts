// Turns two snapshots of a character into session events. Pure: no storage, no React.
// The sheet saves one action at a time, so each diff usually holds a single action.
import type { Character } from '../model/character'
import { getMaxHp, getResources, itemById, totalLevel } from '../rules'
import { vitals } from '../sheet/engine'
import type { SessionEventBody, Tracked } from './types'

export function track(c: Character): Tracked {
  const { name, xp, classes, inventory, coins, state } = c
  return structuredClone({ name, xp, classes, inventory, coins, state })
}

export function sameTracked(a: Tracked, b: Tracked): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0)
const hitDiceSpent = (t: Tracked) => sum(Object.values(t.state.hitDiceSpent).map(n => n ?? 0))

/**
 * Events between `before` (a saved snapshot) and the character as it is now.
 * Rests are inferred, since the sheet saves only the result: reaching full HP while hit dice,
 * spell slots or resources come back is a long rest, and short-rest resources all coming back
 * with nothing else changing is a short rest. A rest that changes nothing is not seen.
 */
export function diffCharacter(before: Tracked, now: Character): SessionEventBody[] {
  const prev: Character = { ...now, ...before }
  const a = prev.state
  const b = now.state
  const out: SessionEventBody[] = []
  const maxHp = getMaxHp(now)

  // ---- Rests ----
  const resetIds = Object.keys(a.resources).filter(id => (a.resources[id]?.used ?? 0) > 0 && (b.resources[id]?.used ?? 0) === 0)
  const resetCounters = (a.counters ?? []).filter(k => k.used > 0 && (b.counters ?? []).find(n => n.id === k.id)?.used === 0)
  const anyReset = resetIds.length > 0 || resetCounters.length > 0 || (a.pactSlotsUsed > 0 && b.pactSlotsUsed === 0)
  const slotsRefreshed = sum(a.spellSlotsUsed) > 0 && sum(b.spellSlotsUsed) === 0 && b.pactSlotsUsed === 0
  const hitDiceBack = hitDiceSpent(before) > hitDiceSpent(now)
  // Healing never refreshes resources, so full HP plus anything coming back is a long rest.
  const healedWithReset = a.currentHp < maxHp && anyReset
  const longRest = b.currentHp === maxHp && b.tempHp === 0 && (hitDiceBack || slotsRefreshed || healedWithReset)
  const shortRest = !longRest && anyReset && a.currentHp === b.currentHp && sum(a.spellSlotsUsed) === sum(b.spellSlotsUsed) &&
    getResources(now).filter(r => r.recharge === 'short').every(r => (b.resources[r.id]?.used ?? 0) === 0)

  if (longRest || shortRest) out.push({ kind: 'rest', rest: longRest ? 'long' : 'short' })

  // ---- Hit points ----
  if (!longRest) {
    const lost = Math.max(0, a.currentHp - b.currentHp) + Math.max(0, a.tempHp - b.tempHp)
    const gained = Math.max(0, b.currentHp - a.currentHp)
    const va = vitals(prev)
    const vb = vitals(now)
    if (va === 'dead' && vb !== 'dead') out.push({ kind: 'revived' })
    else if (gained > 0) {
      const spentDie = (Object.keys(b.hitDiceSpent) as (keyof typeof b.hitDiceSpent)[])
        .find(d => (b.hitDiceSpent[d] ?? 0) > (a.hitDiceSpent[d] ?? 0))
      out.push({ kind: 'heal', amount: gained, ...(spentDie ? { hitDie: spentDie } : {}), ...(b.currentHp === maxHp ? { toFull: true } : {}) })
    }
    if (lost > 0 && gained === 0) out.push({ kind: 'damage', amount: lost, hpAfter: b.currentHp, maxHp })
    if (b.tempHp > a.tempHp) out.push({ kind: 'tempHp', amount: b.tempHp })
    if (va !== vb) {
      if (vb === 'dead') out.push({ kind: 'death' })
      else if (vb === 'dying' && va === 'healthy') out.push({ kind: 'down' })
      else if (vb === 'stable') out.push({ kind: 'stable' })
    }
  }

  // ---- Slots and resources (a rest refreshes them, so it only adds the rest event) ----
  if (!longRest && !shortRest) {
    b.spellSlotsUsed.forEach((used, i) => {
      const delta = used - (a.spellSlotsUsed[i] ?? 0)
      if (delta !== 0) out.push({ kind: 'slot', level: i + 1, delta })
    })
    if (b.pactSlotsUsed !== a.pactSlotsUsed) out.push({ kind: 'slot', level: 0, delta: b.pactSlotsUsed - a.pactSlotsUsed, pact: true })
    const labels = new Map(getResources(now).map(r => [r.id, r.label]))
    for (const id of new Set([...Object.keys(a.resources), ...Object.keys(b.resources)])) {
      const delta = (b.resources[id]?.used ?? 0) - (a.resources[id]?.used ?? 0)
      if (delta !== 0) out.push({ kind: 'resource', label: labels.get(id) ?? id, delta })
    }
    for (const k of b.counters ?? []) {
      const delta = k.used - ((a.counters ?? []).find(o => o.id === k.id)?.used ?? 0)
      if (delta !== 0) out.push({ kind: 'resource', label: k.label, delta })
    }
  }

  // ---- Conditions ----
  for (const id of b.conditions) if (!a.conditions.includes(id)) out.push({ kind: 'condition', condition: id, added: true })
  for (const id of a.conditions) if (!b.conditions.includes(id)) out.push({ kind: 'condition', condition: id, added: false })

  // ---- Loot ----
  const qty = (t: Pick<Tracked, 'inventory'>) => {
    const m = new Map<string, number>()
    for (const e of t.inventory) m.set(e.itemId, (m.get(e.itemId) ?? 0) + e.qty)
    return m
  }
  const qa = qty(before)
  const qb = qty(now)
  for (const id of new Set([...qa.keys(), ...qb.keys()])) {
    const delta = (qb.get(id) ?? 0) - (qa.get(id) ?? 0)
    if (delta !== 0) out.push({ kind: 'item', itemId: id, name: itemById(id)?.name ?? id, delta })
  }
  const coins = { cp: now.coins.cp - before.coins.cp, sp: now.coins.sp - before.coins.sp, gp: now.coins.gp - before.coins.gp }
  if (coins.cp || coins.sp || coins.gp) out.push({ kind: 'coins', delta: coins })

  // ---- Progress ----
  if (now.xp !== before.xp) out.push({ kind: 'xp', amount: now.xp - before.xp })
  const la = totalLevel(prev)
  const lb = totalLevel(now)
  if (lb > la) out.push({ kind: 'levelUp', from: la, to: lb })

  return out
}

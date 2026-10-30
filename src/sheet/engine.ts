// Every play-state change on the live sheet. Pure: each function takes a
// Character and returns a new one, so the UI can undo by keeping the old value.
// Rules follow the SRD 5.1 sections on Hit Points, Death Saving Throws and Resting.
import type { Character, CharacterState, HitDie } from '../model/character'
import type { RestType } from '../rules/types'
import type { ConditionId } from '../rules/types'
import { dropSpentTempHp, effectsAfterRest, endEffect, loseConcentration } from './effects'
import { abilityMod, getAbilityScores, getHitDice, getMaxHp, getResources, getSpellSlots, migrateSubclassIds } from '../rules'


export type Counter = NonNullable<CharacterState['counters']>[number]

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const DIE_ORDER: HitDie[] = ['d12', 'd10', 'd8', 'd6']
const NO_SAVES = { successes: 0, failures: 0 }

function withState(c: Character, patch: Partial<CharacterState>): Character {
  return { ...c, state: { ...c.state, ...patch } }
}

export const effectiveMaxHp = getMaxHp

export type Vitals = 'healthy' | 'dying' | 'stable' | 'dead'

export function vitals(c: Character): Vitals {
  const { currentHp, deathSaves } = c.state
  if (deathSaves.failures >= 3) return 'dead'
  if (currentHp > 0) return 'healthy'
  // The SRD resets both counts on becoming stable; we keep three successes
  // instead, so stable stays derivable without an extra stored flag.
  return deathSaves.successes >= 3 ? 'stable' : 'dying'
}

/** Fills missing fields and clamps used counts to the current maxima (e.g. after a level change). */
export function normalize(saved: Character): Character {
  const c = migrateSubclassIds(saved)
  // Fields of removed features (exhaustion, inspiration, attunement, in-game clock) are dropped from old saves.
  const { exhaustion: _e, inspiration: _i, attuned: _a, clock: _c, ...s } = c.state as CharacterState & Record<'exhaustion' | 'inspiration' | 'attuned' | 'clock', unknown>
  const { slots, pact } = getSpellSlots(c)
  const resources: CharacterState['resources'] = {}
  for (const r of getResources(c)) resources[r.id] = { used: clamp(s.resources?.[r.id]?.used ?? 0, 0, r.max) }
  const hitDiceSpent: CharacterState['hitDiceSpent'] = {}
  for (const { die, total } of getHitDice(c)) hitDiceSpent[die] = clamp(s.hitDiceSpent?.[die] ?? 0, 0, total)
  return withState({ ...c, state: s }, {
    currentHp: clamp(s.currentHp ?? effectiveMaxHp(c), 0, effectiveMaxHp(c)),
    tempHp: Math.max(0, s.tempHp ?? 0),
    deathSaves: s.deathSaves ?? NO_SAVES,
    spellSlotsUsed: slots.map((max, i) => clamp(s.spellSlotsUsed?.[i] ?? 0, 0, max)),
    pactSlotsUsed: clamp(s.pactSlotsUsed ?? 0, 0, pact?.count ?? 0),
    resources,
    hitDiceSpent,
    conditions: s.conditions ?? [],
    counters: s.counters ?? [],
  })
}

// ---- Hit points ----

export function takeDamage(c: Character, amount: number, opts: { critical?: boolean } = {}): Character {
  // Armor of Agathys and the like end with the temporary hit points they gave.
  const hurt = dropSpentTempHp(damaged(c, amount, opts))
  // Dropping to 0 HP knocks the character out, which ends concentration and Rage.
  return hurt.state.currentHp === 0 ? endEffect(loseConcentration(hurt), 'feature:rage') : hurt
}

/** What a hit can change, saved so a reaction (Uncanny Dodge, Relentless Endurance) can take it again differently. */
export type HpSnapshot = Pick<CharacterState, 'currentHp' | 'tempHp' | 'deathSaves' | 'effects'>

export const hpSnapshot = (c: Character): HpSnapshot =>
  ({ currentHp: c.state.currentHp, tempHp: c.state.tempHp, deathSaves: c.state.deathSaves, effects: c.state.effects })

/** The same hit taken again from before it landed, for `amount` instead (halved, reduced, or just enough to leave 1 HP). */
export function retakeDamage(c: Character, before: HpSnapshot, amount: number, opts: { critical?: boolean } = {}): Character {
  return takeDamage(withState(c, before), amount, opts)
}

/** Relentless Endurance: the most a hit can take while leaving 1 HP. */
export const damageToOne = (before: HpSnapshot) => Math.max(0, before.currentHp + before.tempHp - 1)

function damaged(c: Character, amount: number, opts: { critical?: boolean }): Character {
  if (amount <= 0 || vitals(c) === 'dead') return c
  const { currentHp, tempHp, deathSaves } = c.state
  const absorbed = Math.min(tempHp, amount)
  const rest = amount - absorbed

  if (currentHp === 0) {
    if (rest === 0) return withState(c, { tempHp: tempHp - absorbed })
    // Damage at 0 HP: instant death if it reaches max HP, otherwise one failure (two on a crit).
    const failures = rest >= effectiveMaxHp(c) ? 3 : deathSaves.failures + (opts.critical ? 2 : 1)
    const successes = vitals(c) === 'stable' ? 0 : deathSaves.successes
    return withState(c, { tempHp: tempHp - absorbed, deathSaves: { successes, failures: Math.min(3, failures) } })
  }

  const overflow = rest - currentHp
  if (overflow >= 0) {
    // Massive damage: the leftover after dropping to 0 equals or beats max HP.
    const failures = overflow >= effectiveMaxHp(c) ? 3 : 0
    return withState(c, { currentHp: 0, tempHp: tempHp - absorbed, deathSaves: { successes: 0, failures } })
  }
  return withState(c, { currentHp: currentHp - rest, tempHp: tempHp - absorbed })
}

export function heal(c: Character, amount: number): Character {
  if (amount <= 0 || vitals(c) === 'dead' || c.state.currentHp >= effectiveMaxHp(c)) return c
  return withState(c, {
    currentHp: Math.min(effectiveMaxHp(c), c.state.currentHp + amount),
    deathSaves: NO_SAVES,
  })
}

/** Temporary HP never stack: keep whichever is higher, unless replacing explicitly. */
export function grantTempHp(c: Character, amount: number, opts: { replace?: boolean } = {}): Character {
  const tempHp = Math.max(0, opts.replace ? amount : Math.max(c.state.tempHp, amount))
  return withState(c, { tempHp })
}

/** Brings a dead character back at 1 HP, e.g. Revivify. */
export function revive(c: Character, hp = 1): Character {
  return withState(c, { currentHp: clamp(hp, 1, effectiveMaxHp(c)), deathSaves: NO_SAVES })
}

// ---- Conditions ----

/** Adds or removes one condition (poisoned, prone...); rolls pick it up through rules/rollMode. */
export function setCondition(c: Character, id: ConditionId, on: boolean): Character {
  const has = c.state.conditions.includes(id)
  if (has === on) return c
  const next = withState(c, { conditions: on ? [...c.state.conditions, id] : c.state.conditions.filter(x => x !== id) })
  // Being incapacitated (stunned, paralyzed...) breaks concentration.
  return on && INCAPACITATING.includes(id) ? loseConcentration(next) : next
}

export const INCAPACITATING: ConditionId[] = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']

// ---- Death saving throws ----

export type DeathSaveOutcome = 'success' | 'failure' | 'critical-success' | 'critical-failure'

export function deathSaveOutcome(d20: number): DeathSaveOutcome {
  if (d20 === 20) return 'critical-success'
  if (d20 === 1) return 'critical-failure'
  return d20 >= 10 ? 'success' : 'failure'
}

export function rollDeathSave(c: Character, d20: number): Character {
  if (vitals(c) !== 'dying') return c
  const { successes, failures } = c.state.deathSaves
  switch (deathSaveOutcome(d20)) {
    case 'critical-success': return withState(c, { currentHp: 1, deathSaves: NO_SAVES })
    case 'critical-failure': return withState(c, { deathSaves: { successes, failures: Math.min(3, failures + 2) } })
    case 'success': return withState(c, { deathSaves: { successes: successes + 1, failures } })
    case 'failure': return withState(c, { deathSaves: { successes, failures: failures + 1 } })
  }
}

/** Manual pip toggling for tables that roll physical dice. */
export function setDeathSaves(c: Character, successes: number, failures: number): Character {
  return withState(c, { deathSaves: { successes: clamp(successes, 0, 3), failures: clamp(failures, 0, 3) } })
}

/** Spare the Dying, a Medicine check or a healer's kit. */
export function stabilize(c: Character): Character {
  if (vitals(c) !== 'dying') return c
  return withState(c, { deathSaves: { successes: 3, failures: 0 } })
}

// ---- Spell slots and resources ----

export function setSlotUsed(c: Character, slotLevel: number, used: number): Character {
  const max = getSpellSlots(c).slots[slotLevel - 1] ?? 0
  const spellSlotsUsed = [...c.state.spellSlotsUsed]
  spellSlotsUsed[slotLevel - 1] = clamp(used, 0, max)
  return withState(c, { spellSlotsUsed })
}

export function setPactUsed(c: Character, used: number): Character {
  return withState(c, { pactSlotsUsed: clamp(used, 0, getSpellSlots(c).pact?.count ?? 0) })
}

export function setResourceUsed(c: Character, id: string, used: number): Character {
  const def = getResources(c).find(r => r.id === id)
  if (!def) return c
  return withState(c, { resources: { ...c.state.resources, [id]: { used: clamp(used, 0, def.max) } } })
}

export function upsertCounter(c: Character, counter: Counter): Character {
  const counters = c.state.counters ?? []
  const fixed = { ...counter, max: Math.max(0, counter.max), used: clamp(counter.used, 0, Math.max(0, counter.max)) }
  const exists = counters.some(k => k.id === counter.id)
  return withState(c, { counters: exists ? counters.map(k => (k.id === counter.id ? fixed : k)) : [...counters, fixed] })
}

export function removeCounter(c: Character, id: string): Character {
  return withState(c, { counters: (c.state.counters ?? []).filter(k => k.id !== id) })
}

// ---- Rests ----

export function hitDiceRemaining(c: Character): { die: HitDie; total: number; remaining: number }[] {
  return getHitDice(c).map(({ die, total }) => ({ die, total, remaining: total - (c.state.hitDiceSpent[die] ?? 0) }))
}

/** Short rest: spend one hit die, healing the roll plus CON modifier (never below 0). */
export function spendHitDie(c: Character, die: HitDie, roll: number): Character {
  const entry = hitDiceRemaining(c).find(h => h.die === die)
  if (!entry || entry.remaining <= 0 || vitals(c) !== 'healthy') return c
  const gained = Math.max(0, roll + abilityMod(getAbilityScores(c).con))
  const spent = withState(c, { hitDiceSpent: { ...c.state.hitDiceSpent, [die]: (c.state.hitDiceSpent[die] ?? 0) + 1 } })
  return withState(spent, { currentHp: Math.min(effectiveMaxHp(c), c.state.currentHp + gained) })
}

/** Average healing from one hit die: the roll plus CON, never below 0. */
export function hitDieAverage(die: HitDie, con: number): number {
  const sides = Number(die.slice(1))
  let total = 0
  for (let r = 1; r <= sides; r++) total += Math.max(0, r + con)
  return total / sides
}

/** Short rest preview: how many hit dice (biggest first) should heal the missing HP, and about how much they heal. */
export function hitDicePreview(c: Character): { missing: number; dice: number; heal: number; enough: boolean } {
  const missing = Math.max(0, effectiveMaxHp(c) - c.state.currentHp)
  const con = abilityMod(getAbilityScores(c).con)
  const sides = (d: HitDie) => Number(d.slice(1))
  let dice = 0
  let heal = 0
  for (const h of [...hitDiceRemaining(c)].sort((a, b) => sides(b.die) - sides(a.die))) {
    for (let i = 0; i < h.remaining && heal < missing; i++) {
      dice++
      heal += hitDieAverage(h.die, con)
    }
  }
  return { missing, dice, heal: Math.round(Math.min(heal, missing)), enough: heal >= missing }
}

function refreshes(recharge: RestType | 'dawn' | 'none', rest: RestType) {
  return recharge === 'short' || (recharge === 'long' && rest === 'long')
}

function resetRecharging(c: Character, rest: RestType): CharacterState {
  const resources = { ...c.state.resources }
  for (const r of getResources(c)) if (refreshes(r.recharge, rest)) resources[r.id] = { used: 0 }
  const counters = (c.state.counters ?? []).map(k => (refreshes(k.recharge, rest) ? { ...k, used: 0 } : k))
  // Spells and features that don't outlast the rest end with it.
  const effects = c.state.effects ? { effects: effectsAfterRest(c, rest) } : {}
  return { ...c.state, resources, counters, pactSlotsUsed: 0, ...effects }
}

/** Trackers that come back at dawn and still have charges spent. */
export function dawnCounters(c: Character): Counter[] {
  return (c.state.counters ?? []).filter(k => k.recharge === 'dawn')
}

/**
 * Dawn: magic item trackers regain charges. `rolled` holds what each tracker's
 * regain dice came up (by id); trackers without regain dice refill completely.
 */
export function dawn(c: Character, rolled: Record<string, number> = {}): Character {
  const counters = (c.state.counters ?? []).map(k => {
    if (k.recharge !== 'dawn') return k
    const back = k.regain?.trim() ? Math.max(0, rolled[k.id] ?? 0) : k.used
    return { ...k, used: Math.max(0, k.used - back) }
  })
  // Charges of equipped items (an item effect) work the same way, keyed by resource id.
  const resources = { ...c.state.resources }
  for (const r of getResources(c)) {
    if (r.recharge !== 'dawn') continue
    const used = resources[r.id]?.used ?? 0
    const back = r.regain ? Math.max(0, rolled[r.id] ?? 0) : used
    resources[r.id] = { used: Math.max(0, used - back) }
  }
  return withState(c, { counters, resources })
}

/** Ends a short rest: short-rest resources and warlock pact slots come back. Hit dice are spent separately. */
export function shortRest(c: Character): Character {
  if (vitals(c) === 'dead') return c
  return { ...c, state: resetRecharging(c, 'short') }
}

export function canLongRest(c: Character): boolean {
  return vitals(c) === 'healthy'
}

/**
 * Ends a long rest: full HP, every slot and resource back, temp HP gone,
 * and half the total hit dice regained (minimum one, largest dice first). Needs at least 1 HP at the start.
 */
export function longRest(c: Character): Character {
  if (!canLongRest(c)) return c
  const state = resetRecharging(c, 'long')
  const totalDice = getHitDice(c).reduce((n, h) => n + h.total, 0)
  let toRegain = Math.max(1, Math.floor(totalDice / 2))
  const hitDiceSpent = { ...state.hitDiceSpent }
  for (const die of DIE_ORDER) {
    const back = Math.min(hitDiceSpent[die] ?? 0, toRegain)
    if (back > 0) hitDiceSpent[die] = (hitDiceSpent[die] ?? 0) - back
    toRegain -= back
  }
  const rested: Character = { ...c, state: { ...state, hitDiceSpent, tempHp: 0, deathSaves: NO_SAVES, spellSlotsUsed: state.spellSlotsUsed.map(() => 0) } }
  return withState(rested, { currentHp: effectiveMaxHp(rested) })
}

/** The free-text notes on the character (backstory, personality, reminders). */
export function setNotes(c: Character, notes: string): Character {
  return c.notes === notes ? c : { ...c, notes }
}

// Every encounter change. Pure: each function takes an Encounter and returns a new one, with no
// dice or storage, so the UI can undo by keeping the old value. Rolls are made by the caller
// through src/dice and passed in as totals.
// Rules follow SRD 5.1: Initiative, Concentration, Durations (1 round = 6 seconds).
import type { Character } from '../model/character'
import type { ConditionId } from '../rules/types'
import { CONDITIONS, ENCOUNTER_SCHEMA_VERSION, type Combatant, type Effect, type Encounter } from './types'

const MAX_LOG = 60

/** What the engine needs to know about anyone's health: HP and every condition they have. */
export interface Status {
  hp: number
  conditions: ConditionId[]
}

/** Party members by Character id, as loaded by the tracker. */
export type Party = Record<string, Character | undefined>

/** Conditions that leave a creature incapacitated, which ends its concentration (SRD). */
const INCAPACITATING: ConditionId[] = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']

function log(enc: Encounter, ...lines: string[]): Encounter {
  return lines.length ? { ...enc, log: [...lines.reverse(), ...enc.log].slice(0, MAX_LOG) } : enc
}

/** Adds a line to the encounter log, e.g. damage dealt to a party member through the sheet engine. */
export const addLog = (enc: Encounter, line: string): Encounter => log(enc, line)

const byId = (enc: Encounter, id: string | null | undefined) => enc.combatants.find(c => c.id === id)
const nameOf = (enc: Encounter, id: string | undefined) => byId(enc, id)?.name ?? 'Someone'

export function createEncounter(id: string, ownerId: string, name: string, now = new Date().toISOString()): Encounter {
  return {
    id, ownerId, schemaVersion: ENCOUNTER_SCHEMA_VERSION, name, round: 0, activeId: null,
    combatants: [], effects: [], pendingChecks: [], log: [], createdAt: now, updatedAt: now,
  }
}

export const inCombat = (enc: Encounter) => enc.round > 0

/** Elapsed game time, e.g. round 11 → "1 min 0 s". */
export function elapsed(round: number): string {
  const s = Math.max(0, round - 1) * 6
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}

// ---- Order ----

/** Highest initiative first; ties go to the higher modifier, then keep their current order. Unrolled last. */
export function sortOrder(list: Combatant[]): Combatant[] {
  const score = (c: Combatant) => c.initiative ?? -Infinity
  return [...list].sort((a, b) => score(b) - score(a) || b.initBonus - a.initBonus)
}

export function addCombatant(enc: Encounter, input: Omit<Combatant, 'conditions'> & { conditions?: ConditionId[] }): Encounter {
  const c: Combatant = { ...input, conditions: input.conditions ?? [] }
  const next = { ...enc, combatants: sortOrder([...enc.combatants, c]) }
  return inCombat(enc) ? log(next, `${c.name} joins the fight`) : next
}

/** Removes a combatant and every effect they were the source of. */
export function removeCombatant(enc: Encounter, id: string): Encounter {
  const gone = byId(enc, id)
  if (!gone) return enc
  let next = enc
  if (enc.activeId === id && enc.combatants.length > 1) next = nextTurn(next)
  const effects = next.effects
    .filter(e => e.sourceId !== id)
    .map(e => ({ ...e, targetIds: e.targetIds.filter(t => t !== id) }))
    .filter(e => e.targetIds.length > 0 || e.sourceId)
  next = {
    ...next,
    combatants: next.combatants.filter(c => c.id !== id),
    effects,
    pendingChecks: next.pendingChecks.filter(p => p.combatantId !== id),
    activeId: next.activeId === id ? null : next.activeId,
  }
  return log(next, `${gone.name} leaves the fight`)
}

export function setInitiative(enc: Encounter, id: string, initiative: number | null): Encounter {
  return { ...enc, combatants: sortOrder(enc.combatants.map(c => (c.id === id ? { ...c, initiative } : c))) }
}

export function updateCombatant(enc: Encounter, id: string, patch: Partial<Omit<Combatant, 'id' | 'kind'>>): Encounter {
  return { ...enc, combatants: sortOrder(enc.combatants.map(c => (c.id === id ? { ...c, ...patch } : c))) }
}

/** Swaps a combatant with its neighbour, for ties the table settles by hand. */
export function moveCombatant(enc: Encounter, id: string, dir: -1 | 1): Encounter {
  const list = [...enc.combatants]
  const i = list.findIndex(c => c.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return enc
  ;[list[i], list[j]] = [list[j], list[i]]
  return { ...enc, combatants: list }
}

// ---- Status ----

/** Conditions an active effect puts on this combatant. */
export function effectConditions(enc: Encounter, id: string): ConditionId[] {
  const out = new Set<ConditionId>()
  for (const e of enc.effects) if (e.condition && e.targetIds.includes(id)) out.add(e.condition)
  return CONDITIONS.filter(c => out.has(c))
}

/** HP and conditions: from the linked Character for a pc, from the row (plus effects) for an npc. */
export function statusOf(enc: Encounter, c: Combatant, party: Party): Status {
  if (c.kind === 'pc') {
    const ch = c.characterId ? party[c.characterId] : undefined
    return { hp: ch?.state.currentHp ?? 1, conditions: ch?.state.conditions ?? [] }
  }
  const conditions = new Set([...c.conditions, ...effectConditions(enc, c.id)])
  return { hp: c.hp?.current ?? 1, conditions: CONDITIONS.filter(x => conditions.has(x)) }
}

/** A monster at 0 HP is out and skipped in the turn order. Party members at 0 keep their turn for death saves. */
export const isDefeated = (c: Combatant) => c.kind === 'npc' && (c.hp?.current ?? 1) <= 0

// ---- Turns and timers ----

function tick(enc: Encounter, matches: (e: Effect) => boolean, phase: 'start' | 'end' | 'round'): Encounter {
  const expired: string[] = []
  const effects: Effect[] = []
  for (const e of enc.effects) {
    if (!matches(e) || e.remaining === null) effects.push(e)
    else if (phase === 'end' && !e.armed) effects.push({ ...e, armed: true })
    else if (e.remaining <= 1) expired.push(`${e.name} ends`)
    else effects.push({ ...e, remaining: e.remaining - 1 })
  }
  return log({ ...enc, effects }, ...expired)
}

const sourceTick = (enc: Encounter, id: string, at: 'start' | 'end') =>
  tick(enc, e => e.sourceId === id && e.tick === at, at)

/** Starts round 1 with the top of the order. Everyone needs an initiative first. */
export function startCombat(enc: Encounter): Encounter {
  const first = enc.combatants.find(c => !isDefeated(c))
  if (!first || enc.combatants.some(c => c.initiative === null)) return enc
  const started = log({ ...enc, round: 1, activeId: first.id, combatants: sortOrder(enc.combatants) }, 'Round 1', `${first.name}'s turn`)
  return sourceTick(started, first.id, 'start')
}

/**
 * Ends the active turn and starts the next one, skipping defeated monsters.
 * Effects tick on their source's turn ("end" effects now, "start" effects for the next combatant);
 * effects with no source tick when a new round begins.
 */
export function nextTurn(enc: Encounter): Encounter {
  if (!inCombat(enc) || !enc.activeId) return enc
  const order = enc.combatants
  let next = sourceTick(enc, enc.activeId, 'end')
  const from = order.findIndex(c => c.id === enc.activeId)
  for (let step = 1; step <= order.length; step++) {
    const i = (from + step) % order.length
    if (from + step === order.length) {
      // Wrapped past the bottom of the order: a new round.
      next = tick(log({ ...next, round: next.round + 1 }, `Round ${next.round + 1}`), e => !e.sourceId, 'round')
    }
    const c = order[i]
    if (isDefeated(c)) continue
    next = log({ ...next, activeId: c.id }, `${c.name}'s turn`)
    return sourceTick(next, c.id, 'start')
  }
  return next
}

/** Ends combat: the round counter resets and every effect ends, which lifts its conditions. */
export function endCombat(enc: Encounter): Encounter {
  return log({ ...enc, round: 0, activeId: null, effects: [], pendingChecks: [] }, 'Combat ends')
}

// ---- Effects ----

export type EffectInput = Omit<Effect, 'armed'>

/** Adds an effect. A new concentration effect ends the source's previous one. */
export function addEffect(enc: Encounter, input: EffectInput): Encounter {
  let next = enc
  const held = input.concentration && input.sourceId ? concentrationOf(enc, input.sourceId) : undefined
  if (held) next = endEffect(next, held.id, `${nameOf(enc, input.sourceId)} drops ${held.name}`)
  const armed = !(input.tick === 'end' && input.sourceId === enc.activeId && inCombat(enc))
  const effect: Effect = { ...input, armed, remaining: input.remaining === null ? null : Math.max(1, Math.floor(input.remaining)) }
  const targets = effect.targetIds.map(t => nameOf(enc, t)).join(', ')
  return log({ ...next, effects: [...next.effects, effect] }, `${effect.name}${targets ? ` on ${targets}` : ''}`)
}

export function endEffect(enc: Encounter, effectId: string, reason?: string): Encounter {
  const e = enc.effects.find(x => x.id === effectId)
  if (!e) return enc
  return log({ ...enc, effects: enc.effects.filter(x => x.id !== effectId) }, reason ?? `${e.name} ends`)
}

export const concentrationOf = (enc: Encounter, id: string): Effect | undefined =>
  enc.effects.find(e => e.concentration && e.sourceId === id)

// ---- Damage and concentration ----

/** Constitution save DC to keep concentrating after taking damage: 10 or half the damage, whichever is higher. */
export const concentrationDc = (damage: number) => Math.max(10, Math.floor(damage / 2))

/** Queues a concentration save when a concentrating combatant takes damage. Call it for every damage source. */
export function noteDamage(enc: Encounter, id: string, amount: number, checkId: string): Encounter {
  if (amount <= 0 || !concentrationOf(enc, id)) return enc
  return { ...enc, pendingChecks: [...enc.pendingChecks, { id: checkId, combatantId: id, dc: concentrationDc(amount) }] }
}

/** Damage to a monster or NPC: temp HP first, never below 0. Party damage goes through the sheet engine. */
export function damageNpc(enc: Encounter, id: string, amount: number, checkId: string): Encounter {
  const c = byId(enc, id)
  if (!c?.hp || amount <= 0) return enc
  const absorbed = Math.min(c.hp.temp, amount)
  const current = Math.max(0, c.hp.current - (amount - absorbed))
  let next = updateCombatant(enc, id, { hp: { ...c.hp, temp: c.hp.temp - absorbed, current } })
  next = log(next, `${c.name} takes ${amount}${current === 0 ? ' and drops' : ''}`)
  return noteDamage(next, id, amount, checkId)
}

export function healNpc(enc: Encounter, id: string, amount: number): Encounter {
  const c = byId(enc, id)
  if (!c?.hp || amount <= 0) return enc
  return log(updateCombatant(enc, id, { hp: { ...c.hp, current: Math.min(c.hp.max, c.hp.current + amount) } }), `${c.name} heals ${amount}`)
}

/** Applies a rolled concentration save. A failure (or an automatic one) ends the effect. */
export function resolveCheck(enc: Encounter, checkId: string, total: number, autoFail = false): Encounter {
  const check = enc.pendingChecks.find(p => p.id === checkId)
  if (!check) return enc
  const next = { ...enc, pendingChecks: enc.pendingChecks.filter(p => p.id !== checkId) }
  const held = concentrationOf(next, check.combatantId)
  const who = nameOf(enc, check.combatantId)
  if (!held) return next
  if (!autoFail && total >= check.dc) return log(next, `${who} keeps ${held.name} (${total} vs DC ${check.dc})`)
  return endEffect(next, held.id, `${who} loses ${held.name} (${autoFail ? 'auto-fail' : total} vs DC ${check.dc})`)
}

export const dismissCheck = (enc: Encounter, checkId: string): Encounter =>
  ({ ...enc, pendingChecks: enc.pendingChecks.filter(p => p.id !== checkId) })

/** Ends concentration for anyone who is now incapacitated or at 0 HP (SRD). */
export function breakConcentration(enc: Encounter, party: Party): Encounter {
  let next = enc
  for (const c of enc.combatants) {
    const held = concentrationOf(next, c.id)
    if (!held) continue
    const s = statusOf(next, c, party)
    if (s.hp <= 0 || s.conditions.some(x => INCAPACITATING.includes(x))) {
      next = endEffect(next, held.id, `${c.name} loses ${held.name} (${s.hp <= 0 ? '0 HP' : 'incapacitated'})`)
      next = { ...next, pendingChecks: next.pendingChecks.filter(p => p.combatantId !== c.id) }
    }
  }
  return next
}

// ---- Party conditions ----

/**
 * Party members whose conditions change between two versions of the encounter: an effect that
 * started adds its condition to the Character, one that ended removes it. Returns only changed characters.
 */
export function syncPartyConditions(before: Encounter, after: Encounter, party: Party): Character[] {
  const out: Character[] = []
  const pcs = new Map<string, string>()
  for (const c of [...before.combatants, ...after.combatants]) if (c.kind === 'pc' && c.characterId) pcs.set(c.id, c.characterId)
  for (const [combatantId, characterId] of pcs) {
    const ch = party[characterId]
    if (!ch) continue
    const was = new Set(effectConditions(before, combatantId))
    const now = new Set(effectConditions(after, combatantId))
    const conditions = new Set(ch.state.conditions)
    let changed = false
    for (const x of was) if (!now.has(x) && conditions.delete(x)) changed = true
    for (const x of now) if (!was.has(x) && !conditions.has(x)) { conditions.add(x); changed = true }
    if (changed) out.push({ ...ch, state: { ...ch.state, conditions: CONDITIONS.filter(x => conditions.has(x)) } })
  }
  return out
}

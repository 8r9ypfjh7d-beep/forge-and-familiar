// Damage the character takes: what their resistances and immunities make of it, the concentration
// save it calls for, and what hitting them costs the attacker (Armor of Agathys). SRD 5.1 "Damage
// Resistance and Vulnerability" and "Concentration".
import type { Character } from '../model/character'
import type { DerivedStats } from './derive'

export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]

export type DamageDefense = 'immune' | 'resistant'

/** Defense lines are free text ("fire", "bludgeoning, piercing and slashing"); a whole-word match counts. */
const covers = (line: string, type: string) => line === type || line.split(/[^a-z]+/).includes(type)

/** The defense that applies to one damage type: immunity beats resistance. Petrified resists everything. */
export function damageDefense(d: Pick<DerivedStats, 'defenses'>, type: string | undefined, c?: Pick<Character, 'state'>): DamageDefense | undefined {
  if (!type) return undefined
  if (d.defenses.immunities.some(l => covers(l, type))) return 'immune'
  if (d.defenses.resistances.some(l => covers(l, type)) || c?.state.conditions.includes('petrified')) return 'resistant'
  return undefined
}

/** Damage after defenses: immunity takes none, resistance halves (rounded down). */
export function damageAfterDefenses(amount: number, defense?: DamageDefense): number {
  if (defense === 'immune') return 0
  return defense === 'resistant' ? Math.floor(amount / 2) : amount
}

/** Concentration save DC after taking damage: 10 or half the damage, whichever is higher (30 at most in 2024). */
export function concentrationDc(damage: number, edition?: '2014' | '2024'): number {
  const dc = Math.max(10, Math.floor(damage / 2))
  return edition === '2024' ? Math.min(30, dc) : dc
}

/** Running effects that hurt whoever hits the character in melee (Armor of Agathys), with what they deal. */
export function meleeReprisals(c: Pick<Character, 'state'>): { id: string; name: string; damage: string; type?: string }[] {
  return (c.state.effects ?? []).flatMap(e => (e.on && e.reflect ? [{ id: e.id, name: e.name, damage: e.reflect.damage, ...(e.reflect.type ? { type: e.reflect.type } : {}) }] : []))
}

/** Reaction spells cast in answer to taking damage (Hellish Rebuke, Absorb Elements). */
export const DAMAGE_REACTION_SPELLS = ['hellish-rebuke', 'absorb-elements']

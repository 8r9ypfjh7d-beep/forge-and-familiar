import type { Character } from '../model/character'
import type { Ability } from './types'

/** The `when` of an advantage on attacks that counts for Strength melee attacks only (Reckless Attack). */
export const STRENGTH_MELEE = 'with Strength melee attacks'

export type RollKind = 'attack' | 'check' | 'save'
export type RollMode = 'normal' | 'advantage' | 'disadvantage'

/**
 * Advantage/disadvantage imposed by the character's own conditions (SRD rules).
 * Situational sources (cover, the target's conditions) are up to the caller.
 */
export function getRollMode(c: Pick<Character, 'state'>, kind: RollKind, ability?: Ability): RollMode {
  return rollModeCauses(c, kind, ability).mode
}

/** Where a forced advantage or disadvantage comes from: a condition id ("poisoned") or a running effect's name ("Foresight"). */
export type RollModeCause = { condition: string } | { effect: string }

/** getRollMode with its reasons, so the sheet can say "Disadvantage: Poisoned" instead of a bare "(dis)". */
export function rollModeCauses(c: Pick<Character, 'state'>, kind: RollKind, ability?: Ability): { mode: RollMode; adv: RollModeCause[]; dis: RollModeCause[] } {
  const { conditions } = c.state
  const adv: RollModeCause[] = []
  const dis: RollModeCause[] = []
  const conds = (ids: string[], into: RollModeCause[]) => { for (const id of ids) if (conditions.includes(id as never)) into.push({ condition: id }) }
  if (kind === 'check') conds(['poisoned', 'frightened'], dis)
  if (kind === 'attack') {
    conds(['poisoned', 'frightened', 'blinded', 'prone', 'restrained'], dis)
    conds(['invisible'], adv)
  }
  if (kind === 'save' && ability === 'dex') conds(['restrained'], dis)
  const running = (c.state.effects ?? []).filter(e => e.on)
  // Running spells that always give advantage on attacks (Foresight, Greater Invisibility).
  // Reckless Attack: melee attacks using Strength (attack rolls pass 'str' only for those).
  if (kind === 'attack') {
    for (const e of running) {
      if (e.stats?.some(f => f.kind === 'advantage' && f.on === 'attacks' && (!f.when || (ability === 'str' && f.when === STRENGTH_MELEE)))) adv.push({ effect: e.name })
    }
  }
  const mode: RollMode = !adv.length === !dis.length ? 'normal' : adv.length ? 'advantage' : 'disadvantage'
  return { mode, adv, dis }
}

/** Saves the character fails automatically (paralyzed, stunned, unconscious, petrified: STR and DEX). */
export function autoFailsSave(c: Pick<Character, 'state'>, ability: Ability): boolean {
  if (ability !== 'str' && ability !== 'dex') return false
  return ['paralyzed', 'stunned', 'unconscious', 'petrified'].some(id => c.state.conditions.includes(id as never))
}

/** Dice running spells add to this kind of d20 roll (Bless: 1d4 on attacks and saves), with where each came from. */
export function getRollDice(c: Pick<Character, 'state'>, kind: RollKind): { name: string; dice: string }[] {
  return (c.state.effects ?? []).flatMap(e => (e.on && e.rollDice?.[kind] ? [{ name: e.name, dice: e.rollDice[kind]! }] : []))
}

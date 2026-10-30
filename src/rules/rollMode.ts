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
  const { conditions } = c.state
  const has = (id: string) => conditions.includes(id as never)
  let adv = false
  let dis = false
  if (kind === 'check') {
    if (has('poisoned') || has('frightened')) dis = true
  }
  if (kind === 'attack') {
    if (['poisoned', 'frightened', 'blinded', 'prone', 'restrained'].some(has)) dis = true
    if (has('invisible')) adv = true
  }
  if (kind === 'save') {
    if (ability === 'dex' && has('restrained')) dis = true
  }
  // Running spells that always give advantage on attacks (Foresight, Greater Invisibility).
  if (kind === 'attack' && (c.state.effects ?? []).some(e => e.on && e.stats?.some(f => f.kind === 'advantage' && f.on === 'attacks' && !f.when))) adv = true
  // Reckless Attack: melee attacks using Strength (attack rolls pass 'str' only for those).
  if (kind === 'attack' && ability === 'str' && (c.state.effects ?? []).some(e => e.on && e.stats?.some(f => f.kind === 'advantage' && f.on === 'attacks' && f.when === STRENGTH_MELEE))) adv = true
  return adv === dis ? 'normal' : adv ? 'advantage' : 'disadvantage'
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

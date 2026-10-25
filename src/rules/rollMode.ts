import type { Character } from '../model/character'
import type { Ability } from './types'

export type RollKind = 'attack' | 'check' | 'save'
export type RollMode = 'normal' | 'advantage' | 'disadvantage'

/**
 * Advantage/disadvantage imposed by the character's own conditions and exhaustion (SRD rules).
 * Situational sources (cover, the target's conditions) are up to the caller.
 */
export function getRollMode(c: Pick<Character, 'state'>, kind: RollKind, ability?: Ability): RollMode {
  const { conditions, exhaustion } = c.state
  const has = (id: string) => conditions.includes(id as never)
  let adv = false
  let dis = false
  if (kind === 'check') {
    if (exhaustion >= 1 || has('poisoned') || has('frightened')) dis = true
  }
  if (kind === 'attack') {
    if (exhaustion >= 3 || ['poisoned', 'frightened', 'blinded', 'prone', 'restrained'].some(has)) dis = true
    if (has('invisible')) adv = true
  }
  if (kind === 'save') {
    if (exhaustion >= 3) dis = true
    if (ability === 'dex' && has('restrained')) dis = true
  }
  return adv === dis ? 'normal' : adv ? 'advantage' : 'disadvantage'
}

/** Saves the character fails automatically (paralyzed, stunned, unconscious, petrified: STR and DEX). */
export function autoFailsSave(c: Pick<Character, 'state'>, ability: Ability): boolean {
  if (ability !== 'str' && ability !== 'dex') return false
  return ['paralyzed', 'stunned', 'unconscious', 'petrified'].some(id => c.state.conditions.includes(id as never))
}

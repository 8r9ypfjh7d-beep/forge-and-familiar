// Running effects on the live sheet (CharacterState.effects): starting one when a spell is cast,
// switching it on or off, ending it, and the rules that end them for you: concentration, rests and
// temporary hit points running out. Pure, like engine.ts, so every change can be undone.
import type { Character, LiveEffect } from '../model/character'
import type { RestType } from '../rules/types'

const list = (c: Character) => c.state.effects ?? []
const withEffects = (c: Character, effects: LiveEffect[]): Character => ({ ...c, state: { ...c.state, effects } })

export const effectsOn = list

/** The effect the character is concentrating on, if any. */
export const concentration = (c: Character) => list(c).find(e => e.concentration)

/**
 * Starts (or restarts) an effect, switched on. A new concentration effect ends the old one,
 * since a caster can concentrate on one spell at a time. `ended` names what stopped.
 */
export function startEffect(c: Character, effect: Omit<LiveEffect, 'on'> & { on?: boolean }): { character: Character; ended: string[] } {
  const ended = effect.concentration ? list(c).filter(e => e.concentration && e.id !== effect.id).map(e => e.name) : []
  const kept = list(c).filter(e => e.id !== effect.id && !(effect.concentration && e.concentration))
  return { character: withEffects(c, [...kept, { ...effect, on: effect.on ?? true }]), ended }
}

/** A failed concentration save (or falling unconscious) ends the spell being concentrated on. */
export function loseConcentration(c: Character): Character {
  const e = concentration(c)
  return e ? endEffect(c, e.id) : c
}

export function endEffect(c: Character, id: string): Character {
  return list(c).some(e => e.id === id) ? withEffects(c, list(c).filter(e => e.id !== id)) : c
}

/** Off keeps the effect tracked (cast on an ally) without its numbers counting for this character. */
export function setEffectOn(c: Character, id: string, on: boolean): Character {
  return withEffects(c, list(c).map(e => (e.id === id ? { ...e, on } : e)))
}

/** After a hit with damage: effects that last for one hit (2014 smites) are spent. */
export function spendOnceEffects(c: Character): Character {
  return list(c).some(e => e.on && e.once && e.damage) ? withEffects(c, list(c).filter(e => !(e.on && e.once && e.damage))) : c
}

/** Effects that last while their temporary HP do (Armor of Agathys) end once the temp HP are gone. */
export function dropSpentTempHp(c: Character): Character {
  if (c.state.tempHp > 0 || !list(c).some(e => e.whileTempHp)) return c
  return withEffects(c, list(c).filter(e => !e.whileTempHp))
}

/** A short rest (an hour) outlasts effects of up to an hour; a long rest outlasts those of up to 8 hours. */
export function effectsAfterRest(c: Character, rest: RestType): LiveEffect[] {
  return list(c).filter(e => (rest === 'long' ? e.ends === 'never' : e.ends !== 'short'))
}

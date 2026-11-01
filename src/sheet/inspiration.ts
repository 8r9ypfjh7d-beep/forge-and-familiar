// Inspiration (2014) and Heroic Inspiration (2024) on the live sheet. Pure; no engine import, so engine.ts can use it.
// 2014 (PHB/SRD 5.1): one at a time; spend it for advantage on an attack roll, saving throw or ability check,
// or give it to another player character. 2024 (SRD 5.2): one at a time; spend it to reroll any one die right after
// rolling it and use the new roll. Gaining it while holding it lets you give it to an ally who lacks it.
// A 2024 Human (Resourceful) gains it after every long rest.
import type { Character, CharacterState } from '../model/character'
import { rulesEdition } from '../rules'

const withState = (c: Character, patch: Partial<CharacterState>): Character => ({ ...c, state: { ...c.state, ...patch } })

export const hasInspiration = (c: Character) => !!c.state.inspiration

/** Marks Inspiration gained. Already holding it: a 2024 character keeps the extra to pass on; a 2014 one gains nothing. */
export function gainInspiration(c: Character): Character {
  if (!c.state.inspiration) return withState(c, { inspiration: true })
  if (rulesEdition(c) === '2024' && !c.state.spareInspiration) return withState(c, { spareInspiration: true })
  return c
}

/** Spent (rolled with) or simply taken off. */
export function spendInspiration(c: Character): Character {
  return c.state.inspiration ? withState(c, { inspiration: false }) : c
}

/** Hands Inspiration to an ally: a 2024 spare goes first, otherwise the one held. */
export function passInspiration(c: Character): Character {
  if (c.state.spareInspiration) return withState(c, { spareInspiration: false })
  return spendInspiration(c)
}

/** Lets a 2024 spare go when no ally lacks it. */
export const dropSpareInspiration = (c: Character): Character =>
  (c.state.spareInspiration ? withState(c, { spareInspiration: false }) : c)

/** Who may hand Inspiration on: anyone holding it in 2014; in 2024 only a spare (the second one gained). */
export function canPassInspiration(c: Character): boolean {
  return rulesEdition(c) === '2024' ? !!c.state.spareInspiration : !!c.state.inspiration
}

/** 2024 Human (Resourceful): Heroic Inspiration after every long rest. */
export const gainsInspirationOnLongRest = (c: Character) => rulesEdition(c) === '2024' && c.raceId === 'human'

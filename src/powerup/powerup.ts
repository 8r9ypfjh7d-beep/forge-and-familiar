// Tamir's easter egg: at the table, every confrontation ends with his character taking all his clothes off.
// The sheet gives his characters a Strip button that plays a Super Saiyan power-up and switches on a real,
// silly buff (a custom action's effect), so it shows in the combat page's Effects and in "show the math".
import type { Character, CustomAction } from '../model/character'
import type { ItemEffect } from '../rules/types'

/** Only this account's characters get the button. */
export const POWER_UP_OWNER = 'acct-tamir'

/** The custom action that carries the buff, so a second strip reuses it instead of piling up copies. */
export const POWER_UP_ACTION_ID = 'act-super-saiyan'

/** More confidence, less armour: hits harder and moves faster, but has nothing to hide behind. */
export const POWER_UP_STATS: ItemEffect[] = [
  { kind: 'attack', value: 2 },
  { kind: 'damage', value: 2 },
  { kind: 'speed', value: 10 },
  { kind: 'initiative', value: 3 },
  { kind: 'ac', value: -2 },
]

/** Count of the joke lines `powerup.line1`.. in the locales. */
export const STRIP_LINES = 12

export const canPowerUp = (c: Pick<Character, 'ownerId'>): boolean => c.ownerId === POWER_UP_OWNER

const powerAction = (c: Pick<Character, 'customActions'>) => c.customActions?.find(a => a.id === POWER_UP_ACTION_ID)

export const isPoweredUp = (c: Pick<Character, 'customActions'>): boolean => !!powerAction(c)?.active

/** Clothes off: adds the buff action (or refreshes it) and switches it on. `name` and `description` are in the player's language. */
export function powerUp(c: Character, name: string, description: string): Character {
  const action: CustomAction = { id: POWER_UP_ACTION_ID, kind: 'free', name, description, stats: POWER_UP_STATS, active: true }
  const others = (c.customActions ?? []).filter(a => a.id !== POWER_UP_ACTION_ID)
  return { ...c, customActions: [...others, action] }
}

/** Clothes back on: the buff switches off but the action stays, ready for the next confrontation. */
export function getDressed(c: Character): Character {
  if (!powerAction(c)) return c
  return { ...c, customActions: (c.customActions ?? []).map(a => (a.id === POWER_UP_ACTION_ID ? { ...a, active: undefined } : a)) }
}

/** Power level shown in the animation: always over 9000, and it grows every time. */
export const powerLevel = (times: number): number => 9001 + Math.max(0, times - 1) * 1000

// How many times the clothes came off, per character on this device. A joke counter, not saved on Character.
const countKey = (id: string) => `ff.powerup.v1.${id}`

export function stripCount(characterId: string): number {
  try { return Math.max(0, Number(localStorage.getItem(countKey(characterId))) || 0) } catch { return 0 }
}

export function bumpStripCount(characterId: string): number {
  const next = stripCount(characterId) + 1
  try { localStorage.setItem(countKey(characterId), String(next)) } catch { /* private mode */ }
  return next
}

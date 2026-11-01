// The DM's rewards on the live sheet: charms with a few uses and lasting blessings. Pure, like engine.ts.
// Inspiration lives in inspiration.ts and is re-exported here.
import type { Boon, Character, CharacterState } from '../model/character'
import type { MessageKey } from '../i18n'
import { grantTempHp, heal } from './engine'

type TFn = (key: MessageKey, params?: Record<string, string | number>) => string

export * from './inspiration'

const withState = (c: Character, patch: Partial<CharacterState>): Character => ({ ...c, state: { ...c.state, ...patch } })

// ---------- Charms and blessings ----------

export const boonUses = (b: Boon) => Math.max(1, Math.floor(b.uses ?? 1))
export const boonLeft = (b: Boon) => (b.kind === 'charm' ? Math.max(0, boonUses(b) - (b.used ?? 0)) : Infinity)

/** Adds a reward; one with the same id (a gift already taken) is left alone. */
export function addBoon(c: Character, boon: Boon): Character {
  const list = c.state.boons ?? []
  if (list.some(b => b.id === boon.id)) return c
  return withState(c, { boons: [...list, { ...boon, used: 0 }] })
}

export function removeBoon(c: Character, id: string): Character {
  const list = c.state.boons ?? []
  return list.some(b => b.id === id) ? withState(c, { boons: list.filter(b => b.id !== id) }) : c
}

/**
 * Uses a charm once (gone when its last use is spent) and applies its heal or temporary hit points.
 * `rolled` is the total of its dice, rolled by the caller so it lands in the dice history.
 * A blessing has no uses; using one only applies its roll.
 */
export function spendBoon(c: Character, id: string, rolled = 0): Character {
  const b = c.state.boons?.find(x => x.id === id)
  if (!b || boonLeft(b) <= 0) return c
  let next = c
  if (b.kind === 'charm') {
    const used = (b.used ?? 0) + 1
    const boons = (c.state.boons ?? []).flatMap(x => (x.id !== id ? [x] : used >= boonUses(x) ? [] : [{ ...x, used }]))
    next = withState(c, { boons })
  }
  if (b.roll?.kind === 'heal' && rolled > 0) next = heal(next, rolled)
  if (b.roll?.kind === 'tempHp') next = grantTempHp(next, b.roll.value)
  return next
}

/** The dice a charm's Use rolls, if any: its bonus die, a fresh d20, or its healing. */
export function boonDice(b: Boon): string | undefined {
  switch (b.roll?.kind) {
    case 'bonusDie': return b.roll.dice
    case 'reroll': return '1d20'
    case 'heal': return b.roll.dice
    default: return undefined
  }
}

/** What a charm's Use does, in words. */
export function boonRollText(t: TFn, b: Pick<Boon, 'roll'>): string | null {
  switch (b.roll?.kind) {
    case 'bonusDie': return t('boons.roll.bonusDie', { dice: b.roll.dice })
    case 'reroll': return t('boons.roll.reroll')
    case 'heal': return t('boons.roll.heal', { dice: b.roll.dice })
    case 'tempHp': return t('boons.roll.tempHp', { n: b.roll.value })
    default: return null
  }
}

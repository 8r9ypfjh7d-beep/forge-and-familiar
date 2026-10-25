// Item effects: which equipped (and attuned) items change the character's numbers, and by how much.
// derive() and src/explain both read these, so the sheet and "show the math" agree.
import type { Character } from '../model/character'
import { entryItem } from './data/items'
import { ABILITIES, type Abilities, type Ability, type BonusEffectKind, type InventoryEntry, type ItemEffect } from './types'

type Owner = Partial<Pick<Character, 'inventory' | 'state'>>

/** How an inventory entry is stored in `state.attuned`; free-typed names sit next to these. */
export const attunementKey = (uid: string) => `@${uid}`

export const isAttuned = (c: Owner, uid: string) => (c.state?.attuned ?? []).includes(attunementKey(uid))

/** An entry's effects work while it is equipped, and attuned if it needs attunement. */
export const effectsActive = (c: Owner, e: InventoryEntry) => e.equipped && (!e.attunement || isAttuned(c, e.uid))

export interface ActiveEffect { source: string; effect: ItemEffect }

export function activeItemEffects(c: Owner): ActiveEffect[] {
  return (c.inventory ?? []).flatMap(e => {
    if (!e.effects?.length || !effectsActive(c, e)) return []
    const source = entryItem(e)?.name ?? e.name ?? e.itemId
    return e.effects.map(effect => ({ source, effect }))
  })
}

/** Each item's bonus of one kind; `unarmored` bonuses only count when `unarmored` is true. */
export function itemBonuses(c: Owner, kind: BonusEffectKind, unarmored = true): { source: string; value: number }[] {
  return activeItemEffects(c).flatMap(({ source, effect: f }) =>
    f.kind === kind && (!('unarmored' in f && f.unarmored) || unarmored) ? [{ source, value: f.value }] : [])
}

export const itemBonus = (c: Owner, kind: BonusEffectKind, unarmored = true) =>
  itemBonuses(c, kind, unarmored).reduce((n, b) => n + b.value, 0)

/**
 * Ability scores after items, with one line per item that changed a score.
 * Bonuses (up to their max) apply first, then "becomes N" items, which only help when higher.
 */
export function applyItemAbilities(c: Owner, scores: Abilities): { scores: Abilities; lines: Record<Ability, { source: string; value: number }[]> } {
  const out = { ...scores }
  const lines = Object.fromEntries(ABILITIES.map(a => [a, []])) as unknown as Record<Ability, { source: string; value: number }[]>
  const effects = activeItemEffects(c)
  for (const pass of ['ability', 'abilitySet'] as const) {
    for (const { source, effect: f } of effects) {
      if (f.kind !== pass) continue
      const next = f.kind === 'ability' ? Math.max(out[f.ability], Math.min(f.max ?? 30, out[f.ability] + f.value)) : Math.max(out[f.ability], f.value)
      if (next !== out[f.ability]) lines[f.ability].push({ source, value: next - out[f.ability] })
      out[f.ability] = next
    }
  }
  return { scores: out, lines }
}

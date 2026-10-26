// Item effects: which equipped items, and which custom actions the player switched on, change the character's numbers.
// derive() and src/explain both read these, so the sheet and "show the math" agree.
import type { Character } from '../model/character'
import { entryItem } from './data/items'
import { ABILITIES, type Abilities, type Ability, type BonusEffectKind, type InventoryEntry, type ItemEffect } from './types'

type Owner = Partial<Pick<Character, 'inventory' | 'state' | 'customActions'>>

/** An entry's effects work while it is equipped. */
export const effectsActive = (e: InventoryEntry) => e.equipped

export interface ActiveEffect { source: string; effect: ItemEffect }

export function activeItemEffects(c: Owner): ActiveEffect[] {
  const items = (c.inventory ?? []).flatMap(e => {
    if (!e.effects?.length || !effectsActive(e)) return []
    const source = entryItem(e)?.name ?? e.name ?? e.itemId
    return e.effects.map(effect => ({ source, effect }))
  })
  // A custom action's stat changes (Rage-like stances, a blessing) count while it is switched on.
  const actions = (c.customActions ?? []).flatMap(a => (a.active ? (a.stats ?? []).map(effect => ({ source: a.name, effect })) : []))
  return [...items, ...actions]
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

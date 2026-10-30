// Item effects: which equipped items, and which custom actions the player switched on, change the character's numbers.
// derive() and src/explain both read these, so the sheet and "show the math" agree.
import type { Character } from '../model/character'
import { entryItem } from './data/items'
import { ALL_SKILLS } from './data/skills'
import {
  ABILITIES, type Abilities, type Ability, type AdvantageOn, type BonusEffectKind, type ConditionId, type InventoryEntry, type ItemEffect, type MoveMode,
  type Recharge, type Sense, type SkillId,
} from './types'

type EffectOf<K extends ItemEffect['kind']> = ItemEffect & { kind: K }

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

/**
 * Each item's bonus of one kind; `unarmored` bonuses only count when `unarmored` is true.
 * `weapon` is the attack being made: bonuses marked melee-only or ranged-only skip the other kind.
 */
export function itemBonuses(c: Owner, kind: BonusEffectKind, unarmored = true, weapon?: 'melee' | 'ranged'): { source: string; value: number }[] {
  return effectsOf(c, kind).flatMap(({ source, effect: f }) => {
    const b = f as Extract<ItemEffect, { kind: BonusEffectKind }>
    if (b.unarmored && !unarmored) return []
    if (b.only && weapon && b.only !== weapon) return []
    return [{ source, value: b.value }]
  })
}

export const itemBonus = (c: Owner, kind: BonusEffectKind, unarmored = true, weapon?: 'melee' | 'ranged') =>
  itemBonuses(c, kind, unarmored, weapon).reduce((n, b) => n + b.value, 0)

/** Every active effect of one kind, with the item (or action) it came from. */
export function effectsOf<K extends ItemEffect['kind']>(c: Owner, ...kinds: K[]): { source: string; effect: EffectOf<K> }[] {
  return activeItemEffects(c).filter((x): x is { source: string; effect: EffectOf<K> } => (kinds as string[]).includes(x.effect.kind))
}

/** An effect the editor can keep: numbers set where they matter, names filled in. */
export function isUsefulEffect(f: ItemEffect): boolean {
  switch (f.kind) {
    case 'saveProficiency': case 'skillProficiency': case 'advantage': case 'conditionImmunity': return true
    case 'resistance': case 'immunity': return !!f.damage.trim()
    case 'spell': return !!f.spell.trim()
    case 'moveSpeed': return f.value >= 0
    default: return !!f.value
  }
}

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

const BONUS_KINDS: BonusEffectKind[] = ['ac', 'saves', 'checks', 'spellAttack', 'spellDc', 'speed', 'attack', 'damage', 'initiative', 'hp', 'passivePerception']
const MOVES: MoveMode[] = ['fly', 'swim', 'climb', 'burrow']
const SENSES: Sense[] = ['darkvision', 'blindsight', 'tremorsense', 'truesight']
const RECHARGES: Recharge[] = ['short', 'long', 'dawn', 'none']
export const CONDITIONS: ConditionId[] = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
  'prone', 'restrained', 'stunned', 'unconscious',
]

/** An effect read from outside (a shared DM request, an import), or undefined when it isn't one. */
export function sanitizeEffect(raw: unknown): ItemEffect | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const f = raw as Record<string, unknown>
  const num = (v: unknown, lo = -99, hi = 999) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : 0)
  const text = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '')
  const pick = <T extends string>(v: unknown, from: readonly T[]): T | undefined => (from.includes(v as T) ? (v as T) : undefined)
  const ability = pick(f.ability, ABILITIES)
  const skill = pick(f.skill, ALL_SKILLS)
  const kind = f.kind as ItemEffect['kind']
  if (pick(kind, BONUS_KINDS)) {
    const only = pick(f.only, ['melee', 'ranged'] as const)
    return { kind: kind as BonusEffectKind, value: num(f.value, -99, 99), ...(f.unarmored === true ? { unarmored: true } : {}), ...(only ? { only } : {}) }
  }
  switch (kind) {
    case 'abilitySet': return { kind, ability: ability ?? 'str', value: num(f.value, 1, 30) }
    case 'ability': return { kind, ability: ability ?? 'str', value: num(f.value), ...(typeof f.max === 'number' ? { max: num(f.max, 1, 30) } : {}) }
    case 'save': return ability && { kind, ability, value: num(f.value) }
    case 'skill': return skill && { kind, skill, value: num(f.value) }
    case 'saveProficiency': return ability && { kind, ability }
    case 'skillProficiency': return skill && { kind, skill, ...(f.expertise === true ? { expertise: true } : {}) }
    case 'advantage': {
      const on = f.on as string
      const ok = ['saves', 'checks', 'initiative', 'attacks', 'concentration'].includes(on)
        || (on?.startsWith?.('skill:') && ALL_SKILLS.includes(on.slice(6) as SkillId))
        || (on?.startsWith?.('save:') && ABILITIES.includes(on.slice(5) as Ability))
      return ok ? { kind, on: on as AdvantageOn, ...(text(f.when) ? { when: text(f.when) } : {}) } : undefined
    }
    case 'resistance': case 'immunity': return text(f.damage, 30) ? { kind, damage: text(f.damage, 30) } : undefined
    case 'conditionImmunity': { const condition = pick(f.condition, CONDITIONS); return condition && { kind, condition } }
    case 'moveSpeed': { const mode = pick(f.mode, MOVES); return mode && { kind, mode, value: num(f.value, 0) } }
    case 'sense': { const sense = pick(f.sense, SENSES); return sense && { kind, sense, value: num(f.value, 0) } }
    case 'spellSlot': return { kind, level: num(f.level, 1, 9) || 1, value: num(f.value, -9, 9) }
    case 'pactSlot': return { kind, value: num(f.value, -4, 4) }
    case 'charges': return { kind, value: num(f.value, 0), recharge: pick(f.recharge, RECHARGES) ?? 'long', ...(text(f.regain, 20) ? { regain: text(f.regain, 20) } : {}) }
    case 'spell': return text(f.spell) ? { kind, spell: text(f.spell), ...(text(f.note) ? { note: text(f.note) } : {}) } : undefined
  }
  return undefined
}

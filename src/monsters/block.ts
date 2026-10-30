// Pure reads of a Monster stat block: modifiers, legendary counts, spell slots. No React, no storage.
// Every monster screen (DM screen, NPC sheets, custom monsters) reads stat blocks through here.
import type { Monster, MonsterAction } from '../content'
import type { Ability } from '../rules'

export const monsterMod = (score: number) => Math.floor((score - 10) / 2)

/**
 * Fields the full-monster-list and custom-monsters threads add to `Monster` (agreed 2026-10-30).
 * Declared here as well so stat blocks render them as soon as the data has them; once `Monster`
 * carries them, this intersection is redundant and can go.
 */
export interface MonsterExtras {
  spellcasting?: MonsterSpellcasting
  lairActions?: MonsterAction[]
  legendary?: { actions: number; resistance?: number; description?: string }
  /** 2024 initiative bonus; missing = DEX modifier. */
  initiative?: number
  /** Book code (MM, VGM...), named by BOOK_TITLES. */
  book?: string
}

export interface MonsterSpellcasting {
  ability: Ability
  saveDc?: number
  attackBonus?: number
  /** "Cantrips (at will)", "1st level (4 slots)", "1/day each": the spells under each heading. */
  groups: { label: string; spells: string[] }[]
  note?: string
}

export type Block = Monster & MonsterExtras

export const initBonus = (m: Block) => m.initiative ?? monsterMod(m.abilities.dex)
export const conSave = (m: Block) => m.savingThrows.con ?? monsterMod(m.abilities.con)
export const passivePerception = (m: Block) => {
  const given = m.senses.passive_perception ?? m.senses['passive perception']
  if (typeof given === 'number') return given
  return 10 + (m.skills.perception ?? monsterMod(m.abilities.wis))
}

/** Legendary actions per round: the shared field, else the "can take 3 legendary actions" text, else 3 when it has any. */
export function legendaryCount(m: Block): number {
  if (m.legendary?.actions != null) return m.legendary.actions
  if (!m.legendaryActions.length) return 0
  const text = m.legendaryActions.map(a => a.description).join(' ') + ' ' + (m.legendary?.description ?? '')
  const n = /can take (\d+) legendary action/i.exec(text)
  return n ? Number(n[1]) : 3
}

/** Legendary Resistance uses per day: the shared field, else the "(3/Day)" on a trait named Legendary Resistance. */
export function legendaryResistance(m: Block): number {
  if (m.legendary?.resistance != null) return m.legendary.resistance
  const t = m.traits.find(x => /legendary resistance/i.test(x.name))
  if (!t) return 0
  if (t.usage?.type === 'per day') return t.usage.times
  const n = /\((\d+)\/day\)/i.exec(t.name)
  return n ? Number(n[1]) : 3
}

/** Spell slots per level from the spellcasting group labels ("1st level (4 slots)"), index 0 = 1st level. */
export function spellSlots(m: Block): number[] {
  const slots = Array<number>(9).fill(0)
  for (const g of m.spellcasting?.groups ?? []) {
    const lvl = /(\d)(?:st|nd|rd|th)[- ]level/i.exec(g.label)
    const n = /\((\d+) slots?\)/i.exec(g.label)
    if (lvl && n) slots[Number(lvl[1]) - 1] = Number(n[1])
  }
  return slots
}

/** Groups the stat block limits per day ("1/day each"): label → uses. */
export function perDayGroups(m: Block): Record<string, number> {
  const out: Record<string, number> = {}
  for (const g of m.spellcasting?.groups ?? []) {
    const n = /(\d+)\s*\/\s*day/i.exec(g.label)
    if (n) out[g.label] = Number(n[1])
  }
  return out
}

/** Uses an action has before a rest or a recharge: per day → times, recharge → 1, per rest → 1; unlimited → null. */
export function actionUses(a: MonsterAction): number | null {
  if (!a.usage) return null
  if (a.usage.type === 'per day') return a.usage.times
  return 1
}

/** Every action with a usage limit, by name, across the block's lists. */
export function limitedActions(m: Block): MonsterAction[] {
  return [...m.traits, ...m.actions, ...m.bonusActions, ...m.reactions, ...(m.lairActions ?? [])].filter(a => a.usage)
}

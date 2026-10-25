// Pure quick-cast logic: managing pinned entries, choosing slots, scaling spell dice.
// Play-state changes go through the sheet engine so they behave like the rest of the sheet.
import { formatNotation, parseNotation } from '../dice/notation'
import type { Character } from '../model/character'
import { getResources, getSpellSlots } from '../rules'
import { setPactUsed, setResourceUsed, setSlotUsed, upsertCounter } from '../sheet/engine'
import type { QuickCastEntry, SlotChoice, SpellEntry } from './types'

export const ORDINAL = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

export const entriesOf = (c: Character): QuickCastEntry[] => c.quickCast ?? []

export const newEntryId = () => `qc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function addEntry(c: Character, entry: QuickCastEntry): Character {
  return { ...c, quickCast: [...entriesOf(c), entry] }
}

export function removeEntry(c: Character, id: string): Character {
  return { ...c, quickCast: entriesOf(c).filter(e => e.id !== id) }
}

/** Moves an entry one place left (-1) or right (+1). */
export function moveEntry(c: Character, id: string, by: -1 | 1): Character {
  const list = [...entriesOf(c)]
  const i = list.findIndex(e => e.id === id)
  const j = i + by
  if (i < 0 || j < 0 || j >= list.length) return c
  ;[list[i], list[j]] = [list[j], list[i]]
  return { ...c, quickCast: list }
}

/** Slots that can cast a spell of this level, lowest first. Cantrips need none. */
export function slotChoices(c: Character, spellLevel: number): SlotChoice[] {
  if (spellLevel <= 0) return []
  const { slots, pact } = getSpellSlots(c)
  const out: SlotChoice[] = []
  slots.forEach((total, i) => {
    const remaining = total - (c.state.spellSlotsUsed[i] ?? 0)
    if (i + 1 >= spellLevel && remaining > 0) out.push({ source: 'slot', level: i + 1, remaining })
  })
  if (pact && pact.level >= spellLevel && pact.count - c.state.pactSlotsUsed > 0) {
    out.push({ source: 'pact', level: pact.level, remaining: pact.count - c.state.pactSlotsUsed })
  }
  return out.sort((a, b) => a.level - b.level || (a.source === 'pact' ? 1 : -1))
}

export function spendSlot(c: Character, choice: SlotChoice): Character {
  return choice.source === 'pact'
    ? setPactUsed(c, c.state.pactSlotsUsed + 1)
    : setSlotUsed(c, choice.level, (c.state.spellSlotsUsed[choice.level - 1] ?? 0) + 1)
}

/** Multiplies die counts, and flat numbers too when withFlat: "1d4+1" x2 = "2d4+2". */
function multiply(notation: string, times: number, withFlat = false): string {
  return formatNotation(parseNotation(notation).map(t =>
    t.kind === 'dice' ? { ...t, count: t.count * times } : withFlat ? { ...t, value: t.value * times } : t))
}

/**
 * The damage or healing notation for a spell cast at castLevel.
 * charLevel scales cantrips; spellMod is added when the spell says so (Cure Wounds).
 */
export function spellDamage(spell: SpellEntry, castLevel: number, charLevel: number, spellMod = 0): string | undefined {
  if (!spell.damage) return undefined
  let notation = spell.damage
  if (spell.level === 0 && spell.cantripScaling) {
    notation = multiply(notation, 1 + [5, 11, 17].filter(l => charLevel >= l).length)
  }
  const extra = castLevel - spell.level
  if (spell.level > 0 && spell.upcast && extra > 0) notation += `+${multiply(spell.upcast, extra, true)}`
  if (spell.addMod && spellMod) notation += spellMod > 0 ? `+${spellMod}` : `-${-spellMod}`
  return formatNotation(parseNotation(notation))
}

export interface ResourceUse {
  label: string
  remaining: number
  max: number
}

/** A class resource or player tracker by id, with what is left. */
export function resourceUse(c: Character, id: string): ResourceUse | undefined {
  const r = getResources(c).find(x => x.id === id)
  if (r) return { label: r.label, max: r.max, remaining: r.max - (c.state.resources[r.id]?.used ?? 0) }
  const k = c.state.counters?.find(x => x.id === id)
  if (k) return { label: k.label, max: k.max, remaining: k.max - k.used }
  return undefined
}

/** Spends one use. Returns the character unchanged when none are left. */
export function spendResource(c: Character, id: string): Character {
  const r = getResources(c).find(x => x.id === id)
  if (r) return setResourceUsed(c, id, (c.state.resources[id]?.used ?? 0) + 1)
  const k = c.state.counters?.find(x => x.id === id)
  if (k && k.used < k.max) return upsertCounter(c, { ...k, used: k.used + 1 })
  return c
}

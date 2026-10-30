// Casting a spell from the sheet: spend the slot, gain its temporary HP or healing, and start its
// running effect (concentration, duration, AC, extra damage...). Pure; the plan comes from rules/usables.ts.
import type { Spell } from '../content'
import type { Character } from '../model/character'
import { planCast, type CastContext, type CastPlan, type DerivedStats } from '../rules'
import type { SlotChoice } from '../quickcast'
import { slotChoices, spendSlot } from '../quickcast/quickcast'
import { grantTempHp, heal, setResourceUsed } from '../sheet/engine'
import { startEffect } from '../sheet/effects'
import { editionOf } from './access'

export function castContext(c: Character, d: DerivedStats): CastContext {
  return { edition: editionOf(c), mod: d.spellcasting ? d.mods[d.spellcasting.ability] : 0, speed: d.speed }
}

/** The slot a one-tap cast uses: the lowest free one that fits. Cantrips need none. */
export const defaultSlot = (c: Character, spell: Pick<Spell, 'level'>): SlotChoice | undefined => slotChoices(c, spell.level)[0]

/** What casting at this slot would do. */
export const castPlan = (c: Character, d: DerivedStats, spell: Spell, slot?: SlotChoice, level?: number): CastPlan => planCast(spell, slot?.level ?? level ?? spell.level, castContext(c, d))

/** A plain number ("10"), or undefined when it needs a roll ("1d4+4"). */
export const fixedAmount = (notation: string) => (/^\d+$/.test(notation) ? Number(notation) : undefined)

/**
 * Applies a cast: the slot (if any), the rolled temporary HP and healing, and the running effect.
 * `ended` names a concentration spell the new one replaced.
 */
export function castSpell(c: Character, plan: CastPlan, opts: { slot?: SlotChoice; tempHp?: number; heal?: number; spend?: { id: string; n: number } } = {}): { character: Character; ended: string[] } {
  let next = opts.slot ? spendSlot(c, opts.slot) : c
  // A race or item spell spends its own use or the item's charges instead of a slot.
  if (opts.spend) next = setResourceUsed(next, opts.spend.id, (next.state.resources[opts.spend.id]?.used ?? 0) + opts.spend.n)
  let ended: string[] = []
  // The effect first, so Aid's higher maximum is in place before its healing.
  if (plan.effect) ({ character: next, ended } = startEffect(next, plan.effect))
  if (opts.tempHp) next = grantTempHp(next, opts.tempHp)
  if (opts.heal) next = heal(next, opts.heal)
  return { character: next, ended }
}

// Saved quick-cast entries. Stored on Character.quickCast in the player's chosen order.
import type { Ability } from '../rules/types'

export type QuickCastEntry =
  /** A weapon attack from derive().attacks, matched by name. */
  | { id: string; kind: 'attack'; name: string }
  /** A spell the player typed in. Level 0 is a cantrip and costs no slot. */
  | {
      id: string
      kind: 'spell'
      name: string
      level: number
      /** `auto`: hits without a roll (Magic Missile's darts). */
      roll: 'attack' | 'save' | 'auto' | 'none'
      save?: Ability
      /** Damage or healing at the spell's base level, e.g. "8d6". */
      damage?: string
      /** e.g. "fire" or "healing". */
      damageType?: string
      /** Adds the spellcasting modifier to the roll (Cure Wounds). */
      addMod?: boolean
      /** Added per slot level above the base, e.g. "1d6" or "1d4+1". */
      upcast?: string
      /** Cantrip damage dice grow at character levels 5, 11 and 17. */
      cantripScaling?: boolean
    }
  /** Spends one use of a class resource (Ki, Rage) or a player tracker (arrows). */
  | { id: string; kind: 'resource'; resourceId: string }

export type SpellEntry = Extract<QuickCastEntry, { kind: 'spell' }>

/** Where a spell's slot comes from. */
export interface SlotChoice {
  source: 'slot' | 'pact'
  level: number
  remaining: number
}

import type { Character, HitDie } from '../model/character'
import {
  critNotation, roll, rollAttack, rollAttackWithDamage, rollCheck, rollDeathSave, rollHitDie, rollInitiative, rollSave, rollSkill,
  type AttackOutcome, type RollMode, type RollResult,
} from '../dice'
import type { DerivedStats } from '../rules'
import type { Ability, SkillId } from '../rules/types'
import { useDice } from '../dice/ui'

const noRecord = (r: RollResult) => r

/**
 * Rolls through the shared dice module so results land in the dice tray history.
 * Returns natural die values; the sheet engine applies modifiers and outcomes itself.
 */
export function useSheetRolls(c: Character) {
  let record = noRecord
  try {
    record = useDice().record
  } catch {
    // Rendered outside <DiceProvider> (tests, standalone use): roll without history.
  }
  const character = { id: c.id, name: c.name, state: c.state }
  return {
    hitDie(die: HitDie, conMod: number): number {
      const r = record(rollHitDie(die, conMod, { character }))
      const term = r.terms.find(t => t.kind === 'dice')
      return term?.kind === 'dice' ? term.rolls[0].value : 1
    },
    deathSave(): number {
      return record(rollDeathSave({ character })).d20?.natural ?? 10
    },
    /** One tap on an attack: to-hit and damage, both saved to the history. */
    attack(...[a, opts]: Parameters<typeof rollAttackWithDamage>): AttackOutcome {
      const out = rollAttackWithDamage(a, { ...opts, character })
      record(out.attack)
      if (out.damage) record(out.damage)
      return out
    },
    check: (stats: DerivedStats, a: Ability, mode?: RollMode) => record(rollCheck(stats, a, { character, mode })),
    save: (stats: DerivedStats, a: Ability, mode?: RollMode) => record(rollSave(stats, a, { character, mode })),
    skill: (stats: DerivedStats, s: SkillId, mode?: RollMode) => record(rollSkill(stats, s, { character, mode })),
    initiative: (stats: DerivedStats) => record(rollInitiative(stats, { character })),
    /**
     * A spell from the attacks table: the spell attack (if any), then its damage plus riders.
     * A crit doubles the dice; a natural 1 on the attack rolls no damage.
     */
    spell(name: string, opts: { attackBonus?: number; damage?: string; damageType?: string; mode?: RollMode; riders?: { name: string; damage: string }[] }): AttackOutcome | { damage?: RollResult } {
      const hit = opts.attackBonus === undefined ? undefined : record(rollAttack({ name, bonus: opts.attackBonus }, { character, mode: opts.mode }))
      if (hit?.d20?.fumble || !opts.damage) return hit ? { attack: hit } : {}
      const riders = opts.riders ?? []
      const notation = [opts.damage, ...riders.map(r => r.damage)].map((n, i) => (i === 0 || /^[+\-−]/.test(n) ? n : `+${n}`)).join('')
      const crit = !!hit?.d20?.crit
      const extras = riders.length ? ` + ${riders.map(r => r.name).join(', ')}` : ''
      const label = `${name}${opts.damageType ? ` ${opts.damageType}` : ''}${extras}${crit ? ' (crit)' : ''}`
      const damage = record(roll(crit ? critNotation(notation) : notation, { character, label }, 'damage'))
      return hit ? { attack: hit, damage } : { damage }
    },
    /** Any notation, e.g. a wand's "1d6+1" charges at dawn. Returns 0 if the notation is invalid. */
    total(notation: string, label: string): number {
      try {
        return record(roll(notation, { character, label })).total
      } catch {
        return 0
      }
    },
  }
}

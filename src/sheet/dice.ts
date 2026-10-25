import type { Character, HitDie } from '../model/character'
import { roll, rollDeathSave, rollHitDie, type RollResult } from '../dice'
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

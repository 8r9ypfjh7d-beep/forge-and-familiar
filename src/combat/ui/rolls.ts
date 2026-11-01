// Tracker rolls go through the shared dice module, so they land in the dice tray history.
import { rollD20, rollInitiative, rollSave, type RollResult } from '../../dice'
import { useDice } from '../../dice/ui'
import { derive, type Ability } from '../../rules'
import type { Party } from '../engine'
import type { Combatant } from '../types'

const QUIET = { quiet: true }
const roller = (c: Combatant) => ({ characterId: c.characterId ?? c.id, characterName: c.name })

export function useCombatRolls() {
  const { record: shared } = useDice()
  /** Every tracker roll is the DM's, so none takes over the screen; players roll on their own phones. */
  const record = (r: RollResult) => shared(r, QUIET)
  return {
    /** Party members roll from their sheet (DEX, conditions); others from their modifier. */
    initiative(c: Combatant, party: Party): RollResult | undefined {
      const ch = c.characterId ? party[c.characterId] : undefined
      if (c.kind === 'pc') return ch && record(rollInitiative(derive(ch), { character: ch }))
      return record(rollD20(c.initBonus, { label: 'Initiative', roller: roller(c) }, 'initiative'))
    },
    concentration(c: Combatant, party: Party, label: string): RollResult | undefined {
      const ch = c.characterId ? party[c.characterId] : undefined
      if (c.kind === 'pc') return ch && record(rollSave(derive(ch), 'con', { character: ch, label }))
      return record(rollD20(c.conSave ?? 0, { label, roller: roller(c) }, 'save'))
    },
    /** Any save: party members from their sheet, others with `bonus` (a stat block's save, or the row's CON save). */
    save(c: Combatant, party: Party, ability: Ability, label: string, bonus?: number): RollResult | undefined {
      const ch = c.characterId ? party[c.characterId] : undefined
      if (c.kind === 'pc') return ch && record(rollSave(derive(ch), ability, { character: ch, label }))
      return record(rollD20(bonus ?? (ability === 'con' ? c.conSave ?? 0 : 0), { label, roller: roller(c) }, 'save'))
    },
    record,
  }
}

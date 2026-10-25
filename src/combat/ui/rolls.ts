// Tracker rolls go through the shared dice module, so they land in the dice tray history.
import { rollD20, rollInitiative, rollSave, type RollResult } from '../../dice'
import { useDice } from '../../dice/ui'
import { derive } from '../../rules'
import type { Party } from '../engine'
import type { Combatant } from '../types'

const roller = (c: Combatant) => ({ characterId: c.characterId ?? c.id, characterName: c.name })

export function useCombatRolls() {
  const { record } = useDice()
  return {
    /** Party members roll from their sheet (DEX, conditions, exhaustion); others from their modifier. */
    initiative(c: Combatant, party: Party): RollResult | undefined {
      const ch = c.characterId ? party[c.characterId] : undefined
      if (c.kind === 'pc') return ch && record(rollInitiative(derive(ch), { character: ch }))
      return record(rollD20(c.initBonus, { label: 'Initiative', roller: roller(c) }, 'initiative'))
    },
    concentration(c: Combatant, party: Party, dc: number): RollResult | undefined {
      const label = `Concentration (DC ${dc})`
      const ch = c.characterId ? party[c.characterId] : undefined
      if (c.kind === 'pc') return ch && record(rollSave(derive(ch), 'con', { character: ch, label }))
      return record(rollD20(c.conSave ?? 0, { label, roller: roller(c) }, 'save'))
    },
    record,
  }
}

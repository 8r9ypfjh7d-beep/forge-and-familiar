import { roll, rollAttack, rollD20, rollDamage, type RollResult } from '../dice'
import { useDice } from '../dice/ui'
import { formatMod } from '../rules'
import type { Companion, CreatureAction } from './types'

const noRecord = (r: RollResult) => r

/** Rolls for a companion through the shared dice history, tagged with the owner's character id. */
export function useCompanionRolls(comp: Pick<Companion, 'characterId' | 'name'>) {
  let record = noRecord
  try {
    record = useDice().record
  } catch {
    // Rendered outside <DiceProvider> (tests, standalone use): roll without history.
  }
  const roller = { characterId: comp.characterId, characterName: comp.name }
  return {
    attack: (a: CreatureAction) => record(rollAttack({ name: a.name, bonus: a.toHit ?? 0 }, { roller })),
    damage: (a: CreatureAction, crit = false) =>
      record(rollDamage({ name: a.name, damage: a.damage ?? '0', damageType: a.damageType ?? '' }, { roller, crit })),
    check: (label: string, mod: number) => record(rollD20(mod, { roller, label: `${label} check (${formatMod(mod)})` }, 'check')),
    hp: (hitDice: string) => record(roll(hitDice, { roller, label: 'Hit points' })).total,
  }
}

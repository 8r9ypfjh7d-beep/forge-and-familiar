// Library monsters joining a fight already under way: the same rows the DM screen's Start fight makes (src/dm/logic planCombatants).
import type { Monster } from '../content'
import { planCombatants, planEntry, type StartDice } from '../dm/logic'
import { inCombat } from './engine'
import type { Combatant, Encounter } from './types'

/**
 * `count` copies of a library monster for `enc`: stat block reference, average (or rolled) HP, and while combat is
 * running one initiative roll for the group. Names carry on from creatures of the same name already in the fight
 * (Goblin 3, Goblin 4 after Goblin 1 and 2).
 */
export function libraryRows(enc: Encounter, m: Monster, count: number, newId: () => string, dice: StartDice = {}, rollHp = false, name = m.name): Omit<Combatant, 'conditions'>[] {
  const n = Math.min(20, Math.max(1, Math.floor(count) || 1))
  const rows = planCombatants({ id: '', name: '', rollHp, monsters: [{ ...planEntry(m), name, count: n }] }, [m], newId,
    { hp: dice.hp, d20: inCombat(enc) ? dice.d20 : undefined })
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const numbered = new RegExp(`^${esc}(?: (\\d+))?$`)
  const taken = enc.combatants.map(c => numbered.exec(c.name)).filter((x): x is RegExpExecArray => !!x).map(x => Number(x[1] ?? 1))
  if (!taken.length) return rows
  const from = Math.max(...taken) + 1
  return rows.map((r, i) => ({ ...r, name: `${name} ${from + i}` }))
}

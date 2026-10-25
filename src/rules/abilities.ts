import type { Character } from '../model/character'
import { improvementBonuses } from './choices'
import { raceById } from './data/races'
import { ABILITIES, type Abilities, type Ability } from './types'

export const abilityMod = (score: number) => Math.floor((score - 10) / 2)

export const formatMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

export const POINT_BUY_BUDGET = 27
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

/** Points spent, or null when a score is outside the 8–15 point-buy range. */
export function pointBuyCost(scores: Abilities): number | null {
  let total = 0
  for (const a of ABILITIES) {
    const cost = POINT_COST[scores[a]]
    if (cost === undefined) return null
    total += cost
  }
  return total
}

export function emptyAbilities(value = 10): Abilities {
  return { str: value, dex: value, con: value, int: value, wis: value, cha: value }
}

type RacialInput = Pick<Character, 'raceId' | 'subraceId' | 'freeAbilityBonuses'>

/** Racial bonuses from race, subrace and free picks. */
export function racialBonuses(c: RacialInput): Abilities {
  const out = emptyAbilities(0)
  const race = raceById(c.raceId)
  if (!race) return out
  const sub = race.subraces?.find(s => s.id === c.subraceId)
  for (const src of [race.abilityBonuses, sub?.abilityBonuses ?? {}]) {
    for (const [a, v] of Object.entries(src) as [Ability, number][]) out[a] += v
  }
  if (race.freeAbilityBonuses) {
    for (const a of c.freeAbilityBonuses.slice(0, race.freeAbilityBonuses.count)) {
      if (!race.freeAbilityBonuses.exclude.includes(a)) out[a] += 1
    }
  }
  return out
}

/** Final ability scores: base + racial bonuses + Ability Score Improvements and feats, capped at 20. */
export function getAbilityScores(c: RacialInput & Pick<Character, 'baseAbilities'> & Partial<Pick<Character, 'classes' | 'improvements'>>): Abilities {
  const bonus = racialBonuses(c)
  const asi = improvementBonuses({ classes: c.classes ?? [], improvements: c.improvements })
  const out = emptyAbilities()
  for (const a of ABILITIES) out[a] = Math.min(20, c.baseAbilities[a] + bonus[a] + asi[a])
  return out
}

export function getAbilityMods(scores: Abilities): Abilities {
  const out = emptyAbilities(0)
  for (const a of ABILITIES) out[a] = abilityMod(scores[a])
  return out
}

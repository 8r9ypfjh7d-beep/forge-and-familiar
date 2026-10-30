import type { Character } from '../model/character'
import { featAbilityChoices, improvementBonuses, type FeatInput } from './choices'
import { raceById } from './data/races'
import { rulesEdition } from './edition'
import { applyItemAbilities } from './itemEffects'
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

/** Dice notation for one rolled ability score: four d6, drop the lowest. */
export const ROLLED_NOTATION = '4d6dl1'

/**
 * Rolled method: give ability `a` the pool value `v`. When every copy of `v` is already
 * held by other abilities, one of them takes `a`'s old value, so nothing has to be cleared first.
 */
export function assignRolled(base: Abilities, pool: readonly number[], a: Ability, v: number): Abilities {
  const next = { ...base, [a]: v }
  if (!v) return next
  const allowed = pool.filter(x => x === v).length
  const holders = ABILITIES.filter(x => x !== a && next[x] === v)
  if (holders.length >= allowed && holders.length) next[holders[0]] = base[a]
  return next
}

/** True when the six base scores use each rolled value exactly once. */
export function usesRolledPool(base: Abilities, pool: readonly number[]): boolean {
  if (pool.length !== ABILITIES.length) return false
  const sorted = (xs: readonly number[]) => [...xs].sort((x, y) => x - y).join()
  return sorted(ABILITIES.map(a => base[a])) === sorted(pool)
}

export function emptyAbilities(value = 10): Abilities {
  return { str: value, dex: value, con: value, int: value, wis: value, cha: value }
}

type RacialInput = Pick<Character, 'raceId' | 'subraceId' | 'freeAbilityBonuses'> &
  Partial<Pick<Character, 'rulesEdition' | 'backgroundId' | 'customBackground' | 'racialBonusTargets'>>

/**
 * 2024 background bonuses: one +1 per `freeAbilityBonuses` entry, at most +2 to one and +3 in total
 * (so +2/+1 or +1/+1/+1). Any ability counts: the background's three are the book's suggestion.
 */
export function backgroundBonuses(c: RacialInput): Abilities {
  const out = emptyAbilities(0)
  let total = 0
  for (const a of c.freeAbilityBonuses) {
    if (out[a] >= 2 || total >= 3) continue
    out[a] += 1
    total += 1
  }
  return out
}

/** A 2014 race or subrace bonus: where the book puts it (`book`) and where it goes (`ability`, moved by `racialBonusTargets`). */
export interface RacialBonus { source: string; sourceId: string; value: number; book: Ability; ability: Ability }

/** 2014 fixed race then subrace bonuses, in order; `racialBonusTargets[i]` moves the i-th one to another ability. */
export function fixedRacialBonuses(c: RacialInput): RacialBonus[] {
  if (rulesEdition(c) === '2024') return []
  const race = raceById(c.raceId)
  if (!race) return []
  const sub = race.subraces?.find(s => s.id === c.subraceId)
  const out: RacialBonus[] = []
  for (const [from, bonuses] of [[race, race.abilityBonuses], [sub, sub?.abilityBonuses ?? {}]] as const) {
    for (const [a, v] of Object.entries(bonuses) as [Ability, number][]) {
      if (v) out.push({ source: from?.name ?? '', sourceId: from?.id ?? '', value: v, book: a, ability: c.racialBonusTargets?.[out.length] ?? a })
    }
  }
  return out
}

/**
 * Ability bonuses from origin: 2014 race and subrace (moved where the player put them) and free picks;
 * 2024 the background. Free picks may land on the race's excluded ability: the builder only warns.
 */
export function racialBonuses(c: RacialInput): Abilities {
  if (rulesEdition(c) === '2024') return backgroundBonuses(c)
  const out = emptyAbilities(0)
  const race = raceById(c.raceId)
  if (!race) return out
  for (const b of fixedRacialBonuses(c)) out[b.ability] += b.value
  if (race.freeAbilityBonuses) {
    for (const a of new Set(c.freeAbilityBonuses.slice(0, race.freeAbilityBonuses.count))) out[a] += 1
  }
  return out
}

/**
 * Final ability scores: base + origin bonuses + Ability Score Improvements and feats, capped at 20, then feat
 * +1 picks with their own cap (Epic Boons go to 30), then worn magic items.
 */
export function getAbilityScores(c: RacialInput & Pick<Character, 'baseAbilities'> & Partial<Pick<Character, 'classes' | 'improvements' | 'inventory' | 'state'>> & Omit<FeatInput, 'classes'>): Abilities {
  const bonus = racialBonuses(c)
  const feats = { ...c, classes: c.classes ?? [] }
  const asi = improvementBonuses(feats)
  const out = emptyAbilities()
  for (const a of ABILITIES) out[a] = Math.min(20, c.baseAbilities[a] + bonus[a] + asi[a])
  for (const { ability, max } of featAbilityChoices(feats)) out[ability] = Math.max(out[ability], Math.min(max, out[ability] + 1))
  return applyItemAbilities(c, out).scores
}

export function getAbilityMods(scores: Abilities): Abilities {
  const out = emptyAbilities(0)
  for (const a of ABILITIES) out[a] = abilityMod(scores[a])
  return out
}

import type { Character } from '../model/character'
import { featAbilityChoices, improvementBonuses, type FeatInput } from './choices'
import { getBackground } from './data/backgrounds'
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

export function emptyAbilities(value = 10): Abilities {
  return { str: value, dex: value, con: value, int: value, wis: value, cha: value }
}

type RacialInput = Pick<Character, 'raceId' | 'subraceId' | 'freeAbilityBonuses'> &
  Partial<Pick<Character, 'rulesEdition' | 'backgroundId' | 'customBackground'>>

/**
 * 2024 background bonuses: one +1 per `freeAbilityBonuses` entry, only to the background's three abilities,
 * at most +2 to one and +3 in total (so +2/+1 or +1/+1/+1).
 */
export function backgroundBonuses(c: RacialInput): Abilities {
  const out = emptyAbilities(0)
  const allowed = getBackground({ backgroundId: c.backgroundId ?? '', customBackground: c.customBackground, rulesEdition: c.rulesEdition })?.abilityScores ?? []
  let total = 0
  for (const a of c.freeAbilityBonuses) {
    if (!allowed.includes(a) || out[a] >= 2 || total >= 3) continue
    out[a] += 1
    total += 1
  }
  return out
}

/** Ability bonuses from origin: 2014 race, subrace and free picks; 2024 the background. */
export function racialBonuses(c: RacialInput): Abilities {
  if (rulesEdition(c) === '2024') return backgroundBonuses(c)
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

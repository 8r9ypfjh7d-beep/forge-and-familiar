// Starting wealth: 2014 "take gold instead" (class gold dice), 2024 background option B (50 gp),
// and the gear bought with it in the builder. Pure: rolling the dice is the builder's job.
import type { Character, Purchase } from '../model/character'
import type { ClassDef } from './types'

/** 2024 backgrounds: option B is 50 gp instead of the items. */
export const BACKGROUND_GOLD_2024 = 50

/** "5d4 × 10" style wealth dice of a 2014 class. */
export const wealthDice = (def: ClassDef) => def.startingWealth && { notation: `${def.startingWealth.dice}d4`, multiplier: def.startingWealth.multiplier }

/** The average of a class's wealth dice in gp (each d4 averages 2.5), rounded down. */
export const averageWealth = (def: ClassDef) => (def.startingWealth ? Math.floor(def.startingWealth.dice * 2.5 * def.startingWealth.multiplier) : 0)

type Wealth = Partial<Pick<Character, 'rulesEdition' | 'startingWealth'>>

/** True when a 2014 character took the class gold instead of the class and background gear. */
export const takesClassGold = (d: Wealth) => d.rulesEdition !== '2024' && d.startingWealth?.classGold !== undefined

/** True when a 2024 character took the background's 50 gp instead of its items. */
export const takesBackgroundGold = (d: Wealth) => d.rulesEdition === '2024' && !!d.startingWealth?.backgroundGold

/** Total price of the builder purchases in copper pieces. */
export const purchasesCp = (purchases: Purchase[] = []) => purchases.reduce((n, p) => n + Math.max(0, p.costCp), 0)

/** Copper pieces as gp, sp and cp, largest coins first. */
export function coinsFromCp(cp: number): Character['coins'] {
  const left = Math.max(0, Math.round(cp))
  return { gp: Math.floor(left / 100), sp: Math.floor((left % 100) / 10), cp: left % 10 }
}

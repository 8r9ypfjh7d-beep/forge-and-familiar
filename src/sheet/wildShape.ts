// Wild Shape: which beasts a druid can turn into (by the rules' limits) and the trimmed stat block
// the sheet keeps on the running effect. Pure; the beasts come from the SRD monster library.
import type { Monster } from '../content'
import type { BeastForm } from '../model/character'
import type { WildShapeLimit } from '../rules'

const speedOf = (m: Pick<Monster, 'speed'>) => m.speed

/** True when the beast is within the druid's limits: challenge rating, and no flying or swimming speed before they are allowed. */
export function beastAllowed(m: Pick<Monster, 'challengeRating' | 'speed'>, limit: WildShapeLimit): boolean {
  const s = speedOf(m)
  return m.challengeRating <= limit.maxCr && (limit.fly || !s.fly) && (limit.swim || !s.swim)
}

/** "40 ft., climb 30 ft." from the stat block's speeds. */
export function speedText(m: Pick<Monster, 'speed'>): string {
  return Object.entries(speedOf(m)).filter(([, v]) => typeof v === 'string').map(([k, v]) => (k === 'walk' ? v : `${k} ${v}`)).join(', ')
}

/** The beast as the sheet shows it while Wild Shape runs: AC, HP, speed and attacks. */
export function beastForm(m: Monster): BeastForm {
  return {
    name: m.name, ac: m.armorClass[0]?.value ?? 10, hp: m.hitPoints, speed: speedText(m),
    attacks: m.actions.filter(a => a.attackBonus !== undefined || a.damage.length).map(a => ({
      name: a.name,
      ...(a.attackBonus !== undefined ? { bonus: a.attackBonus } : {}),
      ...(a.damage[0] ? { damage: a.damage[0].dice, type: a.damage[0].type.toLowerCase() } : {}),
    })),
  }
}

/** "1/4", "1/2", "1", "2". */
export const crText = (cr: number) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr))

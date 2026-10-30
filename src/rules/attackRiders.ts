// Extra damage and crit range a character's features add to an attack (SRD 5.1, and SRD 5.2 level 7 strikes).
import type { Character } from '../model/character'
import { classChoices } from './choices'
import type { Attack } from './derive'

/** Damage a feature can add to one attack. The player turns it on: the engine can't know if they're raging. */
export interface DamageRider {
  id: 'rage' | 'sneakAttack' | 'divineStrike' | 'primalStrike'
  /** Feature name, e.g. "Rage". */
  name: string
  /** Notation added to the damage roll, e.g. "+2" or "3d6". */
  damage: string
  /** Sneak Attack: once per turn, and only with advantage or an ally next to the target. */
  oncePerTurn?: boolean
  /** The damage types the player picks from on each hit (Divine Strike: necrotic or radiant). */
  damageTypes?: string[]
}

type Riders = Pick<Character, 'classes'> & Partial<Pick<Character, 'rulesEdition' | 'featureChoices'>>

/** 2024 level 7 picks that add a die once per turn: Cleric Divine Strike, Druid Primal Strike. */
const STRIKES = [
  { classId: 'cleric', choice: 'blessedStrikes', option: 'divine-strike', id: 'divineStrike', name: 'Divine Strike', twoDiceAt: 14, damageTypes: ['necrotic', 'radiant'] },
  { classId: 'druid', choice: 'elementalFury', option: 'primal-strike', id: 'primalStrike', name: 'Primal Strike', twoDiceAt: 15, damageTypes: ['cold', 'fire', 'lightning', 'thunder'] },
] as const

const levelIn = (c: Pick<Character, 'classes'>, classId: string) =>
  c.classes.filter(cl => cl.classId === classId).reduce((n, cl) => n + cl.level, 0)

/**
 * Rage +2/+3/+4 on STR melee weapon attacks; Sneak Attack ⌈rogue level ÷ 2⌉d6 on finesse or ranged weapons;
 * 2024 Divine Strike and Primal Strike 1d8 (2d8 later) on any weapon hit.
 */
export function getDamageRiders(c: Riders, attack: Pick<Attack, 'ability' | 'properties'>): DamageRider[] {
  const props = attack.properties ?? []
  const out: DamageRider[] = []
  const barbarian = levelIn(c, 'barbarian')
  if (barbarian && attack.ability === 'str' && !props.includes('ranged')) {
    out.push({ id: 'rage', name: 'Rage', damage: `+${barbarian >= 16 ? 4 : barbarian >= 9 ? 3 : 2}` })
  }
  const rogue = levelIn(c, 'rogue')
  if (rogue && (props.includes('finesse') || props.includes('ranged'))) {
    out.push({ id: 'sneakAttack', name: 'Sneak Attack', damage: `${Math.ceil(rogue / 2)}d6`, oncePerTurn: true })
  }
  if (c.rulesEdition === '2024') {
    const picked = classChoices(c)
    for (const s of STRIKES) {
      if (!picked.some(x => x.classId === s.classId && x.choice.id === s.choice && x.picked?.id === s.option)) continue
      out.push({ id: s.id, name: s.name, damage: levelIn(c, s.classId) >= s.twoDiceAt ? '2d8' : '1d8', oncePerTurn: true, damageTypes: [...s.damageTypes] })
    }
  }
  return out
}

/** Lowest natural d20 that crits: Champion's Improved Critical (19) and Superior Critical (18). */
export function getCritRange(c: Pick<Character, 'classes'>): number {
  const champion = c.classes.find(cl => cl.classId === 'fighter' && cl.subclassId === 'champion')
  if (!champion) return 20
  return champion.level >= 15 ? 18 : champion.level >= 3 ? 19 : 20
}

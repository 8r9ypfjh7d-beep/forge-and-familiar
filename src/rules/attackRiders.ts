// Extra damage and crit range a character's features add to an attack (SRD 5.1).
import type { Character } from '../model/character'
import type { Attack } from './derive'

/** Damage a feature can add to one attack. The player turns it on: the engine can't know if they're raging. */
export interface DamageRider {
  id: 'rage' | 'sneakAttack'
  /** Feature name, e.g. "Rage". */
  name: string
  /** Notation added to the damage roll, e.g. "+2" or "3d6". */
  damage: string
  /** Sneak Attack: once per turn, and only with advantage or an ally next to the target. */
  oncePerTurn?: boolean
}

const levelIn = (c: Pick<Character, 'classes'>, classId: string) =>
  c.classes.filter(cl => cl.classId === classId).reduce((n, cl) => n + cl.level, 0)

/** Rage +2/+3/+4 on STR melee weapon attacks; Sneak Attack ⌈rogue level ÷ 2⌉d6 on finesse or ranged weapons. */
export function getDamageRiders(c: Pick<Character, 'classes'>, attack: Pick<Attack, 'ability' | 'properties'>): DamageRider[] {
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
  return out
}

/** Lowest natural d20 that crits: Champion's Improved Critical (19) and Superior Critical (18). */
export function getCritRange(c: Pick<Character, 'classes'>): number {
  const champion = c.classes.find(cl => cl.classId === 'fighter' && cl.subclassId === 'champion')
  if (!champion) return 20
  return champion.level >= 15 ? 18 : champion.level >= 3 ? 19 : 20
}

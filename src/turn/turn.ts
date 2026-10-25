// Per-turn economy: action, bonus action, reaction and movement. Pure; not saved on the character.
import type { Character } from '../model/character'
import type { ConditionId } from '../rules/types'

export type Slot = 'action' | 'bonus' | 'reaction'

export interface TurnState {
  round: number
  used: Record<Slot, boolean>
  /** Feet moved this turn. */
  moved: number
  /** Times Dash was taken this turn; each adds your speed again. */
  dashes: number
}

export const FRESH_TURN: TurnState = { round: 1, used: { action: false, bonus: false, reaction: false }, moved: 0, dashes: 0 }

/** Starts your next turn: everything comes back, including your reaction (SRD: it resets at the start of your turn). */
export function nextTurn(t: TurnState): TurnState {
  return { ...FRESH_TURN, round: t.round + 1 }
}

export function toggle(t: TurnState, slot: Slot): TurnState {
  return { ...t, used: { ...t.used, [slot]: !t.used[slot] } }
}

export function movementTotal(t: TurnState, speed: number): number {
  return speed * (1 + t.dashes)
}

/** Moves by delta feet (negative takes movement back), kept between 0 and the turn's total. */
export function move(t: TurnState, delta: number, speed: number): TurnState {
  const moved = Math.min(movementTotal(t, speed), Math.max(0, t.moved + delta))
  return moved === t.moved ? t : { ...t, moved }
}

export function dash(t: TurnState): TurnState {
  return { ...t, dashes: t.dashes + 1 }
}

const NO_ACTIONS: ConditionId[] = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']
const NO_MOVEMENT: ConditionId[] = ['grappled', 'restrained', ...NO_ACTIONS]

/** What the character's conditions (or being at 0 HP) forbid this turn, with the reason to show. */
export function limits(c: Character): { noActions?: ConditionId; noMovement?: ConditionId } {
  const conditions: ConditionId[] = c.state.currentHp === 0 ? [...c.state.conditions, 'unconscious'] : c.state.conditions
  const has = (list: ConditionId[]) => list.find(id => conditions.includes(id))
  return { noActions: has(NO_ACTIONS), noMovement: has(NO_MOVEMENT) }
}

/** SRD class feature names (English, for term()) that use a bonus action, as reminders. Reactions have their own card (src/reactions). */
export function bonusOptions(c: Character): string[] {
  const level = (id: string) => c.classes.find(cl => cl.classId === id)?.level ?? 0
  const bonus: string[] = []
  if (level('barbarian') >= 1) bonus.push('Rage')
  if (level('fighter') >= 1) bonus.push('Second Wind')
  if (level('monk') >= 1) bonus.push('Martial Arts')
  if (level('monk') >= 2) bonus.push('Flurry of Blows', 'Patient Defense', 'Step of the Wind')
  if (level('rogue') >= 2) bonus.push('Cunning Action')
  if (level('bard') >= 1) bonus.push('Bardic Inspiration')
  return bonus
}

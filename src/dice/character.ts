// Rolls driven by a character's derived stats. Read-only: callers apply results to CharacterState.
import type { HitDie } from '../model/character'
import { SKILLS } from '../rules/data/skills'
import type { Attack, DerivedStats } from '../rules/derive'
import { autoFailsSave, getRollMode, type RollKind as ConditionRollKind } from '../rules/rollMode'
import { ABILITY_NAMES, type Ability, type SkillId } from '../rules/types'
import { critNotation } from './notation'
import { roll, rollD20 } from './roll'
import type { RollMode, RollOptions, RollResult } from './types'

const SHORT: Record<Ability, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

/** Fills the default label and merges the character's condition mode with the situational one. */
function prepare(opts: RollOptions, label: string, kind: ConditionRollKind, ability?: Ability): RollOptions {
  const modes: RollMode[] = opts.mode === undefined ? [] : Array.isArray(opts.mode) ? opts.mode : [opts.mode]
  if (opts.character && !opts.ignoreConditions) modes.push(getRollMode(opts.character, kind, ability))
  return { ...opts, label: opts.label ?? label, mode: modes }
}

export function rollCheck(stats: DerivedStats, ability: Ability, opts: RollOptions = {}): RollResult {
  return rollD20(stats.mods[ability], prepare(opts, `${ABILITY_NAMES[ability]} check`, 'check', ability), 'check')
}

export function rollSave(stats: DerivedStats, ability: Ability, opts: RollOptions = {}): RollResult {
  const r = rollD20(stats.saves[ability].bonus, prepare(opts, `${SHORT[ability]} save`, 'save', ability), 'save')
  if (opts.character && !opts.ignoreConditions && autoFailsSave(opts.character, ability)) r.autoFail = true
  return r
}

export function rollSkill(stats: DerivedStats, skill: SkillId, opts: RollOptions = {}): RollResult {
  const { ability } = stats.skills[skill]
  return rollD20(stats.skills[skill].bonus, prepare(opts, SKILLS[skill].name, 'check', ability), 'skill')
}

/** Initiative is a DEX check, so check penalties apply. */
export function rollInitiative(stats: DerivedStats, opts: RollOptions = {}): RollResult {
  return rollD20(stats.initiative, prepare(opts, 'Initiative', 'check', 'dex'), 'initiative')
}

export function rollAttack(attack: Pick<Attack, 'name' | 'bonus'>, opts: RollOptions = {}): RollResult {
  return rollD20(attack.bonus, prepare(opts, `${attack.name} attack`, 'attack'), 'attack')
}

/** Damage for an attack. Pass crit (usually attackResult.d20.crit) to double the dice. */
export function rollDamage(
  attack: Pick<Attack, 'name' | 'damage' | 'damageType'>,
  opts: RollOptions & { crit?: boolean; versatile?: string } = {},
): RollResult {
  const base = opts.versatile ?? attack.damage
  const notation = opts.crit ? critNotation(base) : base
  const label = `${attack.name} ${attack.damageType}${opts.crit ? ' (crit)' : ''}`
  return roll(notation, { ...opts, label: opts.label ?? label }, 'damage')
}

/** One hit die on a short rest: die + CON, at least 0 HP regained (SRD). */
export function rollHitDie(die: HitDie, conMod: number, opts: RollOptions = {}): RollResult {
  const sign = conMod < 0 ? '-' : '+'
  const notation = conMod ? `1${die}${sign}${Math.abs(conMod)}` : `1${die}`
  const r = roll(notation, { ...opts, label: opts.label ?? `Hit die (${die})` }, 'hitDie')
  r.total = Math.max(0, r.total)
  return r
}

export type DeathSaveOutcome = 'success' | 'failure' | 'twoFailures' | 'regainOneHp'

/** Death saving throw: 10+ succeeds, a natural 1 counts twice, a natural 20 regains 1 HP (SRD). */
export function rollDeathSave(opts: RollOptions = {}): RollResult & { outcome: DeathSaveOutcome } {
  const r = rollD20(0, prepare(opts, 'Death save', 'save'), 'deathSave')
  const nat = r.d20!.natural
  const outcome: DeathSaveOutcome =
    nat === 20 ? 'regainOneHp' : nat === 1 ? 'twoFailures' : r.total >= 10 ? 'success' : 'failure'
  return { ...r, outcome }
}

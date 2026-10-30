// Rolls driven by a character's derived stats. Read-only: callers apply results to CharacterState.
import type { HitDie } from '../model/character'
import { SKILLS } from '../rules/data/skills'
import type { DamageRider } from '../rules/attackRiders'
import type { Attack, DerivedStats } from '../rules/derive'
import { autoFailsSave, getRollDice, getRollMode, type RollKind as ConditionRollKind } from '../rules/rollMode'
import { ABILITY_NAMES, type Ability, type SkillId } from '../rules/types'
import { critNotation } from './notation'
import { roll, rollD20, rollParts } from './roll'
import type { RollMode, RollOptions, RollResult } from './types'

const SHORT: Record<Ability, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

/** Fills the default label and merges the character's condition mode with the situational one. */
function prepare(opts: RollOptions, label: string, kind: ConditionRollKind, ability?: Ability, itemAdvantage?: boolean, lucky?: boolean): RollOptions {
  if (lucky && opts.lucky === undefined) opts = { ...opts, lucky }
  const modes: RollMode[] = opts.mode === undefined ? [] : Array.isArray(opts.mode) ? opts.mode : [opts.mode]
  if (opts.character && !opts.ignoreConditions) modes.push(getRollMode(opts.character, kind, ability))
  // Items that always give advantage (Boots of Elvenkind on Stealth); a disadvantage still cancels it out.
  if (itemAdvantage) modes.push('advantage')
  // Running spells that add dice to this kind of roll (Bless, Guidance).
  const extra = opts.character && !opts.ignoreConditions ? getRollDice(opts.character, kind) : []
  if (!extra.length) return { ...opts, label: opts.label ?? label, mode: modes }
  const base = opts.label ?? label
  return { ...opts, label: `${base} + ${extra.map(x => x.name).join(', ')}`, mode: modes, bonusDice: [...(opts.bonusDice ?? []), ...extra.map(x => x.dice)] }
}

export function rollCheck(stats: DerivedStats, ability: Ability, opts: RollOptions = {}): RollResult {
  return rollD20(stats.mods[ability], prepare(opts, `${ABILITY_NAMES[ability]} check`, 'check', ability, stats.checkAdvantage?.[ability], stats.lucky), 'check')
}

export function rollSave(stats: DerivedStats, ability: Ability, opts: RollOptions = {}): RollResult {
  const r = rollD20(stats.saves[ability].bonus, prepare(opts, `${SHORT[ability]} save`, 'save', ability, stats.saves[ability].advantage, stats.lucky), 'save')
  if (opts.character && !opts.ignoreConditions && autoFailsSave(opts.character, ability)) r.autoFail = true
  return r
}

export function rollSkill(stats: DerivedStats, skill: SkillId, opts: RollOptions = {}): RollResult {
  const { ability } = stats.skills[skill]
  return rollD20(stats.skills[skill].bonus, prepare(opts, SKILLS[skill].name, 'check', ability, stats.skills[skill].advantage, stats.lucky), 'skill')
}

/** Initiative is a DEX check, so check penalties apply. */
export function rollInitiative(stats: DerivedStats, opts: RollOptions = {}): RollResult {
  return rollD20(stats.initiative, prepare(opts, 'Initiative', 'check', 'dex', stats.initiativeAdvantage, stats.lucky), 'initiative')
}

/** critRange: lowest natural roll that crits (rules getCritRange, 19 for a Champion). */
export function rollAttack(attack: Pick<Attack, 'name' | 'bonus'>, opts: RollOptions & { critRange?: number } = {}): RollResult {
  const r = rollD20(attack.bonus, prepare(opts, `${attack.name} attack`, 'attack'), 'attack')
  if (opts.critRange && r.d20 && r.d20.natural >= opts.critRange) r.d20.crit = true
  return r
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

export interface AttackOutcome {
  attack: RollResult
  /** Missing on a natural 1, which always misses. */
  damage?: RollResult
}

/**
 * One tap: the attack roll, then its damage with every rider the player turned on.
 * A crit doubles all the damage dice (riders too); a natural 1 rolls no damage.
 */
export function rollAttackWithDamage(
  attack: Pick<Attack, 'name' | 'bonus' | 'damage' | 'damageType' | 'versatile'> & Partial<Pick<Attack, 'greatWeapon' | 'properties'>>,
  opts: RollOptions & { critRange?: number; twoHanded?: boolean; riders?: Pick<DamageRider, 'name' | 'damage'>[] } = {},
): AttackOutcome {
  const { label, riders = [], twoHanded, critRange, ...rest } = opts
  const hit = rollAttack(attack, { ...rest, critRange, label })
  if (hit.d20?.fumble) return { attack: hit }
  const base = twoHanded && attack.versatile ? attack.versatile : attack.damage
  // Great Weapon Fighting: the weapon's own dice only, two-handed weapons or a versatile one held in both hands.
  const gwf = attack.greatWeapon && (attack.properties?.includes('two-handed') || (twoHanded && attack.versatile)) ? attack.greatWeapon : undefined
  const crit = !!hit.d20?.crit
  const extras = riders.length ? ` + ${riders.map(r => r.name).join(', ')}` : ''
  const action = { id: hit.id, name: attack.name }
  hit.action = action
  const damage = rollParts(
    [{ notation: base, source: attack.name, ...(gwf ? { lowDice: gwf } : {}) }, ...riders.map(r => ({ notation: r.damage, source: r.name }))],
    { ...rest, label: `${attack.name} ${attack.damageType}${extras}${crit ? ' (crit)' : ''}` }, 'damage', crit,
  )
  damage.action = action
  damage.damageType = attack.damageType
  return { attack: hit, damage }
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

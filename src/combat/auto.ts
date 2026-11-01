// What the tracker does on its own (src/combat/ui/autoSettings.ts keeps the DM's switches). Pure:
// who a monster aims at, when a fight is over, what an attack gets from the target's conditions,
// which attacks a Multiattack makes, and a monster's save bonus.
import type { Monster, MonsterAction } from '../content'
import type { Ability, ConditionId } from '../rules/types'
import { abilityMod } from '../rules'
import { isDefeated, statusOf, type Party } from './engine'
import type { Combatant, Encounter } from './types'

/** The DM's switches. Each one has a manual way that stays available. */
export interface AutoSettings {
  /** A monster's hit lands on its target at once (a miss waits for "Apply anyway"); a save action rolls a monster target's save. */
  applyHits: boolean
  /** Monsters and NPCs roll their own concentration and repeat saves; party members still get the card. */
  monsterSaves: boolean
  /** A dying party member on this device rolls their death save when their turn starts. */
  deathSaves: boolean
  /** Combat ends when the last enemy drops, with the XP card. */
  endWhenWon: boolean
}

export const DEFAULT_AUTO: AutoSettings = { applyHits: true, monsterSaves: true, deathSaves: true, endWhenWon: true }

/** HP of any row: the character for a party member, the row (or its NPC sheet) for a monster. */
export type HpOf = (c: Combatant) => number

export const rowHp = (enc: Encounter, party: Party): HpOf => c => statusOf(enc, c, party).hp

/** A party member who is out of the fight for good (three failed death saves). */
export const isDeadPc = (c: Combatant, party: Party) => {
  const ch = c.kind === 'pc' && c.characterId ? party[c.characterId] : undefined
  return !!ch && ch.state.deathSaves.failures >= 3
}

/** Still a valid target: monsters above 0 HP, party members not dead (a dying one can still be hit). */
export const standing = (c: Combatant, party: Party, hp: HpOf) => (c.kind === 'npc' ? hp(c) > 0 : !isDeadPc(c, party))

/**
 * The target a monster's stat block opens with: its last pick while that one still stands, else the
 * first conscious enemy in turn order, else any enemy still in the fight.
 */
export function pickTarget(enc: Encounter, attackerId: string, party: Party, last?: string, hp: HpOf = rowHp(enc, party)): string {
  const me = enc.combatants.find(c => c.id === attackerId)
  const others = enc.combatants.filter(c => c.id !== attackerId)
  const kept = others.find(c => c.id === last)
  if (kept && standing(kept, party, hp)) return kept.id
  const enemies = others.filter(c => c.kind !== me?.kind && !c.hidden)
  return (enemies.find(c => hp(c) > 0) ?? enemies.find(c => standing(c, party, hp)))?.id ?? ''
}

/**
 * 'won' when every monster is down and a party member still stands; 'lost' when every party member is at
 * 0 HP while a monster still stands. Null otherwise, or when one side has no rows at all.
 */
export function fightOutcome(enc: Encounter, hp: HpOf): 'won' | 'lost' | null {
  const foes = enc.combatants.filter(c => c.kind === 'npc')
  const pcs = enc.combatants.filter(c => c.kind === 'pc')
  if (!foes.length || !pcs.length) return null
  const foesUp = foes.some(c => hp(c) > 0)
  const pcsUp = pcs.some(c => hp(c) > 0)
  if (!foesUp && pcsUp) return 'won'
  if (foesUp && !pcsUp) return 'lost'
  return null
}

/** Monsters left standing, for the "1 enemy left" line. */
export const foesLeft = (enc: Encounter) => enc.combatants.filter(c => c.kind === 'npc' && !isDefeated(c)).length

/** "Melee Weapon Attack", "Melee Attack Roll", "Melee or Ranged…" all count as melee. */
export const isMelee = (a: Pick<MonsterAction, 'description'>) => /\bmelee\b/i.test(a.description)

/**
 * What the target's conditions give an attack (SRD Appendix A): advantage against a blinded, paralyzed,
 * petrified, restrained, stunned or unconscious target, and against a prone one in melee (disadvantage at range);
 * disadvantage against an invisible one. A melee hit on a paralyzed or unconscious target is a critical hit.
 */
export function attackAgainst(conditions: ConditionId[], melee: boolean): { mode: ('advantage' | 'disadvantage')[]; autoCrit: boolean } {
  const has = (x: ConditionId) => conditions.includes(x)
  const mode: ('advantage' | 'disadvantage')[] = []
  if ((['blinded', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious'] as ConditionId[]).some(has)) mode.push('advantage')
  if (has('prone')) mode.push(melee ? 'advantage' : 'disadvantage')
  if (has('invisible')) mode.push('disadvantage')
  return { mode, autoCrit: melee && (has('paralyzed') || has('unconscious')) }
}

/** A party member at 0 HP is unconscious (SRD) even though the sheet does not store the condition. */
export function targetConditions(enc: Encounter, c: Combatant, party: Party): ConditionId[] {
  const s = statusOf(enc, c, party)
  return c.kind === 'pc' && s.hp <= 0 && !s.conditions.includes('unconscious') ? [...s.conditions, 'unconscious'] : s.conditions
}

/** Saves a creature fails on its own: STR and DEX while paralyzed, stunned, unconscious or petrified. */
export const autoFails = (conditions: ConditionId[], ability: Ability) =>
  (ability === 'str' || ability === 'dex') && conditions.some(x => x === 'paralyzed' || x === 'stunned' || x === 'unconscious' || x === 'petrified')

/** A stat block's save bonus: its listed proficient save, else the ability modifier. */
export const monsterSave = (m: Pick<Monster, 'abilities' | 'savingThrows'>, ability: Ability) =>
  m.savingThrows[ability] ?? abilityMod(m.abilities[ability])

const NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }
const stem = (s: string) => s.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim().replace(/(es|s)$/, '')
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The attacks a Multiattack makes, read from its text: "makes two Claw attacks", "three attacks: one with its
 * bite and two with its claws", "one Bite attack, two Devilish Claw attacks". Only the first choice counts
 * ("two scimitar attacks or two longbow attacks" → 2 × Scimitar). Null when the text names no attack it can roll.
 */
export function multiattackPlan(m: Pick<Monster, 'actions'>): string[] | null {
  const multi = m.actions.find(a => /^multiattack/i.test(a.name))
  if (!multi) return null
  let text = ` ${multi.description.toLowerCase()} `
  // Only the first choice, and nothing about replacing an attack.
  text = text.split(/\bit can replace\b|\binstead\b|\balternatively\b|\bonly one of\b/)[0]
  text = text.replace(/\battacks? or (one|two|three|four|five|six)\b.*$/, 'attacks ')
  const attacks = m.actions.filter(a => a !== multi && a.attackBonus != null)
    .sort((a, b) => stem(b.name).length - stem(a.name).length)
  const out: string[] = []
  for (const a of attacks) {
    const s = stem(a.name)
    if (!s) continue
    const n = `(${Object.keys(NUMBERS).join('|')})`
    const re = new RegExp(`\\b${n}\\s+(?:(?:attacks?\\s+)?with\\s+(?:its|their|a|an)\\s+|${'(?:[a-z]+\\s+)?'})?${escape(s)}(?:e?s)?\\b`, 'g')
    let match: RegExpExecArray | null
    while ((match = re.exec(text))) {
      // "one with its bite" or "two claw attacks"; a word in between must not be another attack's name.
      const count = NUMBERS[match[1]]
      for (let i = 0; i < count; i++) out.push(a.name)
      text = text.slice(0, match.index) + ' '.repeat(match[0].length) + text.slice(match.index + match[0].length)
      re.lastIndex = 0
    }
  }
  if (!out.length) {
    // "makes two melee attacks", "three attacks, using Shortsword or Light Crossbow in any combination": n of the
    // first attack the text names, or of its only (melee) attack.
    const count = new RegExp(`makes (${Object.keys(NUMBERS).join('|')})\\b`).exec(text)
    if (!count || /\bonly one of\b/.test(multi.description.toLowerCase())) return null
    const melee = attacks.filter(isMelee)
    const named = attacks.map(a => ({ a, at: text.indexOf(stem(a.name)) })).filter(x => x.at >= 0).sort((x, y) => x.at - y.at)[0]?.a
    const pick = named ?? (/\bmelee\b/.test(text) && melee.length === 1 ? melee[0] : attacks.length === 1 ? attacks[0] : undefined)
    return pick ? Array.from({ length: NUMBERS[count[1]] }, () => pick.name) : null
  }
  // Keep the order the text names them in.
  const original = ` ${multi.description.toLowerCase()} `
  return out.sort((x, y) => original.indexOf(stem(x)) - original.indexOf(stem(y)))
}

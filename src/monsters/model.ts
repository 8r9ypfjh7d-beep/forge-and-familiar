// Pure monster stat-block helpers shared by the homebrew monster editor and the NPC sheet creator:
// the editable block type, the SRD tables (CR → XP and proficiency, hit die by size), the editor's
// validation, and the sanitizer every imported block goes through. No React, no storage, no randomness.
import type { Ability, Monster, MonsterAction, Size } from '../content/types'
import { monsterMod } from './block'
import { ABILITIES } from '../rules/types'
import { ALL_SKILLS, SKILLS } from '../rules/data/skills'
import { DAMAGE_TYPES } from '../rules/damage'
import { CONDITIONS } from '../rules/itemEffects'
import { parseNotation } from '../dice/notation'

/** A stat block without its library stamp (source, edition). Homebrew monsters and NPC tweaks edit this. */
export type MonsterBlock = Omit<Monster, 'source' | 'edition'>

export const MONSTER_SIZES: Size[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

export const MONSTER_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
] as const

export const ALIGNMENTS = [
  'lawful good', 'neutral good', 'chaotic good', 'lawful neutral', 'neutral', 'chaotic neutral', 'lawful evil', 'neutral evil', 'chaotic evil',
  'unaligned', 'any alignment', 'any non-good alignment', 'any evil alignment',
] as const

export const SPEED_KINDS = ['walk', 'fly', 'swim', 'climb', 'burrow'] as const
export type SpeedKind = (typeof SPEED_KINDS)[number]

export const SENSE_KINDS = ['darkvision', 'blindsight', 'tremorsense', 'truesight'] as const
export type SenseKind = (typeof SENSE_KINDS)[number]

export const AC_TYPES = ['natural armor', 'leather armor', 'studded leather', 'hide armor', 'chain shirt', 'scale mail', 'breastplate', 'half plate', 'chain mail', 'splint', 'plate', 'shield', 'mage armor'] as const

export const ACTION_GROUPS = ['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions'] as const
export type ActionGroup = (typeof ACTION_GROUPS)[number]

export { DAMAGE_TYPES, CONDITIONS as CONDITION_IDS, ALL_SKILLS as SKILL_IDS, SKILLS }

/** Challenge ratings in book order. */
export const CR_STEPS = [0, 0.125, 0.25, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)]

/** SRD "Experience Points by Challenge Rating". CR 0 is 10 XP (0 for creatures with no attacks, left to the DM). */
export const XP_BY_CR: Record<number, number> = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000,
  23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
}

export const xpForCr = (cr: number) => XP_BY_CR[cr] ?? 0

/** SRD proficiency bonus by CR: +2 up to CR 4, then +1 every four CRs. */
export const proficiencyForCr = (cr: number) => (cr < 5 ? 2 : 2 + Math.floor((Math.ceil(cr) - 1) / 4))

const abilityMod = monsterMod

/** Hit die by size: d4 Tiny … d20 Gargantuan. */
export const hitDieForSize = (size: Size) => ({ Tiny: 4, Small: 6, Medium: 8, Large: 10, Huge: 12, Gargantuan: 20 })[size]

/** Average of a dice expression (2d8+4 → 13), floored like stat blocks print it; 0 for text that isn't dice. */
export function averageOf(dice: string): number {
  try {
    const terms = parseNotation(dice)
    let total = 0
    for (const term of terms) {
      if (term.kind === 'dice') total += term.sign * term.count * ((term.sides + 1) / 2)
      else total += term.sign * term.value
    }
    return Math.max(0, Math.floor(total))
  } catch {
    return 0
  }
}

export function isDice(s: string): boolean {
  try {
    return parseNotation(s).some(t => t.kind === 'dice')
  } catch {
    return false
  }
}

/** The HP line for `count` hit dice of a size with a CON score: "5d8+10" (or "5d8-5"). */
export function hitPointsRollFor(count: number, size: Size, con: number): string {
  const die = hitDieForSize(size)
  const bonus = abilityMod(con) * count
  return bonus === 0 ? `${count}d${die}` : `${count}d${die}${bonus > 0 ? '+' : ''}${bonus}`
}

/** A save bonus with proficiency: ability modifier plus the CR's proficiency bonus. */
export const proficientSave = (m: Pick<MonsterBlock, 'abilities' | 'proficiencyBonus'>, a: Ability) => abilityMod(m.abilities[a]) + m.proficiencyBonus

/** A skill bonus with proficiency (or expertise). */
export const proficientSkill = (m: Pick<MonsterBlock, 'abilities' | 'proficiencyBonus'>, skill: string, expertise = false) => {
  const ability = SKILLS[skill as keyof typeof SKILLS]?.ability ?? 'wis'
  return abilityMod(m.abilities[ability]) + m.proficiencyBonus * (expertise ? 2 : 1)
}

/** Passive Perception worked out from the skills line (or plain WIS), ignoring any typed value. */
export const perceptionFromSkills = (m: Pick<MonsterBlock, 'abilities' | 'skills'>) => 10 + (m.skills.perception ?? abilityMod(m.abilities.wis))

export const blankAction = (): MonsterAction => ({ name: '', description: '', damage: [] })

/** A new, playable Medium humanoid at CR 1/4 with average stats. */
export function blankMonster(): MonsterBlock {
  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  return {
    id: '',
    name: '',
    sizes: ['Medium'],
    type: 'humanoid',
    alignment: 'unaligned',
    armorClass: [{ value: 10 }],
    hitPoints: 9,
    hitDice: '2d8',
    hitPointsRoll: '2d8',
    speed: { walk: '30 ft.' },
    abilities,
    savingThrows: {},
    skills: {},
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    senses: { passive_perception: 10 },
    languages: 'Common',
    challengeRating: 0.25,
    xp: 50,
    proficiencyBonus: 2,
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    forms: [],
  }
}

/** What stops the editor saving. English like the other homebrew validators (they are developer-facing hints the form shows). */
export function monsterIssues(m: MonsterBlock): string[] {
  const out: string[] = []
  if (!m.name.trim()) out.push('Give the monster a name.')
  if (!m.sizes.length) out.push('Pick at least one size.')
  if (!m.type.trim()) out.push('Pick a creature type.')
  if (!m.armorClass.length || m.armorClass.some(a => !(a.value >= 0 && a.value <= 40))) out.push('Armor class must be between 0 and 40.')
  if (!(m.hitPoints >= 1)) out.push('Hit points must be at least 1.')
  if (m.hitPointsRoll && !isDice(m.hitPointsRoll)) out.push(`Hit dice "${m.hitPointsRoll}" are not dice notation like 5d8+10.`)
  if (!Object.values(m.speed).some(v => typeof v === 'string' && v.trim())) out.push('Give it at least one speed (0 ft. counts).')
  const groups: ActionGroup[] = ['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']
  for (const g of groups) {
    for (const a of m[g] ?? []) {
      if (!a.name.trim()) out.push('Every trait and action needs a name.')
      for (const d of [...a.damage, ...(a.damageChoice ?? [])]) if (!isDice(d.dice)) out.push(`Damage "${d.dice}" (${a.name || 'action'}) is not dice notation like 2d6+3.`)
      if (a.usage?.type === 'recharge' && !isDice(a.usage.dice)) out.push(`Recharge "${a.usage.dice}" (${a.name || 'action'}) needs dice like 1d6.`)
    }
  }
  if (m.legendary && m.legendary.actions > 0 && !m.legendaryActions.length) out.push('A legendary creature needs at least one legendary action.')
  if (m.spellcasting && !m.spellcasting.groups.some(g => g.spells.some(s => s.trim()))) out.push('List at least one spell, or remove spellcasting.')
  return [...new Set(out)]
}

// ---------- Sanitizing ----------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.slice(0, max).trim() : '')
const optStr = (v: unknown, max = 120) => str(v, max) || undefined
const int = (v: unknown, lo: number, hi: number, fallback = lo) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback
const num = (v: unknown, lo: number, hi: number, fallback = lo) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback
const textList = (v: unknown, max = 20, len = 80) => [...new Set(list(v).map(x => str(x, len)).filter(Boolean))].slice(0, max)
const cleanDice = (v: unknown, fallback = '1d6') => {
  const s = str(v, 40)
  return isDice(s) ? s : fallback
}

export const LIMITS = { name: 80, text: 4000, actions: 40, lines: 12 }

function cleanDamage(v: unknown): { dice: string; type: string }[] {
  return list(v).filter(isObj).map(d => ({ dice: cleanDice(d.dice), type: str(d.type, 40) || 'bludgeoning' })).slice(0, LIMITS.lines)
}

export function sanitizeMonsterAction(v: unknown): MonsterAction | undefined {
  if (!isObj(v)) return undefined
  const a: MonsterAction = {
    name: str(v.name, LIMITS.name) || 'Action',
    description: str(v.description, LIMITS.text),
    damage: cleanDamage(v.damage),
  }
  if (typeof v.attackBonus === 'number') a.attackBonus = int(v.attackBonus, -10, 40, 0)
  const choice = cleanDamage(v.damageChoice)
  if (choice.length) a.damageChoice = choice
  if (isObj(v.save) && ABILITIES.includes(v.save.ability as Ability)) {
    a.save = { ability: v.save.ability as Ability, dc: int(v.save.dc, 1, 40, 10), onSuccess: str(v.save.onSuccess, 200) || 'none' }
  }
  if (isObj(v.usage)) {
    const u = v.usage
    if (u.type === 'per day') a.usage = { type: 'per day', times: int(u.times, 1, 20, 1), ...(typeof u.timesInLair === 'number' ? { timesInLair: int(u.timesInLair, 1, 20, 1) } : {}) }
    else if (u.type === 'recharge') a.usage = { type: 'recharge', dice: cleanDice(u.dice, '1d6'), minimum: int(u.minimum, 1, 20, 5) }
    else if (u.type === 'per rest') a.usage = { type: 'per rest', rests: textList(u.rests, 3, 20) }
  }
  return a
}

const cleanActions = (v: unknown) => list(v).flatMap(a => sanitizeMonsterAction(a) ?? []).slice(0, LIMITS.actions)

/**
 * Rebuilds a stat block from unknown JSON (a shared pack, an imported NPC). Every field is read on its
 * own, numbers clamped, dice checked, unknown keys dropped. The caller decides the id (homebrew packs
 * namespace it) and passes it in.
 */
export function sanitizeMonsterBlock(raw: unknown, id: string): MonsterBlock {
  const v: Obj = isObj(raw) ? raw : {}
  const name = str(v.name, LIMITS.name) || 'Unnamed monster'
  const sizes = [...new Set(list(v.sizes).filter((s): s is Size => MONSTER_SIZES.includes(s as Size)))]
  const abilities = blankMonster().abilities
  if (isObj(v.abilities)) for (const a of ABILITIES) abilities[a] = int(v.abilities[a], 1, 30, 10)
  const savingThrows: Partial<Record<Ability, number>> = {}
  if (isObj(v.savingThrows)) for (const a of ABILITIES) if (typeof v.savingThrows[a] === 'number') savingThrows[a] = int(v.savingThrows[a], -10, 40, 0)
  const skills: Record<string, number> = {}
  if (isObj(v.skills)) for (const s of ALL_SKILLS) if (typeof v.skills[s] === 'number') skills[s] = int(v.skills[s], -10, 40, 0)
  const speed: MonsterBlock['speed'] = {}
  if (isObj(v.speed)) {
    for (const k of SPEED_KINDS) if (typeof v.speed[k] === 'string' && str(v.speed[k], 20)) speed[k] = str(v.speed[k], 20)
    if (v.speed.hover === true) speed.hover = true
  }
  if (!Object.keys(speed).length) speed.walk = '30 ft.'
  const senses: MonsterBlock['senses'] = {}
  if (isObj(v.senses)) {
    for (const k of SENSE_KINDS) if (typeof v.senses[k] === 'string' && str(v.senses[k], 40)) senses[k] = str(v.senses[k], 40)
    if (typeof v.senses.passive_perception === 'number') senses.passive_perception = int(v.senses.passive_perception, 0, 40, 10)
  }
  const cr = CR_STEPS.includes(num(v.challengeRating, 0, 30, 0)) ? num(v.challengeRating, 0, 30, 0) : 0
  const ac = list(v.armorClass).filter(isObj).map(a => ({
    value: int(a.value, 0, 40, 10),
    ...(optStr(a.type, 60) ? { type: optStr(a.type, 60) } : {}),
    ...(optStr(a.note, 200) ? { note: optStr(a.note, 200) } : {}),
  })).slice(0, 4)
  const hitPointsRoll = cleanDice(v.hitPointsRoll, '')
  const out: MonsterBlock = {
    id,
    name,
    sizes: sizes.length ? sizes : ['Medium'],
    type: str(v.type, 40).toLowerCase() || 'humanoid',
    ...(optStr(v.subtype, 60) ? { subtype: optStr(v.subtype, 60) } : {}),
    alignment: str(v.alignment, 40) || 'unaligned',
    armorClass: ac.length ? ac : [{ value: 10 }],
    hitPoints: int(v.hitPoints, 1, 2000, hitPointsRoll ? Math.max(1, averageOf(hitPointsRoll)) : 1),
    hitDice: str(v.hitDice, 20) || hitPointsRoll.replace(/[+-].*$/, ''),
    hitPointsRoll,
    speed,
    abilities,
    savingThrows,
    skills,
    damageVulnerabilities: textList(v.damageVulnerabilities),
    damageResistances: textList(v.damageResistances),
    damageImmunities: textList(v.damageImmunities),
    conditionImmunities: textList(v.conditionImmunities),
    senses,
    languages: str(v.languages, 200),
    challengeRating: cr,
    xp: int(v.xp, 0, 1000000, xpForCr(cr)),
    ...(typeof v.xpInLair === 'number' ? { xpInLair: int(v.xpInLair, 0, 1000000, 0) } : {}),
    proficiencyBonus: int(v.proficiencyBonus, 2, 9, proficiencyForCr(cr)),
    traits: cleanActions(v.traits),
    actions: cleanActions(v.actions),
    bonusActions: cleanActions(v.bonusActions),
    reactions: cleanActions(v.reactions),
    legendaryActions: cleanActions(v.legendaryActions),
    forms: list(v.forms).filter(isObj).map(f => ({ id: str(f.id, 120), name: str(f.name, LIMITS.name) })).filter(f => f.id && f.name).slice(0, 6),
    ...(optStr(v.description, LIMITS.text) ? { description: optStr(v.description, LIMITS.text) } : {}),
  }
  const lair = cleanActions(v.lairActions)
  if (lair.length) out.lairActions = lair
  if (isObj(v.legendary) && int(v.legendary.actions, 0, 10, 0) > 0) {
    out.legendary = {
      actions: int(v.legendary.actions, 1, 10, 3),
      ...(typeof v.legendary.resistance === 'number' ? { resistance: int(v.legendary.resistance, 0, 10, 3) } : {}),
      ...(optStr(v.legendary.description, LIMITS.text) ? { description: optStr(v.legendary.description, LIMITS.text) } : {}),
    }
  }
  if (isObj(v.spellcasting) && ABILITIES.includes(v.spellcasting.ability as Ability)) {
    const sc = v.spellcasting
    const groups = list(sc.groups).filter(isObj).map(g => ({ label: str(g.label, 60) || 'Spells', spells: textList(g.spells, 30, 80) })).filter(g => g.spells.length).slice(0, 12)
    if (groups.length) {
      out.spellcasting = {
        ability: sc.ability as Ability,
        ...(typeof sc.saveDc === 'number' ? { saveDc: int(sc.saveDc, 1, 40, 10) } : {}),
        ...(typeof sc.attackBonus === 'number' ? { attackBonus: int(sc.attackBonus, -10, 40, 0) } : {}),
        groups,
        ...(optStr(sc.note, 200) ? { note: optStr(sc.note, 200) } : {}),
      }
    }
  }
  return out
}

/** Stamps a block as a library `Monster` of a source. Homebrew packs use source `hb:<packId>`. */
export function toLibraryMonster(m: MonsterBlock, source: string, edition: Monster['edition'] = '2014'): Monster {
  return { ...m, source, edition }
}

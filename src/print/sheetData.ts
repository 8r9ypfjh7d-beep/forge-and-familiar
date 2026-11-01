// Everything the printable sheet shows, flattened from a Character and derive(). Pure, no React.
// Values stay ids and numbers; PrintSheet.tsx turns them into words in the reader's language.
import type { Character } from '../model/character'
import {
  ABILITIES, ALL_SKILLS, SKILLS, entryItem, getBackground, derive, formatMod,
  type Ability, type ConditionId, type DerivedStats, type SkillId,
} from '../rules'

type HitDie = DerivedStats['hitDice'][number]['die']

export interface PrintOptions {
  /** Fill in current HP, used slots and resources. Off prints blank boxes for pencil play. */
  withPlayState: boolean
}

export interface Pips {
  /** Resource id for a class resource, missing for the player's own trackers. */
  id?: string
  label: string
  max: number
  used: number
  recharge?: 'short' | 'long' | 'dawn'
}

export interface SlotRow {
  /** Spell level, 1-9 (a pact slot's level for pact slots). */
  level: number
  max: number
  used: number
  pact?: boolean
}

export interface PrintSheet {
  name: string
  playerName: string
  classes: { classId: string; level: number }[]
  level: number
  raceId: string
  subraceId?: string
  edition?: '2024'
  background: { id: string; name: string }
  alignment: string
  xp: number
  portrait?: string
  abilities: { id: Ability; score: number; mod: string }[]
  saves: { id: Ability; bonus: string; proficient: boolean }[]
  skills: { id: SkillId; ability: Ability; bonus: string; proficient: boolean; expertise: boolean }[]
  proficiencyBonus: string
  passivePerception: number
  armorClass: number
  armorSource: string
  initiative: string
  speed: number
  maxHp: number
  currentHp?: number
  tempHp?: number
  hitDice: { die: HitDie; total: number; spent: number }[]
  deathSaves: { successes: number; failures: number }
  spellSlots: SlotRow[]
  resources: Pips[]
  attacks: { name: string; bonus: string; damage: string; damageType: string; versatile?: string; range?: string; extraDamage?: string }[]
  equipment: { itemId: string; name: string; qty: number; equipped: boolean; weight: number }[]
  coins: { cp: number; sp: number; gp: number }
  carriedWeight: number
  carryingCapacity: number
  resistances: string[]
  immunities: string[]
  conditionImmunities: ConditionId[]
  conditions: ConditionId[]
  warnings: string[]
  notes: string
}

const round = (n: number) => Math.round(n * 100) / 100

export function buildPrintSheet(c: Character, opts: PrintOptions, d: DerivedStats = derive(c)): PrintSheet {
  const play = opts.withPlayState

  const spellSlots: SlotRow[] = d.spellSlots.slots.flatMap((max, i) =>
    max > 0 ? [{ level: i + 1, max, used: play ? (c.state.spellSlotsUsed[i] ?? 0) : 0 }] : [],
  )
  const pact = d.spellSlots.pact
  if (pact) spellSlots.push({ level: pact.level, max: pact.count, used: play ? c.state.pactSlotsUsed : 0, pact: true })

  const resources: Pips[] = [
    ...d.resources.map(r => ({ id: r.id, label: r.label, max: r.max, used: play ? (c.state.resources[r.id]?.used ?? 0) : 0, recharge: r.recharge === 'none' ? undefined : r.recharge })),
    ...(c.state.counters ?? []).map(k => ({
      label: k.label, max: k.max, used: play ? k.used : 0, recharge: k.recharge === 'none' ? undefined : k.recharge,
    })),
  ]

  return {
    name: c.name,
    playerName: c.playerName,
    classes: c.classes.map(cl => ({ classId: cl.classId, level: cl.level })),
    level: d.level,
    raceId: c.raceId,
    subraceId: c.subraceId,
    edition: c.rulesEdition,
    background: { id: getBackground(c)?.id ?? c.backgroundId, name: getBackground(c)?.name ?? c.backgroundId },
    alignment: c.alignment,
    xp: c.xp,
    portrait: c.portrait,
    abilities: ABILITIES.map(a => ({ id: a, score: d.abilities[a], mod: formatMod(d.mods[a]) })),
    saves: ABILITIES.map(a => ({ id: a, bonus: formatMod(d.saves[a].bonus), proficient: d.saves[a].proficient })),
    skills: ALL_SKILLS.map(s => ({
      id: s, ability: d.skills[s].ability ?? SKILLS[s].ability, bonus: formatMod(d.skills[s].bonus), proficient: d.skills[s].proficient, expertise: !!d.skills[s].expertise,
    })),
    proficiencyBonus: formatMod(d.proficiencyBonus),
    passivePerception: d.passivePerception,
    armorClass: d.armorClass.value,
    armorSource: d.armorClass.source,
    initiative: formatMod(d.initiative),
    speed: d.speed,
    maxHp: d.maxHp,
    currentHp: play ? c.state.currentHp : undefined,
    tempHp: play && c.state.tempHp > 0 ? c.state.tempHp : undefined,
    hitDice: d.hitDice.map(h => ({ die: h.die, total: h.total, spent: play ? (c.state.hitDiceSpent[h.die] ?? 0) : 0 })),
    deathSaves: play ? { ...c.state.deathSaves } : { successes: 0, failures: 0 },
    spellSlots,
    resources,
    attacks: d.attacks.map(a => ({
      name: a.name, bonus: formatMod(a.bonus), damage: a.damage, damageType: a.damageType,
      ...(a.versatile ? { versatile: a.versatile } : {}), ...(a.range ? { range: a.range } : {}), ...(a.extraDamage ? { extraDamage: a.extraDamage } : {}),
    })),
    equipment: c.inventory.map(e => {
      const item = entryItem(e)
      return { itemId: e.itemId, name: item?.name ?? e.itemId, qty: e.qty, equipped: e.equipped, weight: round((item?.weight ?? 0) * e.qty) }
    }),
    coins: c.coins,
    carriedWeight: round(d.carriedWeight),
    carryingCapacity: d.carryingCapacity,
    resistances: d.defenses.resistances,
    immunities: d.defenses.immunities,
    conditionImmunities: d.defenses.conditionImmunities,
    conditions: play ? c.state.conditions : [],
    warnings: d.warnings,
    notes: c.notes,
  }
}

// Everything the printable sheet shows, flattened from a Character and derive(). Pure, no React.
import type { Character } from '../model/character'
import {
  ABILITIES, ABILITY_NAMES, ALL_SKILLS, SKILLS, getBackground, classById, derive, formatMod, itemById, raceById,
  type Ability,
} from '../rules'

export interface PrintOptions {
  /** Fill in current HP, used slots and resources. Off prints blank boxes for pencil play. */
  withPlayState: boolean
}

export interface Pips {
  label: string
  max: number
  used: number
  note?: string
}

export interface PrintSheet {
  name: string
  playerName: string
  classLine: string
  level: number
  race: string
  background: string
  alignment: string
  xp: number
  portrait?: string
  abilities: { id: Ability; name: string; score: number; mod: string }[]
  saves: { name: string; bonus: string; proficient: boolean }[]
  skills: { name: string; ability: string; bonus: string; proficient: boolean }[]
  proficiencyBonus: string
  passivePerception: number
  armorClass: number
  armorSource: string
  initiative: string
  speed: number
  maxHp: number
  currentHp?: number
  tempHp?: number
  hitDice: string
  spellcasting?: { ability: string; saveDc: number; attackBonus: string }
  spellSlots: Pips[]
  resources: Pips[]
  attacks: { name: string; bonus: string; damage: string; notes: string }[]
  equipment: { name: string; qty: number; equipped: boolean }[]
  coins: { cp: number; sp: number; gp: number }
  carried: string
  features: string[]
  traits: string[]
  languages: string[]
  conditions: string[]
  exhaustion: number
  warnings: string[]
  notes: string
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function buildPrintSheet(c: Character, opts: PrintOptions): PrintSheet {
  const d = derive(c)
  const play = opts.withPlayState
  const race = raceById(c.raceId)
  const subrace = race?.subraces?.find(s => s.id === c.subraceId)

  const spellSlots: Pips[] = d.spellSlots.slots.flatMap((max, i) =>
    max > 0 ? [{ label: ORDINAL[i], max, used: play ? (c.state.spellSlotsUsed[i] ?? 0) : 0 }] : [],
  )
  const pact = d.spellSlots.pact
  if (pact) {
    spellSlots.push({ label: `Pact (${ORDINAL[pact.level - 1]})`, max: pact.count, used: play ? c.state.pactSlotsUsed : 0, note: 'short rest' })
  }

  const resources: Pips[] = [
    ...d.resources.map(r => ({
      label: r.label, max: r.max, used: play ? (c.state.resources[r.id]?.used ?? 0) : 0, note: `${r.recharge} rest`,
    })),
    ...(c.state.counters ?? []).map(k => ({
      label: k.label, max: k.max, used: play ? k.used : 0, note: k.recharge === 'none' ? undefined : `${k.recharge} rest`,
    })),
  ]

  return {
    name: c.name,
    playerName: c.playerName,
    classLine: c.classes.map(cl => `${classById(cl.classId)?.name ?? cl.classId} ${cl.level}`).join(' / '),
    level: d.level,
    race: subrace?.name ?? race?.name ?? c.raceId,
    background: getBackground(c)?.name ?? c.backgroundId,
    alignment: c.alignment,
    xp: c.xp,
    portrait: c.portrait,
    abilities: ABILITIES.map(a => ({ id: a, name: ABILITY_NAMES[a], score: d.abilities[a], mod: formatMod(d.mods[a]) })),
    saves: ABILITIES.map(a => ({ name: ABILITY_NAMES[a], bonus: formatMod(d.saves[a].bonus), proficient: d.saves[a].proficient })),
    skills: ALL_SKILLS.map(s => ({
      name: SKILLS[s].name, ability: SKILLS[s].ability.toUpperCase(), bonus: formatMod(d.skills[s].bonus), proficient: d.skills[s].proficient,
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
    hitDice: d.hitDice.map(h => `${h.total}${h.die}`).join(' + '),
    spellcasting: d.spellcasting && {
      ability: ABILITY_NAMES[d.spellcasting.ability],
      saveDc: d.spellcasting.saveDc,
      attackBonus: formatMod(d.spellcasting.attackBonus),
    },
    spellSlots,
    resources,
    attacks: d.attacks.map(a => ({
      name: a.name, bonus: formatMod(a.bonus), damage: `${a.damage} ${a.damageType}`, notes: a.notes.join(', '),
    })),
    equipment: c.inventory.map(e => ({ name: itemById(e.itemId)?.name ?? e.itemId, qty: e.qty, equipped: e.equipped })),
    coins: c.coins,
    carried: `${d.carriedWeight} / ${d.carryingCapacity} lb`,
    features: [...d.features.map(f => `${f.name} (${f.className} ${f.level})`), ...d.feats.map(f => `${f} (feat)`)],
    traits: d.traits,
    languages: [...d.languages, ...d.tools],
    conditions: play ? c.state.conditions.map(cap) : [],
    exhaustion: play ? c.state.exhaustion : 0,
    warnings: d.warnings,
    notes: c.notes,
  }
}

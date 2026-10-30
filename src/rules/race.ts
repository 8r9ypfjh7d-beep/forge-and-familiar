// One resolved view of a character's race: the race with its subrace folded in, trait picks applied and
// level-gated effects filtered. derive, choices, the builder and show-the-math read this instead of
// merging race and subrace themselves.
import type { Character } from '../model/character'
import { raceById } from './data/races'
import { rulesEdition } from './edition'
import { slug } from './subclass'
import type {
  Ability, ArmorCategory, ItemEffect, Race, RaceEffect, RaceUse, Size, SkillId, Subrace, TraitChoice, WeaponCategory,
} from './types'

export type RaceInput = Pick<Character, 'raceId'> &
  Partial<Pick<Character, 'subraceId' | 'rulesEdition' | 'traitChoices' | 'sizeChoice' | 'classes'>>

export interface RaceProfile {
  race?: Race
  subrace?: Subrace
  size: Size
  speed: number
  /** Race traits (minus the ones the subrace swaps out) then subrace traits. */
  traits: string[]
  skillProficiencies: SkillId[]
  freeSkillChoices: number
  languages: string[]
  languageChoices: number
  tools: string[]
  armor: ArmorCategory[]
  weapons: WeaponCategory[]
  weaponIds: string[]
  /** Free +1 picks (Half-Elf, Mark of Making human); undefined when there are none or the race is flexible. */
  freeAbilityBonuses?: { count: number; exclude: Ability[]; value?: number }
  /** +2/+1 or +1/+1/+1 picked freely (Monsters of the Multiverse style). */
  flexibleAbilityBonuses: boolean
  /** The player picks a feat: an Origin feat (2024 Human) or any feat (Variant Human). */
  featChoice?: 'origin' | 'any'
  /** Trait picks open at this character level, race then subrace. */
  choices: TraitChoice[]
  /** Sheet effects in play, labelled with the race, subrace or picked option. */
  effects: { source: string; effect: ItemEffect }[]
  /** Limited-use traits in play. */
  uses: RaceUse[]
  naturalArmor?: { base: number; dex: boolean; ability?: Ability }
  naturalWeapons: { name: string; damage: string; type: string }[]
  initiativeProficiency: boolean
  hpPerLevel: number
}

const levelOf = (c: RaceInput) => Math.max(1, (c.classes ?? []).reduce((n, cl) => n + cl.level, 0))

/** Option ids picked for a trait choice (a choice taking several is saved comma-separated). */
export const pickedOptions = (c: Pick<Character, 'traitChoices'> | Partial<Pick<Character, 'traitChoices'>>, choiceId: string): string[] =>
  (c.traitChoices?.[choiceId] ?? '').split(',').filter(Boolean)

/** The character's race and subrace resolved into one profile. */
export function raceProfile(c: RaceInput): RaceProfile {
  const race = raceById(c.raceId, rulesEdition(c))
  const subrace = race?.subraces?.find(s => s.id === c.subraceId)
  const level = levelOf(c)
  const parts = [race, subrace].filter((x): x is Race | Subrace => !!x)
  const removed = new Set(subrace?.removesTraits ?? [])
  const choices = parts.flatMap(p => p.choices ?? []).filter(ch => (ch.level ?? 1) <= level)
  const effects: RaceProfile['effects'] = []
  const add = (source: string, list: RaceEffect[] | undefined) => {
    for (const { level: from, trait, ...effect } of list ?? []) {
      if ((from ?? 1) <= level && !(trait && removed.has(trait))) effects.push({ source, effect: effect as ItemEffect })
    }
  }
  for (const p of parts) add(p.name, p.effects)
  const legacy = race?.traitChoice
  if (legacy) {
    const o = legacy.options.find(x => x.id === c.traitChoices?.[legacy.id])
    if (o) add(`${legacy.name} (${o.name})`, o.effects)
  }
  for (const ch of choices) {
    for (const id of pickedOptions(c, ch.id)) {
      const o = ch.options.find(x => x.id === id)
      if (o) add(`${ch.name} (${o.name})`, o.effects)
    }
  }
  const replaces = !!subrace?.replacesBonuses
  const free = replaces ? subrace?.freeAbilityBonuses : (subrace?.freeAbilityBonuses ?? race?.freeAbilityBonuses)
  const size = c.sizeChoice && race?.sizeOptions?.includes(c.sizeChoice) ? c.sizeChoice : race?.size ?? 'Medium'
  const uniq = <T,>(xs: T[]) => [...new Set(xs)]
  return {
    race,
    subrace,
    size,
    speed: subrace?.speed ?? race?.speed ?? 30,
    traits: [...(race?.traits ?? []).filter(t => !removed.has(t)), ...(subrace?.traits ?? [])],
    skillProficiencies: uniq((subrace?.replacesSkills ? [subrace] : parts).flatMap(p => p.skillProficiencies ?? [])),
    freeSkillChoices: subrace?.freeSkillChoices ?? race?.freeSkillChoices ?? 0,
    languages: uniq(parts.flatMap(p => p.languages ?? [])),
    languageChoices: (race?.languageChoices ?? 0) + (subrace?.languageChoices ?? 0),
    tools: uniq(parts.flatMap(p => p.tools ?? [])),
    armor: uniq(parts.flatMap(p => p.armor ?? [])),
    weapons: uniq(parts.flatMap(p => p.weapons ?? [])),
    weaponIds: uniq(parts.flatMap(p => p.weaponIds ?? [])),
    ...(free ? { freeAbilityBonuses: free } : {}),
    flexibleAbilityBonuses: !replaces && !!race?.flexibleAbilityBonuses,
    ...(subrace?.featChoice || race?.featChoice ? { featChoice: 'any' as const } : race?.originFeatChoice ? { featChoice: 'origin' as const } : {}),
    choices,
    effects,
    uses: parts.flatMap(p => p.uses ?? []).filter(u => (u.level ?? 1) <= level && !removed.has(u.trait)),
    ...((subrace?.naturalArmor ?? race?.naturalArmor) ? { naturalArmor: subrace?.naturalArmor ?? race?.naturalArmor } : {}),
    naturalWeapons: parts.flatMap(p => p.naturalWeapons ?? []),
    initiativeProficiency: parts.some(p => p.initiativeProficiency),
    hpPerLevel: (race?.hpPerLevel ?? 0) + (subrace?.hpPerLevel ?? 0),
  }
}

/** Sheet effects from the race, subrace and trait picks (for activeItemEffects). */
export const raceEffects = (c: Partial<RaceInput>): { source: string; effect: ItemEffect }[] =>
  c.raceId ? raceProfile(c as RaceInput).effects : []

/** Natural armor AC with these modifiers, or 0 without natural armor. */
export const naturalArmorAc = (n: RaceProfile['naturalArmor'], mods: Record<Ability, number>) =>
  n ? n.base + (n.dex ? mods.dex : 0) + (n.ability ? mods[n.ability] : 0) : 0

/** Resource id for a limited-use racial trait. */
export const raceUseId = (trait: string) => `race:${slug(trait)}`

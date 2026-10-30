// Builder choices beyond race, class and scores: languages, tools, Ability Score Improvements,
// feats and starting-gear picks. Pure helpers shared by the builder and derive().
import type { Character, Improvement } from '../model/character'
import { homebrewClassOptions } from './classOptions'
import { classOptionFeats } from './invocations'
import { getBackground } from './data/backgrounds'
import { classById } from './data/classes'
import { classLanguagePicks } from './classPicks'
import { CUSTOM_FEAT, featById } from './data/feats'
import { ITEMS } from './data/items'
import { rulesEdition } from './edition'
import { racialLanguages } from './origin'
import { raceProfile } from './race'
import { ABILITIES, type Abilities, type Ability, type ArmorCategory, type ClassChoice, type ClassDef, type Feat, type FeatEffect, type Item, type ItemEffect, type WeaponCategory } from './types'

type Edition = Partial<Pick<Character, 'rulesEdition'>>
type Classes = Pick<Character, 'classes'> & Edition
type RaceBg = Pick<Character, 'raceId' | 'subraceId' | 'backgroundId' | 'customBackground'> & Partial<Pick<Character, 'originSwaps'>> & Edition

/** What feat lookups read: ASI picks, and in 2024 the background's Origin feat, a Human's Origin feat and Fighting Styles. */
export type FeatInput = Classes & Partial<Pick<Character, 'improvements' | 'backgroundId' | 'customBackground' | 'originFeatId' | 'customOriginFeat' | 'featureChoices' | 'classOptions'>>

// ---------- Ability Score Improvements and feats ----------

/** Every ASI the character's class levels grant, in class order. */
export function improvementSlots(c: Classes): { classId: string; level: number }[] {
  return c.classes.flatMap(cl => (classById(cl.classId, rulesEdition(c))?.asiLevels ?? []).filter(l => l <= cl.level).map(level => ({ classId: cl.classId, level })))
}

// ---------- Class choices (2024 Fighting Style, Divine Order, Primal Order) ----------

/** Key of a class choice in Character.featureChoices. */
export const choiceKey = (classId: string, choiceId: string) => `${classId}.${choiceId}`

/** Class choices the character's levels have unlocked, with the option picked (if any). */
export function classChoices(c: Classes & Partial<Pick<Character, 'featureChoices'>>): { classId: string; choice: ClassChoice; picked?: ClassChoice['options'][number] }[] {
  const edition = rulesEdition(c)
  return c.classes.flatMap(cl => (classById(cl.classId, edition)?.choices ?? []).filter(ch => ch.level <= cl.level).map(base => {
    // Homebrew fighting styles join every Fighting Style list; their effects and uses apply through classOptionEffects.
    const extra = base.id === 'fightingStyle'
      ? homebrewClassOptions('fightingStyle').filter(o => (!o.edition || o.edition === edition) && (!o.classIds?.length || o.classIds.includes(cl.classId)))
        .map(o => ({ id: o.id, name: o.name, detail: o.text ?? '' }))
      : []
    const choice = extra.length ? { ...base, options: [...base.options, ...extra] } : base
    return { classId: cl.classId, choice, picked: choice.options.find(o => o.id === c.featureChoices?.[choiceKey(cl.classId, choice.id)]) }
  }))
}

/** Improvements that still match a slot (a lower class level drops the ones above it). */
export function activeImprovements(c: Classes & Pick<Character, 'improvements'>) {
  const slots = improvementSlots(c)
  return (c.improvements ?? []).filter(i => slots.some(s => s.classId === i.classId && s.level === i.level))
}

/** A player-made feat with a stable id and a name to show. */
const ownFeat = (f: Feat | undefined, id: string): Feat =>
  ({ ...(f ?? { description: '', effects: [] }), id, name: f?.name?.trim() || 'Custom feat', effects: f?.effects ?? [] })

/** The feat an improvement took: a listed one, or its own custom feat. */
export function improvementFeat(c: Edition, i: Improvement): Feat | undefined {
  if (!i.featId) return undefined
  return i.featId === CUSTOM_FEAT ? ownFeat(i.customFeat, `${CUSTOM_FEAT}:${i.classId}:${i.level}`) : featById(i.featId, rulesEdition(c))
}

/**
 * Every feat the character has: ones taken in place of an ASI, the background's feat and, in 2024,
 * a Human's Origin feat and Fighting Style feats. Unknown ids (a homebrew pack not on this device) are skipped.
 */
export function getFeats(c: FeatInput): Feat[] {
  const edition = rulesEdition(c)
  const byId = (id: string | undefined, note?: string): Feat[] => {
    const f = id === CUSTOM_FEAT ? ownFeat(c.customOriginFeat, `${CUSTOM_FEAT}:origin`) : id ? featById(id, edition) : undefined
    return f ? [note ? { ...f, name: `${f.name} (${note})` } : f] : []
  }
  const background = c.backgroundId ? getBackground({ backgroundId: c.backgroundId, customBackground: c.customBackground, rulesEdition: c.rulesEdition }) : undefined
  // A homebrew background's own effects count as one feat-like entry, in both editions.
  const fromBackground: Feat[] = background?.effects?.length
    ? [{ id: `bg:${background.id}`, name: `${background.name} (${background.feature})`, description: background.feature, effects: background.effects }]
    : []
  const asiFeats = [...activeImprovements(c).flatMap(i => improvementFeat(c, i) ?? []), ...classOptionFeats(c)]
  const fromAsi = [...fromBackground, ...asiFeats]
  const bg = background?.feat
  // 2014: a book background's feat (Strixhaven students, Wildspacer) and a race's feat pick (Variant Human,
  // Custom Lineage); the builder only sets originFeatId for those.
  if (edition !== '2024') return [...fromBackground, ...byId(bg?.id, bg?.note), ...byId(c.originFeatId), ...asiFeats]
  return [
    ...byId(bg?.id, bg?.note),
    ...byId(c.originFeatId),
    ...classChoices(c).flatMap(x => byId(x.picked?.featId)),
    ...fromAsi,
  ]
}

/** All effects of one kind from the character's feats. */
export function featEffects<K extends FeatEffect['kind']>(c: FeatInput, kind: K): Extract<FeatEffect, { kind: K }>[] {
  return getFeats(c).flatMap(f => f.effects.filter((e): e is Extract<FeatEffect, { kind: K }> => e.kind === kind))
}

/** Feat +1 picks (Resilient, 2024 general feats, Epic Boons): the ability chosen on the improvement, its cap, and whether its save comes too. */
export function featAbilityChoices(c: Classes & Pick<Character, 'improvements'>): { ability: Ability; max: number; save?: boolean }[] {
  return activeImprovements(c).flatMap(i => {
    const choice = improvementFeat(c, i)?.effects.find(e => e.kind === 'abilityChoice')
    return choice?.kind === 'abilityChoice' && i.featAbility && choice.from.includes(i.featAbility) ? [{ ability: i.featAbility, max: choice.max, save: choice.save }] : []
  })
}

/** Extra skills of any kind the player picks from feats (2024 Skilled). */
export const featSkillPicks = (c: FeatInput) => featEffects(c, 'skillPicks').reduce((n, e) => n + e.count, 0)

/** Sheet changes from feats (resistances, senses, spells, advantage...) and Resilient's save proficiency, labelled with the feat. */
export function featStats(c: FeatInput): { source: string; effect: ItemEffect }[] {
  const stats = getFeats(c).flatMap(f => (f.stats ?? []).map(effect => ({ source: f.name, effect })))
  const saves = activeImprovements(c).flatMap(i => {
    const f = improvementFeat(c, i)
    const choice = f?.effects.find(e => e.kind === 'abilityChoice')
    return f && choice?.kind === 'abilityChoice' && choice.save && i.featAbility ? [{ source: f.name, effect: { kind: 'saveProficiency', ability: i.featAbility } as ItemEffect }] : []
  })
  return [...stats, ...saves]
}

/** Armor and weapon training from feats (Heavily Armored, Martial Weapon Training). */
export function featProficiencies(c: FeatInput): { armor: ArmorCategory[]; weapons: WeaponCategory[] } {
  const feats = getFeats(c)
  return { armor: feats.flatMap(f => f.armor ?? []), weapons: feats.flatMap(f => f.weapons ?? []) }
}

/** Ability bonuses from ASIs and feat ability effects. */
export function improvementBonuses(c: FeatInput): Abilities {
  const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  for (const i of activeImprovements(c)) {
    if (i.featId) continue
    for (const a of ABILITIES) out[a] += Math.max(0, Math.round(i.abilities?.[a] ?? 0))
  }
  for (const f of getFeats(c)) for (const e of f.effects) if (e.kind === 'ability') out[e.ability] += e.amount
  return out
}

/** Sum of one feat effect kind (hpPerLevel, speed, initiative, ac, rangedAttack, armoredAc). */
export function featBonus(c: FeatInput, kind: 'hpPerLevel' | 'speed' | 'initiative' | 'ac' | 'rangedAttack' | 'armoredAc'): number {
  return featEffects(c, kind).reduce((n, e) => n + e.amount, 0)
}

// ---------- Languages and tools ----------

const CLASS_LANGUAGES: Record<string, string> = { druid: 'Druidic', rogue: "Thieves' Cant" }

/** Languages known without choosing: race, background and class. */
export function fixedLanguages(c: RaceBg & Classes): string[] {
  return [...new Set([
    ...racialLanguages(c),
    ...(getBackground(c)?.languages ?? []),
    ...c.classes.flatMap(cl => (CLASS_LANGUAGES[cl.classId] ? [CLASS_LANGUAGES[cl.classId]] : [])),
  ])]
}

/** How many languages the player picks: race, subrace and background choices, and class picks (2024 Rogue, Ranger). */
export function languagePickCount(c: RaceBg & Partial<Classes>): number {
  return raceProfile(c).languageChoices + (getBackground(c)?.languageChoices ?? 0) + (c.classes ? classLanguagePicks(c as Classes) : 0)
}

export function getLanguages(c: RaceBg & Classes & Pick<Character, 'chosenLanguages'>): string[] {
  return [...new Set([...fixedLanguages(c), ...(c.chosenLanguages ?? [])])]
}

/** Tools known without choosing: race, background and the first class. */
export function fixedTools(c: RaceBg & Classes): string[] {
  const first = classById(c.classes[0]?.classId ?? '', rulesEdition(c))
  return [...new Set([...raceProfile(c).tools, ...(first?.toolProficiencies ?? []), ...(getBackground(c)?.toolProficiencies ?? [])])]
}

/** Tool pick groups from race, first class and background, e.g. Dwarf artisan's tools, Bard instruments, Soldier gaming set. */
export function toolPickGroups(c: RaceBg & Classes): { source: string; count: number; from: string[] }[] {
  const race = raceProfile(c).race
  const first = classById(c.classes[0]?.classId ?? '', rulesEdition(c))
  const bg = getBackground(c)
  return [
    ...(race?.toolChoices ? [{ source: race.name, ...race.toolChoices }] : []),
    ...(first?.toolChoices ? [{ source: first.name, ...first.toolChoices }] : []),
    ...(bg?.toolChoices ? [{ source: bg.name, ...bg.toolChoices }] : []),
  ]
}

export function getTools(c: RaceBg & Classes & Pick<Character, 'chosenTools'>): string[] {
  return [...new Set([...fixedTools(c), ...(c.chosenTools ?? [])])]
}

// ---------- Starting equipment ----------

export const ANY_FILTERS = ['simple', 'martial', 'simple-melee', 'martial-melee', 'instrument'] as const
export type AnyFilter = (typeof ANY_FILTERS)[number]

const INSTRUMENTS = ['bagpipes', 'drum', 'dulcimer', 'flute', 'lute', 'lyre', 'horn', 'pan-flute', 'shawm', 'viol']
const ANY_DEFAULT: Record<AnyFilter, string> = {
  simple: 'spear', 'simple-melee': 'spear', martial: 'longsword', 'martial-melee': 'longsword', instrument: 'lute',
}

/** SRD items an "any" slot accepts. */
export function anyOptions(filter: AnyFilter): Item[] {
  if (filter === 'instrument') return ITEMS.filter(i => INSTRUMENTS.includes(i.id))
  const [category, melee] = filter.split('-') as ['simple' | 'martial', string | undefined]
  return ITEMS.filter(i => i.kind === 'weapon' && i.category === category && (!melee || !i.properties.includes('ranged')))
}

export const anyFilter = (slot: string): AnyFilter | undefined =>
  slot.startsWith('any:') && ANY_FILTERS.includes(slot.slice(4) as AnyFilter) ? (slot.slice(4) as AnyFilter) : undefined

/** Coins from the class kit: its own gold plus the gold of each chosen option (2024 "A or B" kits). */
export function kitGold(def: ClassDef, picks: Character['equipmentPicks'] = []): number {
  return (def.startingGold ?? 0) + (def.equipmentChoices ?? []).reduce((n, choice, i) =>
    n + ((choice.options[picks[i]?.option ?? 0] ?? choice.options[0]).gold ?? 0), 0)
}

/** Item ids from a class's fixed kit plus the chosen options. Unpicked or invalid "any" slots get a sensible default. */
export function classKit(def: ClassDef, picks: Character['equipmentPicks'] = []): string[] {
  const out = [...def.startingEquipment]
  ;(def.equipmentChoices ?? []).forEach((choice, i) => {
    const sel = picks[i]
    const option = choice.options[sel?.option ?? 0] ?? choice.options[0]
    let k = 0
    for (const slot of option.items) {
      const filter = anyFilter(slot)
      if (!filter) {
        out.push(slot)
        continue
      }
      const picked = sel?.items[k++]
      out.push(picked && anyOptions(filter).some(x => x.id === picked) ? picked : ANY_DEFAULT[filter])
    }
  })
  return out
}

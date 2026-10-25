// Builder choices beyond race, class and scores: languages, tools, Ability Score Improvements,
// feats and starting-gear picks. Pure helpers shared by the builder and derive().
import type { Character } from '../model/character'
import { getBackground } from './data/backgrounds'
import { classById } from './data/classes'
import { featById } from './data/feats'
import { ITEMS } from './data/items'
import { raceById } from './data/races'
import { ABILITIES, type Abilities, type ClassDef, type Feat, type Item } from './types'

type Classes = Pick<Character, 'classes'>
type RaceBg = Pick<Character, 'raceId' | 'subraceId' | 'backgroundId' | 'customBackground'>

// ---------- Ability Score Improvements and feats ----------

/** Every ASI the character's class levels grant, in class order. */
export function improvementSlots(c: Classes): { classId: string; level: number }[] {
  return c.classes.flatMap(cl => (classById(cl.classId)?.asiLevels ?? []).filter(l => l <= cl.level).map(level => ({ classId: cl.classId, level })))
}

/** Improvements that still match a slot (a lower class level drops the ones above it). */
export function activeImprovements(c: Classes & Pick<Character, 'improvements'>) {
  const slots = improvementSlots(c)
  return (c.improvements ?? []).filter(i => slots.some(s => s.classId === i.classId && s.level === i.level))
}

/** Feats taken in place of an ASI. Unknown ids (a homebrew pack not on this device) are skipped. */
export function getFeats(c: Classes & Pick<Character, 'improvements'>): Feat[] {
  return activeImprovements(c).flatMap(i => {
    const f = i.featId ? featById(i.featId) : undefined
    return f ? [f] : []
  })
}

/** Ability bonuses from ASIs and feat ability effects. */
export function improvementBonuses(c: Classes & Pick<Character, 'improvements'>): Abilities {
  const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  for (const i of activeImprovements(c)) {
    if (i.featId) continue
    for (const a of ABILITIES) out[a] += Math.max(0, Math.round(i.abilities?.[a] ?? 0))
  }
  for (const f of getFeats(c)) for (const e of f.effects) if (e.kind === 'ability') out[e.ability] += e.amount
  return out
}

/** Sum of one feat effect kind (hpPerLevel, speed, initiative, ac). */
export function featBonus(c: Classes & Pick<Character, 'improvements'>, kind: 'hpPerLevel' | 'speed' | 'initiative' | 'ac'): number {
  let n = 0
  for (const f of getFeats(c)) for (const e of f.effects) if (e.kind === kind) n += e.amount
  return n
}

// ---------- Languages and tools ----------

const CLASS_LANGUAGES: Record<string, string> = { druid: 'Druidic', rogue: "Thieves' Cant" }

/** Languages known without choosing: race, background and class. */
export function fixedLanguages(c: RaceBg & Classes): string[] {
  const race = raceById(c.raceId)
  return [...new Set([
    ...(race?.languages ?? []),
    ...(getBackground(c)?.languages ?? []),
    ...c.classes.flatMap(cl => (CLASS_LANGUAGES[cl.classId] ? [CLASS_LANGUAGES[cl.classId]] : [])),
  ])]
}

/** How many languages the player picks: race, subrace and background choices. */
export function languagePickCount(c: RaceBg): number {
  const race = raceById(c.raceId)
  const sub = race?.subraces?.find(s => s.id === c.subraceId)
  return (race?.languageChoices ?? 0) + (sub?.languageChoices ?? 0) + (getBackground(c)?.languageChoices ?? 0)
}

export function getLanguages(c: RaceBg & Classes & Pick<Character, 'chosenLanguages'>): string[] {
  return [...new Set([...fixedLanguages(c), ...(c.chosenLanguages ?? [])])]
}

/** Tools known without choosing: background and the first class. */
export function fixedTools(c: RaceBg & Classes): string[] {
  const first = classById(c.classes[0]?.classId ?? '')
  return [...new Set([...(first?.toolProficiencies ?? []), ...(getBackground(c)?.toolProficiencies ?? [])])]
}

/** Tool pick groups from race and first class, e.g. Dwarf artisan's tools and Bard instruments. */
export function toolPickGroups(c: RaceBg & Classes): { source: string; count: number; from: string[] }[] {
  const race = raceById(c.raceId)
  const first = classById(c.classes[0]?.classId ?? '')
  return [
    ...(race?.toolChoices ? [{ source: race.name, ...race.toolChoices }] : []),
    ...(first?.toolChoices ? [{ source: first.name, ...first.toolChoices }] : []),
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

// Option lists a class or subclass picks from: invocations, metamagic, maneuvers, fighting styles, infusions...
// Official lists and homebrew packs register here, so every picker lists both and any saved id resolves.
import type { Character } from '../model/character'
import { rulesEdition } from './edition'
import { activeSubclasses } from './subclass'
import type { ItemEffect, SubclassFeature } from './types'

/** Known kinds; other lists (arcane shots, runes, disciplines) use their own string. */
export type ClassOptionKind = 'invocation' | 'pactBoon' | 'metamagic' | 'maneuver' | 'fightingStyle' | 'infusion' | (string & {})

/** The kinds a homebrew pack can write, in editor order. */
export const HOMEBREW_OPTION_KINDS = ['invocation', 'metamagic', 'maneuver', 'fightingStyle', 'infusion'] as const

/** Classes that pick each homebrew kind by default; the author may tick others. */
export const OPTION_KIND_CLASSES: Record<(typeof HOMEBREW_OPTION_KINDS)[number], string[]> = {
  invocation: ['warlock'], metamagic: ['sorcerer'], maneuver: ['fighter'], fightingStyle: ['fighter', 'paladin', 'ranger'], infusion: ['artificer'],
}

export interface ClassOption {
  id: string
  kind: ClassOptionKind
  name: string
  /** What it does (our own words for non-SRD content). */
  text?: string
  /** Book it comes from, or the homebrew pack name. */
  source?: string
  /** Edition it belongs to; none means both. */
  edition?: '2014' | '2024'
  /** Classes that may pick it; none means any class that has this kind of list. */
  classIds?: string[]
  /** Subclasses that may pick it (Battle Master maneuvers, Rune Knight runes). */
  subclassIds?: string[]
  /** Lowest class level that may pick it. */
  minLevel?: number
  /** Prerequisite as shown to the player ("Pact of the Blade", "Eldritch Blast cantrip"). */
  prerequisite?: string
  /** Other option ids that must be picked first (a pact boon). */
  requires?: string[]
  /** Points it costs to use: sorcery points, ki, superiority dice. */
  cost?: number
  /** The cost is per spell level, at least 1 (2014 Twinned Spell). */
  costPerSpellLevel?: boolean
  /** May be picked more than once (2024 Agonizing Blast, one per cantrip). */
  repeatable?: boolean
  /** What the pick's `choice` names: an Origin feat id (Lessons of the First Ones), a cantrip, a damage type... */
  choiceKind?: 'originFeat' | 'cantrip' | (string & {})
  /** Uses tracked on the sheet's Resources, counted from the picking class's level. */
  uses?: SubclassFeature['uses']
  /** What it changes on the sheet while picked. */
  effects?: ItemEffect[]
  /** More effects from a class level on (Storm Soul at 6). */
  later?: { level: number; effects: ItemEffect[] }[]
  /** What an infused or replicated item gets; copied onto the item, never applied to the character by itself. */
  item?: { magicBonus?: number; effects?: ItemEffect[]; itemId?: string }
  /** Spells it grants, from a class level on when `level` is set (Land terrain spells at 3/5/7/9). */
  spells?: { name: string; level?: number; note?: string }[]
}

/** A saved pick. `classId` is the class that picked it, for level-based uses and multiclass characters. */
export interface ClassOptionPick {
  kind: ClassOptionKind
  id: string
  classId?: string
  /** Class level it was picked at. */
  level?: number
  /** The option's own choice (see ClassOption.choiceKind). */
  choice?: string
}

const registry = new Map<string, ClassOption[]>()

/** Replaces one origin's list ('invocations', 'metamagic', 'homebrew'...). */
export function registerClassOptions(origin: string, list: ClassOption[]): void {
  registry.set(origin, list)
}

const fits = (o: ClassOption, edition?: '2014' | '2024') => !edition || !o.edition || o.edition === edition

/** Every option of a kind for an edition (or all editions), official lists first, homebrew last. */
export function classOptions(kind: ClassOptionKind, edition?: '2014' | '2024'): ClassOption[] {
  const all = [...registry.entries()].sort(([a], [b]) => Number(a === 'homebrew') - Number(b === 'homebrew')).flatMap(([, l]) => l)
  return all.filter(o => o.kind === kind && fits(o, edition))
}

/** Homebrew options of a kind only. */
export const homebrewClassOptions = (kind?: ClassOptionKind): ClassOption[] =>
  (registry.get('homebrew') ?? []).filter(o => !kind || o.kind === kind)

/** Any registered option. With an edition, that edition's entry wins over one for both, then any other. */
export function classOptionById(id: string, edition?: '2014' | '2024'): ClassOption | undefined {
  const matches = [...registry.values()].flatMap(l => l.filter(o => o.id === id))
  if (!edition) return matches[0]
  return matches.find(o => o.edition === edition) ?? matches.find(o => !o.edition) ?? matches[0]
}

type Owner = Partial<Pick<Character, 'classOptions' | 'classes' | 'rulesEdition' | 'featureChoices' | 'customSubclasses'>>

/** Homebrew fighting styles picked in a Fighting Style choice (saved in featureChoices, like the official styles). */
const homebrewStylePicks = (c: Owner): ClassOptionPick[] =>
  Object.entries(c.featureChoices ?? {}).flatMap(([key, id]) => {
    const [classId, choiceId] = key.split('.')
    return choiceId === 'fightingStyle' && id.startsWith('hb:') ? [{ kind: 'fightingStyle', id, classId }] : []
  })

/** The character's picks that still resolve, with the option and the picking class's level. */
export function pickedClassOptions(c: Owner): { pick: ClassOptionPick; option: ClassOption; level: number }[] {
  const edition = rulesEdition(c)
  const total = (c.classes ?? []).reduce((n, cl) => n + cl.level, 0)
  const subs = activeSubclasses(c)
  return [...(c.classOptions ?? []), ...homebrewStylePicks(c)].flatMap(pick => {
    const option = classOptionById(pick.id, edition)
    if (!option) return []
    // A subclass's option (a maneuver, a rune) only counts while the picking class has that subclass.
    if (option.subclassIds && !subs.some(s => (!pick.classId || s.classId === pick.classId) && option.subclassIds!.includes(s.subclass.id))) return []
    const level = pick.classId ? c.classes?.find(cl => cl.classId === pick.classId)?.level ?? 0 : total
    return [{ pick, option, level }]
  })
}

/** Resource id for a picked option with uses. */
export const classOptionResourceId = (o: ClassOption) => `opt:${o.id}`

/** Sheet changes from picked options, labelled with the option's name. */
export const classOptionEffects = (c: Owner): { source: string; effect: ItemEffect }[] =>
  pickedClassOptions(c).flatMap(({ option, level }) => [
    ...(option.effects ?? []),
    ...(option.later ?? []).filter(l => l.level <= level).flatMap(l => l.effects),
    ...(option.spells ?? []).filter(s => (s.level ?? 0) <= level).map((s): ItemEffect => ({ kind: 'spell', spell: s.name, ...(s.note ? { note: s.note } : {}) })),
  ].map(effect => ({ source: option.name, effect })))

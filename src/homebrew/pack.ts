// Pure pack helpers: ids, validation, and share codes. Imported packs come from other people,
// so everything read from a code or file is rebuilt field by field and never trusted as-is.
import { parseNotation } from '../dice/notation'
import { ABILITIES, ABILITY_NAMES, type Abilities, type Ability, type ArmorCategory, type SkillId } from '../rules/types'
import { ALL_SKILLS, SKILLS } from '../rules/data/skills'
import {
  PACK_FORMAT, PACK_VERSION, RARITIES, SPELL_SCHOOLS,
  BACKGROUND_EDITIONS,
  type ContentKind, type FeatEffect, type HomebrewBackground, type HomebrewEntry, type HomebrewFeat, type HomebrewItem, type HomebrewPack, type HomebrewRace,
  type HomebrewSpell, type HomebrewSubclass,
} from './types'

/** Every entry in a pack, all kinds. */
export const allEntries = (p: HomebrewPack): HomebrewEntry[] => [...p.spells, ...p.items, ...p.feats, ...p.races, ...p.subclasses, ...p.backgrounds]

export const SHARE_PREFIX = 'FFHB1.'
export const LIMITS = { entries: 500, name: 80, text: 4000, short: 120 }

const WEAPON_PROPS = ['finesse', 'light', 'heavy', 'reach', 'thrown', 'two-handed', 'versatile', 'ammunition', 'loading', 'ranged'] as const

export class PackError extends Error {}

export const slug = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'entry'

/** Namespaced id for a new entry, unique within the pack: `hb:<packId>:<slug>`. */
export function entryId(pack: HomebrewPack, name: string): string {
  const taken = new Set(allEntries(pack).map(e => e.id))
  const base = `hb:${pack.id}:${slug(name)}`
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

export function newPack(id: string, author: { id: string; displayName: string }, name: string): HomebrewPack {
  return {
    format: PACK_FORMAT, version: PACK_VERSION, id, name, description: '',
    authorId: author.id, authorName: author.displayName, updatedAt: new Date().toISOString(),
    spells: [], items: [], feats: [], races: [], subclasses: [], backgrounds: [],
  }
}

// ---------- Validation for the editor ----------

export function isDice(s: string): boolean {
  try {
    return parseNotation(s).some(t => t.kind === 'dice')
  } catch {
    return false
  }
}

export function spellIssues(s: HomebrewSpell): string[] {
  const out: string[] = []
  if (!s.name.trim()) out.push('Give the spell a name.')
  if (!s.description.trim()) out.push('Describe what the spell does.')
  if (s.components.m && !s.components.material?.trim()) out.push('Name the material component.')
  if (s.damage && !isDice(s.damage)) out.push(`Damage "${s.damage}" is not dice notation like 3d6 or 2d8+4.`)
  return out
}

export function itemIssues(i: HomebrewItem): string[] {
  const out: string[] = []
  if (!i.name.trim()) out.push('Give the item a name.')
  if (!(i.weight >= 0)) out.push('Weight cannot be negative.')
  if (i.kind === 'weapon') {
    if (!isDice(i.damage)) out.push(`Damage "${i.damage}" is not dice notation like 1d8.`)
    if (i.properties.includes('versatile') && !(i.versatile && isDice(i.versatile))) out.push('Versatile weapons need a two-handed damage die.')
    if ((i.properties.includes('thrown') || i.properties.includes('ranged')) && !i.range?.trim()) out.push('Thrown and ranged weapons need a range like 20/60.')
  }
  if (i.kind === 'armor' && !(i.baseAc >= 0 && i.baseAc <= 30)) out.push('Armor class must be between 0 and 30.')
  return out
}

export function featIssues(f: HomebrewFeat): string[] {
  const out: string[] = []
  if (!f.name.trim()) out.push('Give the feat a name.')
  if (!f.description.trim()) out.push('Describe what the feat does.')
  return out
}

export function raceIssues(r: HomebrewRace): string[] {
  const out: string[] = []
  if (!r.name.trim()) out.push('Give the race a name.')
  if (!r.parentRaceId && !(r.speed >= 0 && r.speed <= 120)) out.push('Speed must be between 0 and 120 ft.')
  return out
}

export function subclassIssues(s: HomebrewSubclass): string[] {
  const out: string[] = []
  if (!s.name.trim()) out.push('Give the subclass a name.')
  if (!s.classId) out.push('Pick the class it belongs to.')
  if (s.features.some(f => !f.name.trim())) out.push('Every feature needs a name.')
  return out
}

export function backgroundIssues(b: HomebrewBackground): string[] {
  const out: string[] = []
  if (!b.name.trim()) out.push('Give the background a name.')
  if (!b.feature.trim()) out.push('Name the background feature.')
  if (b.editions !== '2014' && new Set(b.abilityScores).size !== 3) out.push('Pick three abilities for 2024 characters to raise.')
  return out
}

// ---------- Sanitizing untrusted packs ----------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = LIMITS.short) => (typeof v === 'string' ? v.slice(0, max) : '')
const optStr = (v: unknown, max = LIMITS.short) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined)
const num = (v: unknown, min: number, max: number, fallback = min) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
const int = (v: unknown, min: number, max: number, fallback = min) => Math.round(num(v, min, max, fallback))
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback
const optOneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined =>
  list.includes(v as T) ? (v as T) : undefined
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v.slice(0, LIMITS.entries) : [])
const optDice = (v: unknown) => {
  const s = optStr(v, 40)
  return s && isDice(s) ? s : undefined
}

/** Entry ids must belong to this pack's namespace, otherwise a pack could shadow another pack's items. */
function ownId(v: unknown, packId: string, name: string, seen: Set<string>): string {
  const prefix = `hb:${packId}:`
  let id = typeof v === 'string' && v.startsWith(prefix) && v.length <= 120 ? v : `${prefix}${slug(name)}`
  const base = id
  for (let n = 2; seen.has(id); n++) id = `${base}-${n}`
  seen.add(id)
  return id
}

function cleanSpell(v: Obj, packId: string, seen: Set<string>): HomebrewSpell {
  const name = str(v.name, LIMITS.name) || 'Unnamed spell'
  const c = isObj(v.components) ? v.components : {}
  return {
    id: ownId(v.id, packId, name, seen),
    name,
    level: int(v.level, 0, 9),
    school: oneOf(v.school, SPELL_SCHOOLS, 'Evocation'),
    castingTime: str(v.castingTime) || '1 action',
    range: str(v.range) || 'Self',
    components: { v: c.v === true, s: c.s === true, m: c.m === true, material: optStr(c.material, LIMITS.text) },
    duration: str(v.duration) || 'Instantaneous',
    concentration: v.concentration === true,
    ritual: v.ritual === true,
    classes: list(v.classes).map(x => str(x, 40)).filter(Boolean).slice(0, 20),
    description: str(v.description, LIMITS.text),
    higherLevels: optStr(v.higherLevels, LIMITS.text),
    damage: optDice(v.damage),
    damageType: optStr(v.damageType, 40),
    save: optOneOf<Ability>(v.save, ABILITIES),
  }
}

function cleanItem(v: Obj, packId: string, seen: Set<string>): HomebrewItem {
  const name = str(v.name, LIMITS.name) || 'Unnamed item'
  const common = {
    id: ownId(v.id, packId, name, seen),
    name,
    weight: num(v.weight, 0, 10000, 0),
    description: optStr(v.description, LIMITS.text),
    rarity: optOneOf(v.rarity, RARITIES),
  }
  if (v.kind === 'weapon') {
    const props = list(v.properties).filter((p): p is (typeof WEAPON_PROPS)[number] => WEAPON_PROPS.includes(p as never))
    return {
      ...common, kind: 'weapon',
      category: oneOf(v.category, ['simple', 'martial'] as const, 'simple'),
      damage: optDice(v.damage) ?? '1d4',
      damageType: str(v.damageType, 40) || 'bludgeoning',
      properties: [...new Set(props)],
      versatile: optDice(v.versatile),
      range: optStr(v.range, 20),
    }
  }
  if (v.kind === 'armor') {
    return {
      ...common, kind: 'armor',
      category: oneOf(v.category, ['light', 'medium', 'heavy', 'shield'] as const, 'light'),
      baseAc: int(v.baseAc, 0, 30, 10),
      dexCap: v.dexCap === undefined || v.dexCap === null ? undefined : int(v.dexCap, 0, 10),
      stealthDisadvantage: v.stealthDisadvantage === true || undefined,
      strengthReq: v.strengthReq === undefined || v.strengthReq === null ? undefined : int(v.strengthReq, 1, 30),
    }
  }
  return { ...common, kind: 'gear' }
}

function cleanEffect(v: unknown): FeatEffect | undefined {
  if (!isObj(v)) return undefined
  switch (v.kind) {
    case 'ability': {
      const ability = optOneOf<Ability>(v.ability, ABILITIES)
      return ability && { kind: 'ability', ability, amount: int(v.amount, -5, 5, 1) }
    }
    case 'skill': {
      const skill = optOneOf<SkillId>(v.skill, ALL_SKILLS)
      return skill && { kind: 'skill', skill }
    }
    case 'hpPerLevel':
    case 'speed':
    case 'initiative':
    case 'ac':
    case 'armoredAc':
    case 'rangedAttack':
      return { kind: v.kind, amount: int(v.amount, -100, 100, 0) }
    case 'initiativeProficiency':
      return { kind: v.kind }
    case 'skillPicks':
      return { kind: v.kind, count: int(v.count, 1, 6, 1) }
  }
  return undefined
}

function cleanFeat(v: Obj, packId: string, seen: Set<string>): HomebrewFeat {
  const name = str(v.name, LIMITS.name) || 'Unnamed feat'
  return {
    id: ownId(v.id, packId, name, seen),
    name,
    prerequisite: optStr(v.prerequisite),
    description: str(v.description, LIMITS.text),
    effects: list(v.effects).map(cleanEffect).filter((e): e is FeatEffect => !!e).slice(0, 20),
  }
}

const SIZES = ['Small', 'Medium'] as const
const ARMOR = ['light', 'medium', 'heavy', 'shield'] as const
const textList = (v: unknown, max = 30) => list(v).map(x => str(x, LIMITS.name).trim()).filter(Boolean).slice(0, max)

function cleanBonuses(v: unknown): Partial<Abilities> {
  const out: Partial<Abilities> = {}
  if (!isObj(v)) return out
  for (const a of ABILITIES) {
    const n = int(v[a], -5, 5, 0)
    if (n) out[a] = n
  }
  return out
}

function cleanRace(v: Obj, packId: string, seen: Set<string>): HomebrewRace {
  const name = str(v.name, LIMITS.name) || 'Unnamed race'
  const parent = optStr(v.parentRaceId, 120)
  return {
    id: ownId(v.id, packId, name, seen),
    name,
    // A subrace may hang off any race id; it simply doesn't show if that race is missing.
    parentRaceId: parent && /^[a-z0-9:-]+$/i.test(parent) ? parent : undefined,
    size: oneOf(v.size, SIZES, 'Medium'),
    speed: int(v.speed, 0, 120, 30),
    abilityBonuses: cleanBonuses(v.abilityBonuses),
    freeAbilityBonuses: int(v.freeAbilityBonuses, 0, 6),
    skillProficiencies: [...new Set(list(v.skillProficiencies).filter((x): x is SkillId => ALL_SKILLS.includes(x as SkillId)))],
    freeSkillChoices: int(v.freeSkillChoices, 0, 6),
    languages: textList(v.languages, 10),
    languageChoices: int(v.languageChoices, 0, 6),
    traits: textList(v.traits),
    hpPerLevel: int(v.hpPerLevel, 0, 5),
    description: optStr(v.description, LIMITS.text),
  }
}

function cleanSubclass(v: Obj, packId: string, seen: Set<string>): HomebrewSubclass {
  const name = str(v.name, LIMITS.name) || 'Unnamed subclass'
  return {
    id: ownId(v.id, packId, name, seen),
    name,
    classId: str(v.classId, 40),
    features: list(v.features).filter(isObj).map(f => ({ level: int(f.level, 1, 20, 1), name: str(f.name, LIMITS.name) || 'Feature' })).slice(0, 40),
    armor: [...new Set(list(v.armor).filter((a): a is ArmorCategory => ARMOR.includes(a as ArmorCategory)))],
    description: optStr(v.description, LIMITS.text),
  }
}

const idLike = (v: unknown) => {
  const s = optStr(v, 120)
  return s && /^[a-z0-9:_-]+$/i.test(s) ? s : undefined
}

function cleanBackground(v: Obj, packId: string, seen: Set<string>): HomebrewBackground {
  const name = str(v.name, LIMITS.name) || 'Unnamed background'
  return {
    id: ownId(v.id, packId, name, seen),
    name,
    editions: oneOf(v.editions, BACKGROUND_EDITIONS, 'both'),
    skillProficiencies: [...new Set(list(v.skillProficiencies).filter((x): x is SkillId => ALL_SKILLS.includes(x as SkillId)))],
    tools: textList(v.tools, 10),
    toolChoices: int(v.toolChoices, 0, 6),
    toolChoiceFrom: textList(v.toolChoiceFrom, 60),
    languages: textList(v.languages, 10),
    languageChoices: int(v.languageChoices, 0, 6),
    equipment: list(v.equipment).map(idLike).filter((x): x is string => !!x).slice(0, 40),
    gold: int(v.gold, 0, 100000),
    feature: str(v.feature, LIMITS.name),
    featureText: optStr(v.featureText, LIMITS.text),
    abilityScores: [...new Set(list(v.abilityScores).filter((a): a is Ability => ABILITIES.includes(a as Ability)))].slice(0, 3),
    originFeatId: idLike(v.originFeatId),
    originFeatNote: optStr(v.originFeatNote, 40),
    effects: list(v.effects).map(cleanEffect).filter((e): e is FeatEffect => !!e).slice(0, 20),
    description: optStr(v.description, LIMITS.text),
  }
}

/** Rebuilds a pack from unknown JSON. Throws PackError if it isn't a homebrew pack at all. */
export function sanitizePack(raw: unknown): HomebrewPack {
  if (!isObj(raw) || raw.format !== PACK_FORMAT) throw new PackError("This isn't a Forge & Familiar homebrew pack.")
  if (raw.version !== PACK_VERSION) throw new PackError('This pack was made by a newer version of the app.')
  const id = typeof raw.id === 'string' && /^[a-z0-9-]{4,64}$/i.test(raw.id) ? raw.id : ''
  if (!id) throw new PackError('This pack has no valid id.')
  const seen = new Set<string>()
  const updatedAt = typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : new Date(0).toISOString()
  return {
    format: PACK_FORMAT, version: PACK_VERSION, id,
    name: str(raw.name, LIMITS.name) || 'Untitled pack',
    description: str(raw.description, LIMITS.text),
    authorId: str(raw.authorId, 64),
    authorName: str(raw.authorName, LIMITS.name) || 'Unknown',
    updatedAt,
    spells: list(raw.spells).filter(isObj).map(v => cleanSpell(v, id, seen)),
    items: list(raw.items).filter(isObj).map(v => cleanItem(v, id, seen)),
    feats: list(raw.feats).filter(isObj).map(v => cleanFeat(v, id, seen)),
    races: list(raw.races).filter(isObj).map(v => cleanRace(v, id, seen)),
    subclasses: list(raw.subclasses).filter(isObj).map(v => cleanSubclass(v, id, seen)),
    backgrounds: list(raw.backgrounds).filter(isObj).map(v => cleanBackground(v, id, seen)),
    history: Array.isArray(raw.history) ? raw.history.slice(0, LIMITS.entries * 20) : undefined,
  }
}

/** Rebuilds one entry (e.g. a restored history version) the same way an import would. */
export function sanitizeEntry(kind: ContentKind, raw: unknown, packId: string): HomebrewEntry {
  if (!isObj(raw)) throw new PackError('That version could not be read.')
  const seen = new Set<string>()
  if (kind === 'spells') return cleanSpell(raw, packId, seen)
  if (kind === 'items') return cleanItem(raw, packId, seen)
  if (kind === 'races') return cleanRace(raw, packId, seen)
  if (kind === 'subclasses') return cleanSubclass(raw, packId, seen)
  if (kind === 'backgrounds') return cleanBackground(raw, packId, seen)
  return cleanFeat(raw, packId, seen)
}

// ---------- Share codes ----------

/** A pasteable text code for a pack: prefix + base64url(UTF-8 JSON). */
export function encodeShareCode(pack: HomebrewPack): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...pack, history: undefined }))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return SHARE_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Reads a share code or the contents of an exported .json file. */
export function decodePack(input: string): HomebrewPack {
  const text = input.trim()
  let json: string
  if (text.startsWith('{')) json = text
  else if (text.startsWith(SHARE_PREFIX)) {
    try {
      const b64 = text.slice(SHARE_PREFIX.length).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
      const bin = atob(b64)
      json = new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)))
    } catch {
      throw new PackError('That share code is damaged. Ask for it again.')
    }
  } else throw new PackError('Paste a share code starting with FFHB1. or open a pack file.')
  try {
    return sanitizePack(JSON.parse(json))
  } catch (e) {
    if (e instanceof PackError) throw e
    throw new PackError("That pack couldn't be read.")
  }
}

export function describeEffect(e: FeatEffect): string {
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
  switch (e.kind) {
    case 'ability': return `${ABILITY_NAMES[e.ability]} ${sign(e.amount)}`
    case 'skill': return `Proficient in ${SKILLS[e.skill].name}`
    case 'hpPerLevel': return `${sign(e.amount)} HP per level`
    case 'speed': return `Speed ${sign(e.amount)} ft.`
    case 'initiative': return `Initiative ${sign(e.amount)}`
    case 'ac': return `AC ${sign(e.amount)}`
    case 'armoredAc': return `AC ${sign(e.amount)} while wearing armor`
    case 'rangedAttack': return `Ranged attacks ${sign(e.amount)}`
    case 'initiativeProficiency': return 'Proficiency bonus to initiative'
    case 'skillPicks': return `${e.count} skill${e.count > 1 ? 's' : ''} of your choice`
    case 'abilityChoice': return `+1 to ${e.from.map(a => ABILITY_NAMES[a]).join(' or ')} (max ${e.max})`
  }
}

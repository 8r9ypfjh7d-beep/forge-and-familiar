// Characters from other tools: Foundry VTT (dnd5e actor export) and Dicecloud v2 (creature JSON).
// Each adapter reads its format into a ForeignSheet; toCharacter() maps that onto SRD 5.1 ids.
// Pure TypeScript. Anything that does not map is listed in the character's notes, never dropped silently.
import { CHARACTER_SCHEMA_VERSION, type Character, type KnownSpell } from '../model/character'
import {
  ABILITIES, CUSTOM_BACKGROUND, ITEMS, SKILLS, allLanguages, allRaces, backgroundsFor, classById, classesFor,
  freshState, getMaxHp, racialBonuses, subclassesFor,
  type Abilities, type Ability, type InventoryEntry, type SkillId,
} from '../rules'
import { FILE_FORMAT, FILE_VERSION, checkCharacter, type ParseResult } from './file'

export const NOT_A_CHARACTER = 'This is not a Forge & Familiar, Foundry VTT or Dicecloud character file.'

export type ForeignFormat = 'foundry' | 'dicecloud'
export const FORMAT_NAMES: Record<ForeignFormat, string> = { foundry: 'Foundry VTT', dicecloud: 'Dicecloud' }

/** What a foreign file says, before it is matched to SRD ids. */
export interface ForeignSheet {
  format: ForeignFormat
  name: string
  alignment: string
  xp: number
  /** Race and subrace names, most specific first ("Hill Dwarf", "Dwarf"). */
  race: string[]
  classes: { name: string; level: number; subclass?: string }[]
  background?: string
  /** Final scores, racial bonuses included. */
  scores: Partial<Abilities>
  skills: SkillId[]
  expertise: SkillId[]
  languages: string[]
  hp?: { current: number; temp: number }
  coins: { pp: number; gp: number; ep: number; sp: number; cp: number }
  items: { name: string; qty: number; equipped: boolean }[]
  spells: { name: string; className?: string }[]
  notes: string
}

/** Lookups that need the content library. `spellIds` maps a lower-case spell name to its library id. */
export interface ForeignLookups {
  spellIds?: Map<string, string>
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : '')
const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : d)
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
/** Lower case, letters and digits only, so "Half-Elf", "half elf" and "halfElf" compare equal. */
export const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
const stripHtml = (s: string) => s.replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim()
const emptyCoins = () => ({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })

const ABILITY_NAMES: Record<Ability, string> = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' }

/** Which tool made this JSON, or null when it is neither. */
export function detectForeign(raw: unknown): ForeignFormat | null {
  if (!isObj(raw)) return null
  const sys = isObj(raw.system) ? raw.system : isObj(raw.data) ? raw.data : null
  if (sys && isObj(sys.abilities) && Array.isArray(raw.items)) return 'foundry'
  if (Array.isArray(raw.creatureProperties) || (isObj(raw.creature) && Array.isArray(raw.properties))) return 'dicecloud'
  return null
}

// ---------- Foundry VTT ----------

const FOUNDRY_SKILLS: Record<string, SkillId> = {
  acr: 'acrobatics', ani: 'animalHandling', arc: 'arcana', ath: 'athletics', dec: 'deception', his: 'history',
  ins: 'insight', itm: 'intimidation', inv: 'investigation', med: 'medicine', nat: 'nature', prc: 'perception',
  prf: 'performance', per: 'persuasion', rel: 'religion', slt: 'sleightOfHand', ste: 'stealth', sur: 'survival',
}
const FOUNDRY_GEAR = new Set(['weapon', 'equipment', 'consumable', 'tool', 'loot', 'backpack', 'container'])

/** A Foundry dnd5e actor ("Export Data" on the actor). Reads both `system` (v10+) and the older `data`. */
export function readFoundry(raw: Record<string, unknown>): ForeignSheet {
  const sys = (isObj(raw.system) ? raw.system : raw.data) as Record<string, unknown>
  type FoundryItem = Record<string, unknown> & { sys: Record<string, unknown> }
  const items: FoundryItem[] = arr(raw.items).filter(isObj).map(i => ({ ...i, sys: (isObj(i.system) ? i.system : isObj(i.data) ? i.data : {}) as Record<string, unknown> }))
  const details = isObj(sys.details) ? sys.details : {}
  const abilities = isObj(sys.abilities) ? sys.abilities : {}
  const attrs = isObj(sys.attributes) ? sys.attributes : {}
  const hp = isObj(attrs.hp) ? attrs.hp : {}
  const traits = isObj(sys.traits) ? sys.traits : {}
  const langs = isObj(traits.languages) ? traits.languages : {}
  const ofType = (t: string) => items.filter(i => i.type === t)

  const scores: Partial<Abilities> = {}
  for (const a of ABILITIES) {
    const v = isObj(abilities[a]) ? num((abilities[a] as Record<string, unknown>).value, NaN) : NaN
    if (!Number.isNaN(v)) scores[a] = v
  }

  const skills: SkillId[] = []
  const expertise: SkillId[] = []
  for (const [code, s] of Object.entries(isObj(sys.skills) ? sys.skills : {})) {
    const id = FOUNDRY_SKILLS[code]
    const v = isObj(s) ? num(s.value) : 0
    if (!id || v < 1) continue
    skills.push(id)
    if (v >= 2) expertise.push(id)
  }

  const subclasses = ofType('subclass')
  const classes = ofType('class').map(i => {
    const ident = str(i.sys.identifier) || str(i.name)
    const sub = subclasses.find(s => norm(str(s.sys.classIdentifier)) === norm(ident))
    return { name: ident, level: num(i.sys.levels, 1), subclass: str(sub?.name) || str(i.sys.subclass) || undefined }
  })

  // Older actors keep race and background as text in details; newer ones as items.
  const raceItem = ofType('race')[0]
  const race = [str(raceItem?.name), str(details.race)].filter(Boolean)
  const background = str(ofType('background')[0]?.name) || str(details.background) || undefined

  const cur = isObj(sys.currency) ? sys.currency : {}
  const coins = emptyCoins()
  for (const k of Object.keys(coins) as (keyof typeof coins)[]) coins[k] = num(cur[k])

  const bio = isObj(details.biography) ? str(details.biography.value) : str(details.biography)
  const xp = isObj(details.xp) ? num(details.xp.value) : num(details.xp)

  return {
    format: 'foundry',
    name: str(raw.name),
    alignment: str(details.alignment),
    xp,
    race,
    classes,
    background,
    scores,
    skills,
    expertise,
    languages: [...arr(langs.value).map(str), ...str(langs.custom).split(/[;,]/).map(s => s.trim())].filter(Boolean),
    hp: { current: num(hp.value), temp: num(hp.temp) },
    coins,
    items: items.filter(i => FOUNDRY_GEAR.has(String(i.type))).map(i => ({ name: str(i.name), qty: Math.max(1, num(i.sys.quantity, 1)), equipped: i.sys.equipped === true })),
    spells: ofType('spell').map(i => ({ name: str(i.name), className: str(i.sys.sourceClass) || undefined })),
    notes: stripHtml(bio),
  }
}

// ---------- Dicecloud v2 ----------

const COIN_NAMES: [RegExp, keyof ReturnType<typeof emptyCoins>][] = [
  [/^(platinum|pp)\b/i, 'pp'], [/^(gold|gp)\b/i, 'gp'], [/^(electrum|ep)\b/i, 'ep'], [/^(silver|sp)\b/i, 'sp'], [/^(copper|cp)\b/i, 'cp'],
]

/**
 * A Dicecloud v2 creature as its API returns it (`/api/creature/<id>`): `creatures`, `creatureProperties`,
 * `creatureVariables`. Also takes `{ creature, properties, variables }`.
 */
export function readDicecloud(raw: Record<string, unknown>): ForeignSheet {
  const creature = (isObj(raw.creature) ? raw.creature : arr(raw.creatures).find(isObj) ?? {}) as Record<string, unknown>
  const vars = (isObj(raw.variables) ? raw.variables : arr(raw.creatureVariables).find(isObj) ?? {}) as Record<string, unknown>
  const props = arr(raw.creatureProperties ?? raw.properties).filter(isObj).filter(p => !p.removed && !p.inactive && !p.disabled)
  const ofType = (t: string) => props.filter(p => p.type === t)
  const v = (name: string) => (isObj(vars[name]) ? (vars[name] as Record<string, unknown>) : undefined)
  const tagged = (tag: string) => props.filter(p => arr(p.tags).some(t => norm(str(t)) === tag))

  const scores: Partial<Abilities> = {}
  for (const a of ABILITIES) {
    const name = ABILITY_NAMES[a]
    const prop = ofType('attribute').find(p => p.variableName === name)
    const val = num(v(name)?.value, NaN)
    const fromProp = prop ? num(prop.value ?? prop.total ?? prop.baseValue, NaN) : NaN
    const s = Number.isNaN(val) ? fromProp : val
    if (!Number.isNaN(s)) scores[a] = s
  }

  const skills: SkillId[] = []
  const expertise: SkillId[] = []
  for (const id of Object.keys(SKILLS) as SkillId[]) {
    const prop = ofType('skill').find(p => p.variableName === id)
    const prof = num(v(id)?.proficiency, num(prop?.proficiency))
    if (prof < 1) continue
    skills.push(id)
    if (prof >= 2) expertise.push(id)
  }

  // A class holds its classLevel children; each classLevel names the class by variableName.
  const levels = ofType('classLevel')
  const classProps = ofType('class')
  const classes: ForeignSheet['classes'] = (classProps.length ? classProps : [...new Map(levels.map(l => [str(l.variableName), l])).values()]).map(c => {
    const key = str(c.variableName)
    const own = levels.filter(l => str(l.variableName) === key || arr(l.ancestors).some(a => isObj(a) && a.id === c._id))
    const level = num(c.level, 0) || Math.max(0, ...own.map(l => num(l.level))) || own.length || 1
    return { name: str(c.name) || key, level }
  })
  const subclass = tagged('subclass')[0]
  if (subclass && classes[0]) classes[0].subclass = str(subclass.name)

  const named = (p: Record<string, unknown>) => str(p.name)
  const race = [...tagged('subrace').map(named), ...tagged('race').map(named), str(v('race')?.value), str(creature.race)].filter(Boolean)
  // Without tags, any folder or feature named after an SRD race counts.
  if (!race.length) race.push(...props.filter(p => p.type === 'folder' || p.type === 'feature').map(named))

  const coins = emptyCoins()
  const items: ForeignSheet['items'] = []
  for (const p of ofType('item')) {
    const qty = Math.max(0, num(p.quantity, 1))
    const coin = COIN_NAMES.find(([re]) => re.test(named(p)) && /piece|coin|^\w+$/i.test(named(p)))
    if (coin) coins[coin[1]] += qty
    else items.push({ name: named(p), qty: Math.max(1, qty), equipped: p.equipped === true })
  }

  const hpProp = ofType('attribute').find(p => p.variableName === 'hitPoints')
  const hpVal = num(v('hitPoints')?.value, NaN)
  const current = Number.isNaN(hpVal) ? (hpProp ? num(hpProp.value ?? num(hpProp.total) - num(hpProp.damage)) : NaN) : hpVal

  // Dicecloud text fields are either strings or { text, value } once computed.
  const text = (x: unknown) => (isObj(x) ? str(x.value) || str(x.text) : str(x))
  const notes = [text(creature.description), ...ofType('note').map(p => [named(p), text(p.summary), text(p.description)].filter(Boolean).join('\n'))]

  return {
    format: 'dicecloud',
    name: str(creature.name),
    alignment: str(creature.alignment),
    xp: num(v('xp')?.value, num(v('experience')?.value)),
    race,
    classes,
    background: named(tagged('background')[0] ?? {}) || undefined,
    scores,
    skills,
    expertise,
    languages: ofType('proficiency').filter(p => allLanguages().some(l => norm(l) === norm(named(p)))).map(named),
    hp: Number.isNaN(current) ? undefined : { current, temp: num(v('tempHP')?.value, num(v('temporaryHitPoints')?.value)) },
    coins,
    items,
    spells: ofType('spell').map(p => ({ name: named(p) })),
    notes: notes.filter(Boolean).join('\n\n'),
  }
}

// ---------- Mapping onto SRD 5.1 ----------

/** Race and subrace for the first name that matches an SRD race, by subrace name, race name, then a name that contains it ("Wood Elf"). */
function matchRace(names: string[]): { raceId: string; subraceId?: string } | undefined {
  const races = [...allRaces('2014')].sort((a, b) => b.name.length - a.name.length)
  for (const n of names.map(norm).filter(Boolean)) {
    for (const r of races) {
      const sub = r.subraces?.find(s => norm(s.name) === n || norm(s.id) === n)
      if (sub) return { raceId: r.id, subraceId: sub.id }
      if (norm(r.name) === n || norm(r.id) === n) return { raceId: r.id }
    }
  }
  for (const n of names.map(norm).filter(Boolean)) {
    const r = races.find(r => n.includes(norm(r.name)))
    if (r) return { raceId: r.id, subraceId: r.subraces?.find(s => n.includes(norm(s.name)))?.id }
  }
  return undefined
}

const matchClass = (name: string) => classById(name.toLowerCase()) ?? classesFor('2014').find(c => norm(c.name) === norm(name))

/** Engine item by name: "Leather Armor" → leather, "Longsword" → longsword. */
function matchItem(name: string) {
  const n = norm(name.replace(/\(.*?\)/g, ''))
  const bare = n.replace(/armou?r$/, '')
  return ITEMS.find(i => norm(i.name) === n || norm(i.id) === n || (bare && (norm(i.name) === bare || norm(i.id) === bare)))
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Maps a ForeignSheet onto a Forge & Familiar character (SRD 5.1). Returns an error message or the character. */
export function toCharacter(s: ForeignSheet, lookups: ForeignLookups = {}, now = new Date()): string | Character {
  const from = FORMAT_NAMES[s.format]
  if (!s.name) return `This ${from} file has no character name.`
  const unmatched: string[] = []

  const classes = []
  for (const cl of s.classes) {
    const def = matchClass(cl.name)
    if (!def) return `Class "${cl.name}" is not in the SRD, so Forge & Familiar cannot import it.`
    const sub = cl.subclass ? subclassesFor(def.id).find(x => norm(x.name) === norm(cl.subclass!) || norm(x.id) === norm(cl.subclass!)) : undefined
    if (cl.subclass && !sub) unmatched.push(`Subclass: ${cl.subclass}`)
    classes.push({ classId: def.id, level: Math.min(20, Math.max(1, Math.round(cl.level))), ...(sub ? { subclassId: sub.id } : {}) })
  }
  if (!classes.length) return `This ${from} file has no class.`

  let race = matchRace(s.race)
  if (!race) {
    race = { raceId: 'human' }
    unmatched.push(`Race: ${s.race[0] || 'none given'} (imported as Human, change it in Edit)`)
  }

  const bg = s.background ? backgroundsFor('2014').find(b => norm(b.name) === norm(s.background!)) : undefined
  const customBackground = bg ? undefined : { name: s.background ?? '', feature: '', skills: [], tools: [], languages: [] }

  // The file holds final scores; the app stores scores before racial bonuses.
  const bonus = racialBonuses({ raceId: race.raceId, subraceId: race.subraceId, freeAbilityBonuses: [], backgroundId: bg?.id ?? CUSTOM_BACKGROUND })
  const baseAbilities = {} as Abilities
  for (const a of ABILITIES) baseAbilities[a] = Math.min(30, Math.max(1, Math.round(s.scores[a] ?? 10) - bonus[a]))

  const raceDef = allRaces('2014').find(r => r.id === race.raceId)
  const chosenSkills = s.skills.filter(sk => !raceDef?.skillProficiencies?.includes(sk))
  if (s.expertise.length) unmatched.push(`Expertise: ${s.expertise.map(sk => SKILLS[sk].name).join(', ')}`)

  const chosenLanguages: string[] = []
  for (const l of s.languages) {
    const known = allLanguages().find(x => norm(x) === norm(l))
    if (known && !raceDef?.languages.includes(known)) chosenLanguages.push(known)
    else if (!known) unmatched.push(`Language: ${l}`)
  }

  const inventory: InventoryEntry[] = s.items.filter(i => i.name).map((i, n) => {
    const item = matchItem(i.name)
    const base = { uid: `inv-import-${n}`, qty: i.qty, equipped: i.equipped }
    return item ? { ...base, itemId: item.id } : { ...base, itemId: `import-${slug(i.name)}`, item: { kind: 'gear', id: `import-${slug(i.name)}`, name: i.name, weight: 0 } }
  })

  // The app keeps gp, sp and cp: platinum becomes gold, electrum silver.
  const coins = { gp: s.coins.gp + s.coins.pp * 10, sp: s.coins.sp + s.coins.ep * 5, cp: s.coins.cp }

  const spells: KnownSpell[] = []
  for (const sp of s.spells) {
    const id = lookups.spellIds?.get(sp.name.toLowerCase())
    if (!id) {
      unmatched.push(`Spell: ${sp.name}`)
      continue
    }
    const classId = (sp.className && matchClass(sp.className)?.id) || classes[0].classId
    if (!spells.some(x => x.id === id && x.classId === classId)) spells.push({ id, classId })
  }

  const notes = [
    s.notes,
    `Imported from ${from} on ${now.toISOString().slice(0, 10)}.`,
    unmatched.length ? `Not matched to the SRD, add these by hand:\n${unmatched.map(u => `- ${u}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')

  const stamp = now.toISOString()
  const draft = {
    id: '', ownerId: '', schemaVersion: CHARACTER_SCHEMA_VERSION,
    name: s.name, playerName: '', alignment: s.alignment, xp: Math.max(0, Math.round(s.xp)),
    raceId: race.raceId, ...(race.subraceId ? { subraceId: race.subraceId } : {}),
    backgroundId: bg?.id ?? CUSTOM_BACKGROUND, ...(customBackground ? { customBackground } : {}),
    classes, abilityMethod: 'manual', baseAbilities, freeAbilityBonuses: [], chosenSkills, chosenLanguages,
    inventory, coins, notes, spells, createdAt: stamp, updatedAt: stamp,
  } as unknown as Character
  const max = getMaxHp(draft)
  const state = freshState(max)
  if (s.hp) {
    state.currentHp = Math.min(max, Math.max(0, Math.round(s.hp.current)))
    state.tempHp = Math.max(0, Math.round(s.hp.temp))
  }
  return checkCharacter({ ...draft, state })
}

/** Parses a Foundry or Dicecloud JSON object into a character file with no snapshots. */
export function parseForeign(raw: unknown, lookups: ForeignLookups = {}, now = new Date()): ParseResult & { format?: ForeignFormat } {
  const format = detectForeign(raw)
  if (!format || !isObj(raw)) return { ok: false, error: NOT_A_CHARACTER }
  const sheet = format === 'foundry' ? readFoundry(raw) : readDicecloud(raw)
  const character = toCharacter(sheet, lookups, now)
  if (typeof character === 'string') return { ok: false, error: character }
  return { ok: true, format, file: { format: FILE_FORMAT, version: FILE_VERSION, exportedAt: now.toISOString(), character, snapshots: [] } }
}

// Turns 5e-bits/5e-database JSON (SRD 5.1 under src/2014, SRD 5.2 under src/2024) into the content model.
// Pure functions: the ingest script does the fetching and writing. Both editions go through the same code;
// where their shapes differ (desc arrays vs description strings, Races vs Species) each helper handles both.
import type {
  Abilities, Ability, Armor, Background, CharacterClass, Choice, ChoiceOption, ClassLevel, Condition, ContentEntryByKind,
  ContentKind, Equipment, EquipmentType, Feat, Feature, GlossaryEntry, Language, MagicItem, Money, Monster, MonsterAction,
  Proficiency, Race, Rarity, Ref, Size, SourceInfo, Spell, SpellSchool, Subclass, Subrace, Trait, Weapon,
} from '../types.ts'
import type { UpstreamName } from './sources.ts'

// Upstream JSON is loosely shaped and differs per edition, so it is read as `any` and checked field by field.
type Raw = any
export type UpstreamFiles = Partial<Record<UpstreamName, Raw[]>>

interface Ctx {
  source: SourceInfo
}

const base = (r: Raw, ctx: Ctx) => ({ id: String(r.index), name: String(r.name), source: ctx.source.id, edition: ctx.source.edition })

export const ref = (r: Raw): Ref => ({ id: String(r.index), name: String(r.name) })
const refs = (a: Raw): Ref[] => (Array.isArray(a) ? a.map(ref) : [])
const ids = (a: Raw): string[] => (Array.isArray(a) ? a.map(r => String(r.index)) : [])

const ABILITY_IDS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const ability = (r: Raw): Ability => {
  const id = String(r?.index ?? r).toLowerCase()
  if (!ABILITY_IDS.has(id)) throw new Error(`Unknown ability ${JSON.stringify(r)}`)
  return id as Ability
}

/**
 * Upstream text is a paragraph array (2014) or one string (2024). Returns markdown: paragraphs split by a blank line,
 * consecutive list items and table rows kept on adjacent lines so they render as one list or table.
 */
export function text(v: Raw): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  const lines: string[] = (v as unknown[]).map(x => String(x).trim()).filter(Boolean)
  const block = (l: string) => /^([-*]\s|\|)/.test(l)
  return lines.reduce((out, l, i) => (i === 0 ? l : out + (block(l) && block(lines[i - 1]) ? '\n' : '\n\n') + l), '')
}

const optText = (v: Raw) => text(v) || undefined

const money = (r: Raw): Money | undefined => (r && typeof r.quantity === 'number' ? { qty: r.quantity, unit: r.unit } : undefined)

const bonuses = (a: Raw): Partial<Abilities> => {
  const out: Partial<Abilities> = {}
  for (const b of Array.isArray(a) ? a : []) out[ability(b.ability_score)] = b.bonus
  return out
}

/** Upstream "option sets": options_array, equipment_category and resource_list. */
export function choice(r: Raw): Choice {
  const from = r.from ?? {}
  let options: ChoiceOption[]
  if (from.option_set_type === 'equipment_category') options = [{ kind: 'category', category: ref(from.equipment_category) }]
  else if (from.option_set_type === 'resource_list') options = [{ kind: 'category', category: { id: String(from.resource_list_url).split('/').pop()!, name: r.type } }]
  else options = (from.options ?? []).map(option)
  const c: Choice = { choose: Number(r.choose ?? 1), options }
  const description = r.desc ?? r.description
  if (description) c.description = String(description)
  return c
}

function option(o: Raw): ChoiceOption {
  switch (o.option_type) {
    case 'reference': return { kind: 'ref', ref: ref(o.item), count: 1 }
    case 'counted_reference': return { kind: 'ref', ref: ref(o.of), count: Number(o.count ?? 1) }
    case 'multiple': return { kind: 'all', options: (o.items ?? []).map(option) }
    case 'choice': return { kind: 'choice', choice: choice(o.choice) }
    case 'money': return { kind: 'money', money: { qty: Number(o.count), unit: o.unit } }
    case 'ability_bonus': return { kind: 'ability', ability: ability(o.ability_score), amount: Number(o.bonus) }
    case 'score_prerequisite': return { kind: 'ability', ability: ability(o.ability_score), amount: Number(o.minimum_score) }
    case 'string': return { kind: 'text', text: String(o.string) }
    case 'ideal': return { kind: 'text', text: String(o.desc) }
    case 'action': return { kind: 'text', text: String(o.action_name) }
    case 'size': return { kind: 'text', text: String(o.size) }
    default: return { kind: 'other', raw: o }
  }
}

const choices = (...rs: Raw[]): Choice[] => rs.flat().filter(Boolean).map(choice)

const counted = (a: Raw) => (Array.isArray(a) ? a.map(e => ({ item: ref(e.equipment ?? e.item), qty: Number(e.quantity ?? 1) })) : [])

// ---------- Spells ----------

const one = (v: Raw) => (Array.isArray(v) ? v[0] : v)
const levelMap = (m: Raw): Record<number, string> | undefined =>
  m ? Object.fromEntries(Object.entries(m).map(([k, v]) => [Number(k), String(v)])) : undefined

export function spell(r: Raw, ctx: Ctx): Spell {
  const comps: string[] = r.components ?? []
  const s: Spell = {
    ...base(r, ctx),
    level: Number(r.level),
    school: String(r.school.index) as SpellSchool,
    castingTime: r.casting_time,
    range: r.range,
    components: { v: comps.includes('V'), s: comps.includes('S'), m: comps.includes('M') },
    duration: r.duration,
    concentration: !!r.concentration,
    ritual: !!r.ritual,
    classes: ids(r.classes),
    subclasses: ids(r.subclasses),
    description: text(r.description ?? r.desc),
  }
  if (r.material) s.components.material = r.material
  const higher = optText(r.higher_level)
  if (higher) s.higherLevels = higher
  if (r.attack_type) s.attack = r.attack_type
  if (r.dc) s.save = { ability: ability(r.dc.dc_type), onSuccess: r.dc.dc_success === 'half' || r.dc.dc_success === 'none' ? r.dc.dc_success : 'other' }
  const dmg = one(r.damage)
  if (dmg) {
    s.damage = {}
    if (dmg.damage_type) s.damage.type = dmg.damage_type.index
    if (dmg.damage_at_slot_level) s.damage.bySlotLevel = levelMap(dmg.damage_at_slot_level)
    if (dmg.damage_at_character_level) s.damage.byCharacterLevel = levelMap(dmg.damage_at_character_level)
    // 2024 cantrips list their base damage under slot level 0; it is the level 1 damage.
    if (s.level === 0 && s.damage.bySlotLevel && !s.damage.byCharacterLevel) {
      s.damage.byCharacterLevel = { 1: s.damage.bySlotLevel[0] }
      delete s.damage.bySlotLevel
    }
  }
  if (r.heal_at_slot_level) s.healBySlotLevel = levelMap(r.heal_at_slot_level)
  if (r.area_of_effect) s.area = { shape: r.area_of_effect.type, size: Number(r.area_of_effect.size) }
  return s
}

// ---------- Equipment ----------

const slug = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function equipmentCategories(r: Raw): string[] {
  if (Array.isArray(r.equipment_categories)) return ids(r.equipment_categories)
  const out: string[] = []
  if (r.category_range) out.push(`${slug(r.category_range)}-weapons`)
  if (r.armor_category) out.push(r.armor_category === 'Shield' ? 'shields' : `${slug(r.armor_category)}-armor`)
  if (r.tool_category) out.push(slug(r.tool_category))
  if (r.gear_category) out.push(r.gear_category.index)
  if (r.equipment_category) out.push(r.equipment_category.index)
  return out
}

function equipmentType(r: Raw, cats: string[]): EquipmentType {
  if (r.damage || r.weapon_category || cats.includes('weapons') || cats.includes('weapon')) return 'weapon'
  if (r.armor_class) return 'armor'
  if (cats.includes('mounts-and-vehicles')) return /mount/i.test(r.vehicle_category ?? '') ? 'mount' : 'vehicle'
  if (cats.includes('tools')) return 'tool'
  return 'gear'
}

function weapon(r: Raw, cats: string[]): Weapon {
  const ranged = r.weapon_range ? r.weapon_range === 'Ranged' : cats.includes('ranged-weapons')
  const martial = r.weapon_category ? r.weapon_category === 'Martial' : cats.includes('martial-weapons')
  const w: Weapon = { category: martial ? 'martial' : 'simple', range: ranged ? 'ranged' : 'melee', properties: ids(r.properties) }
  if (r.damage?.damage_dice) w.damage = { dice: r.damage.damage_dice, type: r.damage.damage_type?.index ?? '' }
  if (r.two_handed_damage) w.versatileDamage = r.two_handed_damage.damage_dice
  const far = ranged ? r.range : r.throw_range
  if (!ranged && r.range?.normal) w.reach = r.range.normal
  if (far?.normal) w.normalRange = far.normal
  if (far?.long) w.longRange = far.long
  if (r.ammunition) w.ammunition = r.ammunition.index
  if (r.mastery) w.mastery = r.mastery.index
  return w
}

function armor(r: Raw, cats: string[]): Armor {
  const category: Armor['category'] = r.armor_category
    ? (r.armor_category.toLowerCase() as Armor['category'])
    : cats.includes('shields') ? 'shield' : cats.includes('heavy-armor') ? 'heavy' : cats.includes('medium-armor') ? 'medium' : 'light'
  const a: Armor = { category, baseAc: Number(r.armor_class.base), dexBonus: !!r.armor_class.dex_bonus, stealthDisadvantage: !!r.stealth_disadvantage }
  if (a.dexBonus && r.armor_class.max_bonus != null) a.maxDexBonus = r.armor_class.max_bonus
  if (r.str_minimum) a.strMinimum = r.str_minimum
  if (r.don_time) a.donTime = r.don_time
  if (r.doff_time) a.doffTime = r.doff_time
  return a
}

export function equipment(r: Raw, ctx: Ctx): Equipment {
  const categories = equipmentCategories(r)
  const type = equipmentType(r, categories)
  const e: Equipment = { ...base(r, ctx), type, categories }
  const cost = money(r.cost)
  if (cost) e.cost = cost
  if (typeof r.weight === 'number') e.weight = r.weight
  const description = optText(r.description ?? r.desc)
  if (description) e.description = description
  if (type === 'weapon') e.weapon = weapon(r, categories)
  if (type === 'armor') e.armor = armor(r, categories)
  if (r.contents) e.contents = counted(r.contents)
  if (r.quantity > 1) e.bundleSize = r.quantity
  if (r.craft || r.ability) e.tool = { ...(r.ability ? { ability: ability(r.ability) } : {}), crafts: refs(r.craft) }
  if (r.speed) e.speed = `${r.speed.quantity} ${r.speed.unit}`
  if (r.capacity) e.capacity = r.capacity
  return e
}

// ---------- Magic items ----------

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']

export function magicItem(r: Raw, ctx: Ctx, parentOf: Map<string, string>): MagicItem {
  const raw = String(r.rarity?.name ?? '').toLowerCase()
  const rarity: Rarity = RARITIES.includes(raw as Rarity) ? (raw as Rarity) : 'varies'
  const description = text(r.desc ?? r.description)
  const firstLine = description.split('\n')[0]
  const attune = /\(requires attunement(?:\s+by\s+([^)]*))?\)/i.exec(firstLine)
  const m: MagicItem = {
    ...base(r, ctx),
    category: r.equipment_category?.index ?? 'wondrous-items',
    rarity,
    attunement: attune ? (attune[1]?.trim() || true) : !!r.attunement,
    description,
    variants: refs(r.variants),
  }
  if (rarity === 'varies' || RARITIES.every(x => x !== raw)) m.rarityText = r.rarity?.name
  const parent = parentOf.get(m.id)
  if (parent) m.variantOf = parent
  return m
}

// ---------- Classes, subclasses, features ----------

const levelOf = (r: Raw): number => (typeof r === 'number' ? r : Number(/(\d+)$/.exec(String(r?.index ?? ''))?.[1] ?? 0))

function classLevel(r: Raw, previousAsi: number): ClassLevel {
  const sc = r.spellcasting
  const asiFeature = (r.features ?? []).some((f: Raw) => /^(ability-score-improvement|.*-ability-score-improvement(-\d+)?)$/.test(f.index) || f.name === 'Ability Score Improvement')
  const l: ClassLevel = {
    level: Number(r.level),
    proficiencyBonus: Number(r.prof_bonus ?? 0),
    features: ids(r.features),
    abilityScoreImprovement: typeof r.ability_score_bonuses === 'number' ? r.ability_score_bonuses > previousAsi : asiFeature,
    classSpecific: r.class_specific ?? {},
  }
  if (sc) {
    l.spellcasting = { slots: Array.from({ length: 9 }, (_, i) => Number(sc[`spell_slots_level_${i + 1}`] ?? 0)) }
    if (sc.cantrips_known != null) l.spellcasting.cantripsKnown = sc.cantrips_known
    if (sc.spells_known != null) l.spellcasting.spellsKnown = sc.spells_known
    if (sc.prepared_spells != null) l.spellcasting.preparedSpells = sc.prepared_spells
  }
  return l
}

export function characterClass(r: Raw, ctx: Ctx, levels: Raw[]): CharacterClass {
  const mc = r.multi_classing ?? {}
  const prereqs: Raw[] = mc.prerequisites ?? mc.prerequisite_options?.from?.options ?? []
  const own = levels.filter(l => l.class?.index === r.index && !l.subclass).sort((a, b) => a.level - b.level)
  let asi = 0
  const classLevels = own.map(l => {
    const out = classLevel(l, asi)
    if (typeof l.ability_score_bonuses === 'number') asi = l.ability_score_bonuses
    return out
  })
  const c: CharacterClass = {
    ...base(r, ctx),
    hitDie: Number(r.hit_die),
    primaryAbilities: r.primary_ability
      ? (r.primary_ability.ability_scores ?? r.primary_ability.ability_score_options?.from?.options.map((o: Raw) => o.item) ?? []).map(ability)
      : prereqs.map(p => ability(p.ability_score)),
    savingThrows: (r.saving_throws ?? []).map(ability),
    proficiencies: refs(r.proficiencies).filter(p => !p.id.startsWith('saving-throw-')),
    proficiencyChoices: choices(r.proficiency_choices),
    startingEquipment: counted(r.starting_equipment),
    startingEquipmentChoices: choices(r.starting_equipment_options),
    multiclass: {
      prerequisites: prereqs.map(p => ({ ability: ability(p.ability_score), minimum: Number(p.minimum_score) })),
      anyOf: !!mc.prerequisite_options,
      proficiencies: refs(mc.proficiencies),
      proficiencyChoices: choices(mc.proficiency_choices),
    },
    subclasses: refs(r.subclasses),
    levels: classLevels,
  }
  if (r.spellcasting) {
    c.spellcasting = {
      ability: ability(r.spellcasting.spellcasting_ability),
      fromLevel: Number(r.spellcasting.level ?? 1),
      info: (r.spellcasting.info ?? []).map((i: Raw) => ({ name: i.name, description: text(i.desc) })),
    }
  }
  return c
}

/** 2024 subclass features have no id upstream unless Features lists them; this is the id they get then. */
const inlineFeatureId = (subclassId: string, name: string) => `${subclassId}-${slug(name)}`

/** Splits a 2024 inline feature's name from description text that leaked into it ("Circle of the Land Spells Whenever…"). */
function inlineFeatureName(name: string): string {
  const m = /^(.*? Spells)\s+[A-Z].*$/.exec(name)
  return m ? m[1] : name
}

export function subclass(r: Raw, ctx: Ctx, files: UpstreamFiles): Subclass {
  const s: Subclass = {
    ...base(r, ctx),
    classId: r.class.index,
    description: text(r.description ?? r.desc),
    features: [],
    spells: (r.spells ?? []).map((sp: Raw) => ({ level: levelOf(sp.prerequisites?.find((p: Raw) => p.type === 'level')), spell: ref(sp.spell) })),
  }
  if (r.subclass_flavor) s.flavor = r.subclass_flavor
  if (r.summary) s.summary = r.summary
  if (Array.isArray(r.features)) {
    // 2024: features are inline. Reuse the Features id when one exists so links stay stable.
    const listed = (files.Features ?? []).filter(f => f.subclass?.index === r.index)
    s.features = r.features.map((f: Raw) => {
      const name = inlineFeatureName(f.name)
      const hit = listed.find(x => x.name === name)
      return { level: Number(f.level), feature: { id: hit ? hit.index : inlineFeatureId(r.index, name), name } }
    })
  } else {
    // 2014: features come from the subclass's rows in Levels.
    for (const l of files.Levels ?? []) {
      if (l.subclass?.index !== r.index) continue
      for (const f of l.features ?? []) s.features.push({ level: Number(l.level), feature: ref(f) })
    }
    s.features.sort((a, b) => a.level - b.level)
  }
  return s
}

export function feature(r: Raw, ctx: Ctx): Feature {
  const fs = r.feature_specific ?? {}
  const f: Feature = {
    ...base(r, ctx),
    classId: r.class.index,
    level: levelOf(r.level),
    description: text(r.description ?? r.desc),
    choices: choices(...Object.entries(fs).filter(([k, v]) => k.endsWith('_options') && v).map(([, v]) => v)),
    subfeatures: refs(fs.invocations),
  }
  if (r.subclass) f.subclassId = r.subclass.index
  if (r.parent) f.parentId = r.parent.index
  return f
}

/** 2024 subclass features that are only listed inline on the subclass. */
export function inlineSubclassFeatures(subclasses: Raw[], features: Raw[], ctx: Ctx): Feature[] {
  const known = new Set(features.map(f => `${f.subclass?.index}|${f.name}`))
  const out: Feature[] = []
  for (const s of subclasses) {
    for (const f of Array.isArray(s.features) ? s.features : []) {
      const name = inlineFeatureName(f.name)
      if (known.has(`${s.index}|${name}`)) continue
      const leaked = f.name.length > name.length ? f.name.slice(name.length).trim() : ''
      out.push({
        id: inlineFeatureId(s.index, name),
        name,
        source: ctx.source.id,
        edition: ctx.source.edition,
        classId: s.class.index,
        subclassId: s.index,
        level: Number(f.level),
        description: [leaked, text(f.description)].filter(Boolean).join('\n\n'),
        choices: [],
        subfeatures: [],
      })
    }
  }
  return out
}

// ---------- Races, subraces, traits ----------

const SIZES: Size[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']
const size = (s: Raw): Size => {
  const hit = SIZES.find(x => x.toLowerCase() === String(s).toLowerCase())
  if (!hit) throw new Error(`Unknown size ${s}`)
  return hit
}

export function race(r: Raw, ctx: Ctx): Race {
  const sizeOptions: Raw[] = r.size_options?.from?.options ?? []
  const x: Race = {
    ...base(r, ctx),
    sizes: r.size ? [size(r.size)] : sizeOptions.map(o => size(o.size)),
    speed: Number(r.speed),
    abilityBonuses: bonuses(r.ability_bonuses),
    abilityBonusChoices: choices(r.ability_bonus_options),
    languages: refs(r.languages),
    languageChoices: choices(r.language_options),
    traits: refs(r.traits),
    subraces: refs(r.subraces ?? r.subspecies),
  }
  if (r.type) x.creatureType = r.type
  if (r.age) x.age = r.age
  if (r.alignment) x.alignment = r.alignment
  if (r.size_description) x.sizeDescription = r.size_description
  if (r.language_desc) x.languageDescription = r.language_desc
  return x
}

export function subrace(r: Raw, ctx: Ctx): Subrace {
  const s: Subrace = {
    ...base(r, ctx),
    raceId: (r.race ?? r.species).index,
    abilityBonuses: bonuses(r.ability_bonuses),
    traits: refs(r.racial_traits ?? r.traits),
  }
  const description = optText(r.desc ?? r.description)
  if (description) s.description = description
  if (r.damage_type) s.damageType = r.damage_type.index
  return s
}

export function trait(r: Raw, ctx: Ctx): Trait {
  const ts = r.trait_specific ?? {}
  const t: Trait = {
    ...base(r, ctx),
    description: text(r.description ?? r.desc),
    races: ids(r.races ?? r.species),
    subraces: ids(r.subraces ?? r.subspecies),
    proficiencies: refs(r.proficiencies),
    choices: choices(r.proficiency_choices, r.language_options, ts.spell_options, ts.subtrait_options),
    spells: (r.spells ?? []).map((s: Raw) => ({ spell: ref(s.spell), ...(s.uses ? { uses: String(s.uses) } : {}), ...(s.recovery ? { recovery: String(s.recovery) } : {}) })),
  }
  if (r.parent) t.parentId = r.parent.index
  if (ts.damage_type) t.damageType = ts.damage_type.index
  if (typeof r.speed === 'number') t.speed = r.speed
  return t
}

// ---------- Feats, backgrounds, conditions ----------

export function feat(r: Raw, ctx: Ctx): Feat {
  const fromList: Raw[] = Array.isArray(r.prerequisites) ? r.prerequisites : []
  const fromOptions: Raw[] = r.prerequisite_options?.from?.options ?? []
  const p = Array.isArray(r.prerequisites) ? {} : r.prerequisites ?? {}
  const f: Feat = {
    ...base(r, ctx),
    prerequisites: {
      abilities: [...fromList, ...fromOptions].filter(x => x.ability_score).map(x => ({ ability: ability(x.ability_score), minimum: Number(x.minimum_score) })),
      anyAbility: fromOptions.length > 0,
      ...(p.minimum_level ? { minimumLevel: Number(p.minimum_level) } : {}),
      ...(p.feature_named ? { feature: String(p.feature_named) } : {}),
    },
    repeatable: !!r.repeatable,
    description: text(r.description ?? r.desc),
  }
  if (r.type) f.category = r.type
  return f
}

export function background(r: Raw, ctx: Ctx): Background {
  const b: Background = {
    ...base(r, ctx),
    abilityScores: (r.ability_scores ?? []).map(ability),
    proficiencies: refs(r.proficiencies ?? r.starting_proficiencies),
    proficiencyChoices: choices(r.proficiency_choices),
    languageChoices: choices(r.language_options),
    startingEquipment: counted(r.starting_equipment),
    startingEquipmentChoices: choices(r.equipment_options ?? r.starting_equipment_options),
  }
  if (r.feat) b.feat = { ...ref(r.feat), ...(r.feat.note ? { note: r.feat.note } : {}) }
  const gold = money(r.starting_gold)
  if (gold) b.startingGold = gold
  if (r.feature) b.feature = { name: r.feature.name, description: text(r.feature.desc) }
  if (r.personality_traits) {
    b.personality = { traits: choice(r.personality_traits), ideals: choice(r.ideals), bonds: choice(r.bonds), flaws: choice(r.flaws) }
  }
  return b
}

export const condition = (r: Raw, ctx: Ctx): Condition => ({ ...base(r, ctx), description: text(r.description ?? r.desc) })

// ---------- Monsters ----------

function action(a: Raw): MonsterAction {
  const out: MonsterAction = { name: a.name, description: text(a.desc ?? a.description), damage: [] }
  if (typeof a.attack_bonus === 'number') out.attackBonus = a.attack_bonus
  for (const d of a.damage ?? []) {
    if (d.damage_dice) out.damage.push({ dice: d.damage_dice, type: d.damage_type?.index ?? '' })
    else if (d.from?.options) out.damageChoice = d.from.options.map((o: Raw) => ({ dice: o.damage_dice, type: o.damage_type?.index ?? '' }))
  }
  if (a.dc?.dc_type) out.save = { ability: ability(a.dc.dc_type), dc: Number(a.dc.dc_value), onSuccess: a.dc.success_type ?? 'none' }
  const u = a.usage
  if (u?.type === 'per day') out.usage = { type: 'per day', times: Number(u.times), ...(u.times_in_lair ? { timesInLair: Number(u.times_in_lair) } : {}) }
  else if (u?.type === 'recharge on roll') out.usage = { type: 'recharge', dice: u.dice, minimum: Number(u.min_value) }
  else if (u?.type === 'recharge after rest') out.usage = { type: 'per rest', rests: u.rest_types ?? [] }
  return out
}
const actions = (a: Raw): MonsterAction[] => (Array.isArray(a) ? a.map(action) : [])

const damageList = (a: Raw): string[] => (Array.isArray(a) ? a.map(x => (typeof x === 'string' ? x : String(x.index ?? x.name))) : [])

export function monster(r: Raw, ctx: Ctx): Monster {
  const saves: Monster['savingThrows'] = {}
  const skills: Monster['skills'] = {}
  for (const p of r.proficiencies ?? []) {
    const id: string = p.proficiency.index
    if (id.startsWith('saving-throw-')) saves[ability(id.slice('saving-throw-'.length))] = p.value
    else if (id.startsWith('skill-')) skills[id.slice('skill-'.length)] = p.value
  }
  const m: Monster = {
    ...base(r, ctx),
    sizes: String(r.size).split(/\s+or\s+/).map(size),
    type: r.type,
    alignment: r.alignment,
    armorClass: (r.armor_class ?? []).map((ac: Raw) => {
      const note = ac.desc ?? (ac.armor ? ac.armor.map((x: Raw) => x.name).join(', ') : ac.spell?.name ?? ac.condition?.name)
      return { value: Number(ac.value), ...(ac.type ? { type: ac.type } : {}), ...(note ? { note } : {}) }
    }),
    hitPoints: Number(r.hit_points),
    hitDice: r.hit_dice,
    hitPointsRoll: String(r.hit_points_roll ?? r.hit_dice).replace(/\s+/g, ''),
    speed: { ...r.speed },
    abilities: { str: r.strength, dex: r.dexterity, con: r.constitution, int: r.intelligence, wis: r.wisdom, cha: r.charisma },
    savingThrows: saves,
    skills,
    damageVulnerabilities: damageList(r.damage_vulnerabilities),
    damageResistances: damageList(r.damage_resistances),
    damageImmunities: damageList(r.damage_immunities),
    conditionImmunities: damageList(r.condition_immunities),
    senses: { ...r.senses },
    languages: r.languages ?? '',
    challengeRating: Number(r.challenge_rating),
    xp: Number(r.xp ?? 0),
    proficiencyBonus: Number(r.proficiency_bonus ?? 0),
    traits: actions(r.special_abilities),
    actions: actions(r.actions),
    bonusActions: actions(r.bonus_actions),
    reactions: actions(r.reactions),
    legendaryActions: actions(r.legendary_actions),
    forms: refs(r.forms),
  }
  if (r.subtype) m.subtype = r.subtype
  if (r.xp_in_lair) m.xpInLair = Number(r.xp_in_lair)
  const description = optText(r.desc)
  if (description) m.description = description
  return m
}

// ---------- Languages, proficiencies, glossary ----------

export function language(r: Raw, ctx: Ctx): Language {
  const l: Language = { ...base(r, ctx), speakers: Array.isArray(r.typical_speakers) ? r.typical_speakers : [] }
  if (r.type) l.type = String(r.type).toLowerCase() as Language['type']
  else if (typeof r.is_rare === 'boolean') l.type = r.is_rare ? 'rare' : 'standard'
  if (r.script) l.script = r.script
  const description = optText(r.desc ?? r.note)
  if (description) l.description = description
  return l
}

export function proficiency(r: Raw, ctx: Ctx): Proficiency {
  const p: Proficiency = {
    ...base(r, ctx),
    type: r.type,
    classes: ids(r.classes),
    races: ids(r.races),
    backgrounds: ids(r.backgrounds),
  }
  if (r.reference) {
    // "/api/2014/equipment-categories/light-armor" → kind "equipment-categories"
    const kind = String(r.reference.url ?? '').split('/').slice(-2, -1)[0] ?? ''
    p.reference = { ...ref(r.reference), kind }
  }
  return p
}

const GLOSSARY: [UpstreamName, GlossaryEntry['group']][] = [
  ['Ability-Scores', 'ability'], ['Skills', 'skill'], ['Alignments', 'alignment'], ['Damage-Types', 'damage-type'],
  ['Magic-Schools', 'magic-school'], ['Weapon-Properties', 'weapon-property'], ['Weapon-Mastery-Properties', 'weapon-mastery'],
]

export function glossary(files: UpstreamFiles, ctx: Ctx): GlossaryEntry[] {
  return GLOSSARY.flatMap(([file, group]) =>
    (files[file] ?? []).map(r => {
      const g: GlossaryEntry = {
        ...base(r, ctx),
        id: `${group}/${r.index}`,
        name: r.full_name ?? r.name,
        group,
        description: text(r.description ?? r.desc),
      }
      if (r.ability_score) g.ability = ability(r.ability_score)
      if (r.abbreviation) g.abbreviation = r.abbreviation
      else if (group === 'ability') g.abbreviation = r.name
      return g
    }),
  )
}

// ---------- Everything ----------

export type NormalizedContent = { [K in ContentKind]: ContentEntryByKind[K][] }

const byName = <T extends { name: string }>(a: T[]) => a.sort((x, y) => x.name.localeCompare(y.name))

/** Normalizes every kind from the upstream files of one edition. Missing files give empty kinds. */
export function normalizeAll(files: UpstreamFiles, source: SourceInfo): NormalizedContent {
  const ctx: Ctx = { source }
  const all = (name: UpstreamName) => files[name] ?? []
  const parentOf = new Map<string, string>()
  for (const m of all('Magic-Items')) for (const v of m.variants ?? []) parentOf.set(v.index, m.index)

  const out: NormalizedContent = {
    spells: byName(all('Spells').map(r => spell(r, ctx))),
    equipment: byName(all('Equipment').map(r => equipment(r, ctx))),
    'magic-items': byName(all('Magic-Items').map(r => magicItem(r, ctx, parentOf))),
    classes: byName(all('Classes').map(r => characterClass(r, ctx, all('Levels')))),
    subclasses: byName(all('Subclasses').map(r => subclass(r, ctx, files))),
    features: [...all('Features').map(r => feature(r, ctx)), ...inlineSubclassFeatures(all('Subclasses'), all('Features'), ctx)]
      .sort((a, b) => a.classId.localeCompare(b.classId) || a.level - b.level || a.name.localeCompare(b.name)),
    races: byName([...all('Races'), ...all('Species')].map(r => race(r, ctx))),
    subraces: byName([...all('Subraces'), ...all('Subspecies')].map(r => subrace(r, ctx))),
    traits: byName(all('Traits').map(r => trait(r, ctx))),
    feats: byName(all('Feats').map(r => feat(r, ctx))),
    backgrounds: byName(all('Backgrounds').map(r => background(r, ctx))),
    conditions: byName(all('Conditions').map(r => condition(r, ctx))),
    monsters: byName(all('Monsters').map(r => monster(r, ctx))),
    languages: byName(all('Languages').map(r => language(r, ctx))),
    proficiencies: byName(all('Proficiencies').map(r => proficiency(r, ctx))),
    glossary: glossary(files, ctx),
  }
  return out
}

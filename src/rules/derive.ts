import type { Character, HitDie } from '../model/character'
import { getAbilityMods, getAbilityScores } from './abilities'
import { featBonus, getFeats, getLanguages, getTools } from './choices'
import { getBackground } from './data/backgrounds'
import { classById } from './data/classes'
import { entryItem } from './data/items'
import { NON_STACKING_RESOURCES } from './data/multiclass'
import { raceById } from './data/races'
import { subclassById, type SubclassDef } from './data/subclasses'
import { ALL_SKILLS, SKILLS } from './data/skills'
import { itemBonus } from './itemEffects'
import { getCasterLevel, getProficiencies, multiclassWarnings } from './multiclass'
import { ABILITIES, type Abilities, type Ability, type ClassDef, type InventoryEntry, type Item, type RestType, type SkillId } from './types'

type Weapon = Extract<Item, { kind: 'weapon' }>
type Armor = Extract<Item, { kind: 'armor' }>

const classesOf = (c: Character) =>
  c.classes.flatMap(cl => {
    const def = classById(cl.classId)
    if (!def) return []
    const sub = cl.subclassId ? subclassById(cl.subclassId) : undefined
    const subclass: SubclassDef | undefined = sub?.classId === cl.classId && cl.level >= def.subclassLevel ? sub : undefined
    return [{ def, level: cl.level, subclass }]
  })

export const totalLevel = (c: Character) => c.classes.reduce((n, cl) => n + cl.level, 0)

export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4)

// ---------- Hit points ----------

/** Max HP before exhaustion: max die at 1st level, fixed average after, plus CON and racial extras. */
export function getMaxHp(c: Character): number {
  const con = getAbilityMods(getAbilityScores(c)).con
  const race = raceById(c.raceId)
  const perLevelBonus = (race?.hpPerLevel ?? 0) + (race?.subraces?.find(s => s.id === c.subraceId)?.hpPerLevel ?? 0) + featBonus(c, 'hpPerLevel')
  let hp = 0
  let first = true
  for (const { def, level, subclass } of classesOf(c)) {
    for (let i = 0; i < level; i++) {
      const roll = first ? def.hitDie : def.hitDie / 2 + 1
      first = false
      hp += Math.max(1, roll + con) + perLevelBonus + (subclass?.hpPerLevel ?? 0)
    }
  }
  return Math.max(1, hp)
}

/** Max HP after exhaustion (level 4+ halves it). */
export const getEffectiveMaxHp = (c: Character) =>
  c.state.exhaustion >= 4 ? Math.max(1, Math.floor(getMaxHp(c) / 2)) : getMaxHp(c)

export function getHitDice(c: Character): { die: HitDie; total: number }[] {
  const byDie = new Map<HitDie, number>()
  for (const { def, level } of classesOf(c)) {
    const die = `d${def.hitDie}` as HitDie
    byDie.set(die, (byDie.get(die) ?? 0) + level)
  }
  return [...byDie].map(([die, total]) => ({ die, total }))
}

// ---------- Spellcasting ----------

const FULL_CASTER_SLOTS: number[][] = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

export function getSpellSlots(c: Character): { slots: number[]; pact?: { level: number; count: number } } {
  const row = FULL_CASTER_SLOTS[getCasterLevel(c).casterLevel]
  const slots = Array.from({ length: 9 }, (_, i) => row[i] ?? 0)

  const warlock = classesOf(c).find(x => x.def.caster === 'pact')
  if (!warlock) return { slots }
  const l = warlock.level
  const count = l >= 17 ? 4 : l >= 11 ? 3 : l >= 2 ? 2 : 1
  return { slots, pact: { level: Math.min(5, Math.ceil(l / 2)), count } }
}

// ---------- Class resources ----------

export interface ResourceInfo {
  id: string
  label: string
  max: number
  /** Already resolved for the character's level. */
  recharge: RestType
  shortRestFromLevel?: number
}

export function getResources(c: Character): ResourceInfo[] {
  const mods = getAbilityMods(getAbilityScores(c))
  const out: ResourceInfo[] = []
  for (const { def, level } of classesOf(c)) {
    for (const r of def.resources) {
      const max = r.max(level, mods)
      if (max <= 0) continue
      const recharge = r.shortRestFromLevel && level >= r.shortRestFromLevel ? 'short' : r.recharge
      const existing = out.find(o => o.id === r.id)
      // Some features (Channel Divinity) give a second class options, not extra uses.
      if (existing) existing.max = NON_STACKING_RESOURCES.includes(r.id) ? Math.max(existing.max, max) : existing.max + max
      else out.push({ id: r.id, label: r.name, max, recharge, shortRestFromLevel: r.shortRestFromLevel })
    }
  }
  return out
}

// ---------- Equipment ----------

const RACIAL_WEAPONS: Record<string, string[]> = {
  dwarf: ['battleaxe', 'handaxe', 'warhammer'],
  'high-elf': ['longsword', 'shortsword', 'shortbow', 'longbow'],
}

function isWeaponProficient(c: Character, w: Weapon) {
  const racial = [...(RACIAL_WEAPONS[c.raceId] ?? []), ...(RACIAL_WEAPONS[c.subraceId ?? ''] ?? [])]
  if (racial.includes(w.id)) return true
  const { weapons, weaponIds } = getProficiencies(c)
  return weapons.has(w.category) || weaponIds.has(w.id)
}

const isArmorProficient = (c: Character, a: Armor) => getProficiencies(c).armor.has(a.category)

function equippedEntries(c: Character): { entry: InventoryEntry; item: Item }[] {
  return c.inventory.filter(e => e.equipped).flatMap(entry => {
    const item = entryItem(entry)
    return item ? [{ entry, item }] : []
  })
}

/** Equipped body armor and shield, each with its magic bonus. */
function equippedArmor(c: Character) {
  const armors = equippedEntries(c).filter((x): x is { entry: InventoryEntry; item: Armor } => x.item.kind === 'armor')
  const body = armors.find(x => x.item.category !== 'shield')
  const shield = armors.find(x => x.item.category === 'shield')
  return { body, shield, bonus: (body?.entry.magicBonus ?? 0) + (shield?.entry.magicBonus ?? 0) }
}

export function getEquippedArmor(c: Character): { armor?: Armor; shield?: Armor } {
  const { body, shield } = equippedArmor(c)
  return { armor: body?.item, shield: shield?.item }
}

export function getArmorClass(c: Character): { value: number; source: string } {
  const mods = getAbilityMods(getAbilityScores(c))
  const { armor, shield } = getEquippedArmor(c)
  let value: number
  let source: string
  if (armor) {
    const dex = armor.dexCap === undefined ? mods.dex : Math.min(mods.dex, armor.dexCap)
    value = armor.baseAc + dex
    source = armor.name
  } else {
    value = 10 + mods.dex
    source = 'Unarmored'
    // Unarmored Defense comes from the first class that grants it; a second class can't add another.
    const ud = classesOf(c).find(({ def }) => def.unarmoredDefense)
    for (const { def } of ud ? [ud] : []) {
      const extra = def.unarmoredDefense
      // Monk unarmored defense does not work with a shield.
      if (!extra || (def.id === 'monk' && shield)) continue
      if (10 + mods.dex + mods[extra] > value) {
        value = 10 + mods.dex + mods[extra]
        source = `Unarmored Defense (${def.name})`
      }
    }
    for (const { subclass } of classesOf(c)) {
      if (subclass?.unarmoredBase && subclass.unarmoredBase + mods.dex > value) {
        value = subclass.unarmoredBase + mods.dex
        source = subclass.name
      }
    }
  }
  const featAc = featBonus(c, 'ac')
  if (featAc) {
    value += featAc
    source += ' + feats'
  }
  if (shield) {
    value += shield.baseAc
    source += ' + Shield'
  }
  const magic = equippedArmor(c).bonus + itemBonus(c, 'ac', !armor && !shield)
  if (magic) {
    value += magic
    source += ` + ${magic} magic`
  }
  return { value, source }
}

export interface Attack {
  name: string
  bonus: number
  damage: string
  damageType: string
  ability: Ability
  proficient: boolean
  notes: string[]
  /** Two-handed damage of a versatile weapon, ability mod included. */
  versatile?: string
  /** Weapon properties (finesse, ranged...); empty for an unarmed strike. */
  properties?: string[]
  /** Extra damage on every hit from the item, e.g. "1d6 fire". */
  extraDamage?: string
}

const martialArtsDie = (monkLevel: number) =>
  monkLevel >= 17 ? '1d10' : monkLevel >= 11 ? '1d8' : monkLevel >= 5 ? '1d6' : '1d4'

const withMod = (dice: string, mod: number) => (mod === 0 ? dice : `${dice}${mod > 0 ? '+' : '−'}${Math.abs(mod)}`)

export function getAttacks(c: Character): Attack[] {
  const mods = getAbilityMods(getAbilityScores(c))
  const prof = proficiencyBonus(totalLevel(c))
  const monk = classesOf(c).find(x => x.def.id === 'monk')
  const { armor, shield } = getEquippedArmor(c)
  const martialArts = monk && !armor && !shield
  const out: Attack[] = []
  const seen = new Set<string>()

  for (const { entry, item } of equippedEntries(c)) {
    // Two of the same plain weapon make one attack line; renamed or magic copies get their own.
    const key = `${item.id}|${item.name}|${entry.magicBonus ?? 0}|${entry.pact ? 1 : 0}`
    if (item.kind !== 'weapon' || seen.has(key)) continue
    seen.add(key)
    const ranged = item.properties.includes('ranged')
    let ability: Ability = ranged ? 'dex' : 'str'
    if (item.properties.includes('finesse')) ability = mods.dex > mods.str ? 'dex' : 'str'
    const monkWeapon = martialArts && !item.properties.includes('heavy') && !item.properties.includes('two-handed') &&
      (item.id === 'shortsword' || (item.category === 'simple' && !ranged))
    if (monkWeapon && mods.dex > mods[ability]) ability = 'dex'
    // Pact of the Blade: proficient with the pact weapon; the 2024 rules let it use Charisma.
    if (entry.pact && c.spellEdition === '2024' && mods.cha > mods[ability]) ability = 'cha'
    const proficient = entry.pact || isWeaponProficient(c, item)
    const magic = entry.magicBonus ?? 0
    const dmgMod = mods[ability] + magic
    const notes: string[] = []
    if (entry.pact) notes.push('pact weapon')
    if (magic || entry.pact) notes.push('magical')
    if (entry.extraDamage) notes.push(`+${entry.extraDamage}`)
    if (item.range) notes.push(`range ${item.range}`)
    if (item.versatile) notes.push(`two-handed ${withMod(item.versatile, dmgMod)}`)
    if (!proficient) notes.push('not proficient')
    out.push({
      name: item.name,
      bonus: mods[ability] + magic + (proficient ? prof : 0),
      damage: withMod(item.damage, dmgMod),
      damageType: item.damageType,
      ability,
      proficient,
      notes,
      versatile: item.versatile ? withMod(item.versatile, dmgMod) : undefined,
      properties: item.properties,
      ...(entry.extraDamage ? { extraDamage: entry.extraDamage } : {}),
    })
  }

  const unarmedAbility: Ability = martialArts && mods.dex > mods.str ? 'dex' : 'str'
  out.push({
    name: 'Unarmed Strike',
    bonus: mods[unarmedAbility] + prof,
    damage: martialArts ? withMod(martialArtsDie(monk.level), mods[unarmedAbility]) : `${Math.max(0, 1 + mods.str)}`,
    damageType: 'bludgeoning',
    ability: unarmedAbility,
    proficient: true,
    notes: [],
    properties: [],
  })
  return out
}

// ---------- Full derivation ----------

export interface DerivedStats {
  level: number
  proficiencyBonus: number
  abilities: Abilities
  mods: Abilities
  saves: Record<Ability, { bonus: number; proficient: boolean }>
  skills: Record<SkillId, { bonus: number; proficient: boolean; ability: Ability }>
  passivePerception: number
  initiative: number
  speed: number
  armorClass: { value: number; source: string }
  maxHp: number
  baseMaxHp: number
  hitDice: { die: HitDie; total: number }[]
  spellcasting?: { ability: Ability; saveDc: number; attackBonus: number }
  spellSlots: ReturnType<typeof getSpellSlots>
  resources: ResourceInfo[]
  attacks: Attack[]
  carryingCapacity: number
  carriedWeight: number
  features: { level: number; name: string; className: string }[]
  traits: string[]
  languages: string[]
  tools: string[]
  /** Names of feats taken instead of an Ability Score Improvement. */
  feats: string[]
  warnings: string[]
}

/** All proficient skills: chosen + race + background + feats. */
export function getSkillProficiencies(c: Character): Set<SkillId> {
  const race = raceById(c.raceId)
  const bg = getBackground(c)
  const fromFeats = getFeats(c).flatMap(f => f.effects.flatMap(e => (e.kind === 'skill' ? [e.skill] : [])))
  return new Set([...c.chosenSkills, ...(race?.skillProficiencies ?? []), ...(bg?.skillProficiencies ?? []), ...fromFeats])
}

const MONK_MOVEMENT: [number, number][] = [[18, 30], [14, 25], [10, 20], [6, 15], [2, 10]]

export function derive(c: Character): DerivedStats {
  const abilities = getAbilityScores(c)
  const mods = getAbilityMods(abilities)
  const level = totalLevel(c)
  const prof = proficiencyBonus(level)
  const classes = classesOf(c)
  const firstClass: ClassDef | undefined = classes[0]?.def
  const race = raceById(c.raceId)
  const subrace = race?.subraces?.find(s => s.id === c.subraceId)
  const bard = classes.find(x => x.def.id === 'bard')
  const jackOfAllTrades = bard && bard.level >= 2 ? Math.floor(prof / 2) : 0
  const warnings: string[] = []

  const itemSaves = itemBonus(c, 'saves')
  const itemChecks = itemBonus(c, 'checks')
  const saves = {} as DerivedStats['saves']
  for (const a of ABILITIES) {
    // Saving throw proficiencies come from the first class only.
    const proficient = !!firstClass?.savingThrows.includes(a)
    saves[a] = { bonus: mods[a] + (proficient ? prof : 0) + itemSaves, proficient }
  }

  const profSkills = getSkillProficiencies(c)
  const skills = {} as DerivedStats['skills']
  for (const s of ALL_SKILLS) {
    const ability = SKILLS[s].ability
    const proficient = profSkills.has(s)
    skills[s] = { bonus: mods[ability] + (proficient ? prof : jackOfAllTrades) + itemChecks, proficient, ability }
  }

  const { armor, shield } = getEquippedArmor(c)
  let speed = (race?.speed ?? 30) + featBonus(c, 'speed') + itemBonus(c, 'speed')
  if (armor?.category === 'heavy' && armor.strengthReq && abilities.str < armor.strengthReq) {
    speed -= 10
    warnings.push(`${armor.name} needs STR ${armor.strengthReq}: speed −10 ft.`)
  }
  const monk = classes.find(x => x.def.id === 'monk')
  if (monk && !armor && !shield) speed += MONK_MOVEMENT.find(([l]) => monk.level >= l)?.[1] ?? 0
  const barb = classes.find(x => x.def.id === 'barbarian')
  if (barb && barb.level >= 5 && armor?.category !== 'heavy') speed += 10
  if (c.state.exhaustion >= 5) speed = 0
  else if (c.state.exhaustion >= 2) speed = Math.floor(speed / 2)

  for (const a of [armor, shield]) {
    if (a && !isArmorProficient(c, a)) warnings.push(`Not proficient with ${a.name}: disadvantage on STR/DEX rolls, no spellcasting.`)
  }

  const caster = classes.find(x => x.def.spellAbility)
  const spellAbility = caster?.def.spellAbility
  const carriedWeight = c.inventory.reduce((w, e) => w + (entryItem(e)?.weight ?? 0) * e.qty, 0)
  const carryingCapacity = abilities.str * 15
  if (carriedWeight > carryingCapacity) warnings.push('Carrying more than your capacity.')
  warnings.push(...multiclassWarnings(c))

  return {
    level,
    proficiencyBonus: prof,
    abilities,
    mods,
    saves,
    skills,
    passivePerception: 10 + skills.perception.bonus,
    initiative: mods.dex + jackOfAllTrades + featBonus(c, 'initiative') + itemChecks,
    speed,
    armorClass: getArmorClass(c),
    maxHp: getEffectiveMaxHp(c),
    baseMaxHp: getMaxHp(c),
    hitDice: getHitDice(c),
    spellcasting: spellAbility
      ? { ability: spellAbility, saveDc: 8 + prof + mods[spellAbility] + itemBonus(c, 'spellDc'), attackBonus: prof + mods[spellAbility] + itemBonus(c, 'spellAttack') }
      : undefined,
    spellSlots: getSpellSlots(c),
    resources: getResources(c),
    attacks: getAttacks(c),
    carryingCapacity,
    carriedWeight: Math.round(carriedWeight * 100) / 100,
    features: classes.flatMap(({ def, level: l, subclass }) =>
      [...def.features, ...(subclass?.features ?? [])].filter(f => f.level <= l).sort((a, b) => a.level - b.level).map(f => ({ ...f, className: def.name })),
    ),
    traits: [...(race?.traits ?? []), ...(subrace?.traits ?? [])].map(t => {
      const choice = race?.traitChoice
      const picked = choice?.name === t ? choice.options.find(o => o.id === c.traitChoices?.[choice.id]) : undefined
      return picked ? `${t} (${picked.name}: ${picked.detail})` : t
    }),
    languages: getLanguages(c),
    tools: getTools(c),
    feats: getFeats(c).map(f => f.name),
    warnings,
  }
}

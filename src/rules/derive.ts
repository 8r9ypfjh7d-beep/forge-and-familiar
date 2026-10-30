import type { Character, HitDie } from '../model/character'
import { getAbilityMods, getAbilityScores } from './abilities'
import { classFeatures } from './classFeatures'
import { classChoices, featBonus, featEffects, getFeats, getLanguages, getTools } from './choices'
import { classOptionResourceId, pickedClassOptions } from './classOptions'
// Also registers the subclass pick lists' options, so saved picks resolve wherever derive() runs.
import { subclassPickLists } from './subclassPicks'
import { classOptionWarnings } from './invocations'
import { getBackground } from './data/backgrounds'
import { AURA_OF_PROTECTION_LEVEL, RADIANT_STRIKE_LEVEL } from './data/classFeatures2014'
import { classById } from './data/classes'
import { entryItem } from './data/items'
import { NON_STACKING_RESOURCES } from './data/multiclass'
import type { SubclassDef } from './data/subclasses'
import { ALL_SKILLS, SKILLS } from './data/skills'
import { rulesEdition, uses2024Spells } from './edition'
import { effectsOf, itemBonus } from './itemEffects'
import { racialSkills, racialWeapons } from './origin'
import { getCasterLevel, getProficiencies, multiclassWarnings } from './multiclass'
import { naturalArmorAc, pickedOptions, raceProfile, raceUseId } from './race'
import { optionPickSlots } from './optionPicks'
import { slug, subclassFeatures, subclassOf } from './subclass'
import {
  ABILITIES, type Abilities, type Ability, type AdvantageOn, type ClassDef, type ConditionId, type InventoryEntry, type Item, type MoveMode, type Recharge,
  type Sense, type Size, type SkillId, type SubclassFeature,
} from './types'

type Weapon = Extract<Item, { kind: 'weapon' }>
type Armor = Extract<Item, { kind: 'armor' }>

const classesOf = (c: Pick<Character, 'classes' | 'rulesEdition' | 'customSubclasses'>) =>
  c.classes.flatMap(cl => {
    const def = classById(cl.classId, rulesEdition(c))
    if (!def) return []
    const sub = subclassOf(c, cl)
    const subclass: SubclassDef | undefined = sub && cl.level >= def.subclassLevel ? sub : undefined
    return [{ def, level: cl.level, subclass }]
  })

export const totalLevel = (c: Character) => c.classes.reduce((n, cl) => n + cl.level, 0)

export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4)

/** SRD experience points needed to reach each level (index 0 = level 1). */
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]

/** XP needed for the next level, or undefined at level 20. */
export const xpForNextLevel = (level: number): number | undefined => XP_THRESHOLDS[Math.max(1, level)]

// ---------- Hit points ----------

/** Max HP: max die at 1st level, fixed average after, plus CON and racial extras. */
export function getMaxHp(c: Character): number {
  const con = getAbilityMods(getAbilityScores(c)).con
  const perLevelBonus = raceProfile(c).hpPerLevel + featBonus(c, 'hpPerLevel')
  let hp = 0
  let first = true
  for (const { def, level, subclass } of classesOf(c)) {
    for (let i = 0; i < level; i++) {
      const roll = first ? def.hitDie : def.hitDie / 2 + 1
      first = false
      hp += Math.max(1, roll + con) + perLevelBonus + (subclass?.hpPerLevel ?? 0)
    }
  }
  return Math.max(1, hp + itemBonus(c, 'hp'))
}

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
  // Items can add slots of any level (even to a character who has none), or more pact slots.
  for (const { effect: f } of effectsOf(c, 'spellSlot')) {
    const i = Math.min(9, Math.max(1, Math.round(f.level))) - 1
    slots[i] = Math.max(0, slots[i] + f.value)
  }

  const warlock = classesOf(c).find(x => x.def.caster === 'pact')
  if (!warlock) return { slots }
  const l = warlock.level
  const count = (l >= 17 ? 4 : l >= 11 ? 3 : l >= 2 ? 2 : 1) + effectsOf(c, 'pactSlot').reduce((n, x) => n + x.effect.value, 0)
  return { slots, pact: { level: Math.min(5, Math.ceil(l / 2)), count: Math.max(1, count) } }
}

// ---------- Class resources ----------

export interface ResourceInfo {
  id: string
  label: string
  max: number
  /** Already resolved for the character's level. Item charges can also come back at dawn, or never. */
  recharge: Recharge
  shortRestFromLevel?: number
  /** Item charges: dice regained at dawn; blank means all of them. */
  regain?: string
}

/** Charges of equipped items, as resources with ids `item:<uid>` (a second charges effect on one item gets `:2`). */
export function getItemCharges(c: Pick<Character, 'inventory'>): ResourceInfo[] {
  return (c.inventory ?? []).filter(e => e.equipped).flatMap(e => {
    const name = entryItem(e)?.name ?? e.name ?? e.itemId
    return (e.effects ?? []).flatMap((f, i, all) => {
      if (f.kind !== 'charges' || f.value <= 0) return []
      const nth = all.slice(0, i).filter(x => x.kind === 'charges').length
      return [{ id: `item:${e.uid}${nth ? `:${nth + 1}` : ''}`, label: name, max: f.value, recharge: f.recharge, ...(f.regain?.trim() ? { regain: f.regain.trim() } : {}) }]
    })
  })
}

/** How many uses a feature has at a class level. */
function usesMax(u: NonNullable<SubclassFeature['uses']>, level: number, prof: number, mods: Abilities): number {
  const count = u.steps ? u.steps.reduce((n, [from, v]) => (level >= from ? v : n), 0) : u.count
  const base = typeof count === 'number' ? count : count === 'pb' ? prof : count === 'level' ? level : mods[count]
  return Math.max(u.min ?? 1, base * (u.mult ?? 1) + (u.add ?? 0))
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
  // Class and subclass features with uses (homebrew class features, Hexblade's Curse, Healing Light): counted from the class level, PB or a modifier.
  const prof = proficiencyBonus(totalLevel(c))
  const withUses = [
    ...classFeatures(c).map(({ level, def, feature }) => ({ level, feature, id: `class:${def.id}:${slug(feature.name)}` })),
    ...subclassFeatures(c).map(({ level, subclass, feature }) => ({ level, feature, id: `sub:${subclass.id}:${slug(feature.name)}` })),
  ]
  for (const { level, feature, id } of withUses) {
    const u = feature.uses
    if (!u) continue
    const max = usesMax(u, level, prof, mods)
    if (max > 0) out.push({ id, label: feature.name, max, recharge: u.recharge })
  }
  // Picked class options with uses (a homebrew invocation once per long rest), counted from the picking class's level.
  for (const { option, level } of pickedClassOptions(c)) {
    const u = option.uses
    if (!u || out.some(o => o.id === classOptionResourceId(option))) continue
    const max = usesMax(u, level, prof, mods)
    if (max > 0) out.push({ id: classOptionResourceId(option), label: option.name, max, recharge: u.recharge })
  }
  // Racial traits with uses (Hexblood's Magic Token, Shifting): counted from the character level, PB or a modifier.
  const charLevel = Math.max(1, totalLevel(c))
  for (const u of raceProfile(c).uses) {
    const max = usesMax(u, charLevel, prof, mods)
    if (max > 0) out.push({ id: raceUseId(u.trait), label: u.trait, max, recharge: u.recharge })
  }
  // Feats with uses (Lucky, Chef's treats, giant feats): counted from the character level, PB or a modifier.
  for (const f of getFeats(c)) {
    if (f.uses) out.push({ id: `feat:${f.id}`, label: f.uses.label ?? f.name, max: usesMax(f.uses, charLevel, prof, mods), recharge: f.uses.recharge })
  }
  // Class picks with uses (Favored Foe, Harness Divine Power, Superior Technique's die).
  for (const { classId, level, choice, picked } of classChoices(c)) {
    const u = picked?.uses
    if (!u) continue
    const max = usesMax(u, level, prof, mods)
    if (max > 0) out.push({ id: `pick:${classId}:${choice.id}`, label: picked.name, max, recharge: u.recharge })
  }
  return [...out, ...getItemCharges(c)]
}

/** Weapon Mastery (2024): how many kinds of weapon the character can use mastery properties with. 0 in 2014. */
export function getWeaponMasteryCount(c: Pick<Character, 'classes' | 'rulesEdition'>): number {
  if (rulesEdition(c) !== '2024') return 0
  return Math.max(0, ...classesOf(c).map(({ def, level }) => (def.weaponMastery ?? []).reduce((n, [from, v]) => (level >= from ? v : n), 0)))
}

// ---------- Equipment ----------

function isWeaponProficient(c: Character, w: Weapon) {
  if (racialWeapons(c).includes(w.id) || raceProfile(c).weapons.includes(w.category)) return true
  const { weapons, weaponIds } = getProficiencies(c)
  return weapons.has(w.category) || weaponIds.has(w.id)
}

const isArmorProficient = (c: Character, a: Armor) => getProficiencies(c).armor.has(a.category) || raceProfile(c).armor.includes(a.category)

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
    // Natural armor (Tortle, Lizardfolk, Locathah): a shield still adds.
    const natural = naturalArmorAc(raceProfile(c).naturalArmor, mods)
    if (natural > value) {
      value = natural
      source = 'Natural Armor'
    }
    for (const { subclass } of classesOf(c)) {
      const sub = subclass?.unarmoredAbility ? 10 + mods[subclass.unarmoredAbility] : (subclass?.unarmoredBase ?? 0)
      if (subclass && sub && sub + mods.dex > value) {
        value = sub + mods.dex
        source = subclass.name
      }
    }
  }
  const featAc = featBonus(c, 'ac') + (armor ? featBonus(c, 'armoredAc') : 0)
  if (featAc) {
    value += featAc
    source += ' + feats'
  }
  if (shield) {
    value += shield.baseAc
    source += ' + Shield'
  }
  const magic = equippedArmor(c).bonus + itemBonus(c, 'ac', !armor && !shield, undefined, !!armor)
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
  /** The weapon's item id; missing for an unarmed strike. */
  itemId?: string
  /** Melee reach in feet (10 with the reach property). Missing for ranged weapons. */
  reach?: number
  /** Normal/long range in feet for ranged and thrown weapons, e.g. "20/60". */
  range?: string
}

const martialArtsDie = (monkLevel: number, edition: string) =>
  edition === '2024'
    ? monkLevel >= 17 ? '1d12' : monkLevel >= 11 ? '1d10' : monkLevel >= 5 ? '1d8' : '1d6'
    : monkLevel >= 17 ? '1d10' : monkLevel >= 11 ? '1d8' : monkLevel >= 5 ? '1d6' : '1d4'

/** Monk weapons: 2014 simple melee and shortswords; 2024 simple melee and martial Light melee weapons. Never heavy or two-handed. */
function isMonkWeapon(w: Weapon, edition: string) {
  if (w.properties.includes('heavy') || w.properties.includes('two-handed') || w.properties.includes('ranged')) return false
  if (w.category === 'simple') return true
  return edition === '2024' ? w.properties.includes('light') : w.id === 'shortsword'
}

const withMod = (dice: string, mod: number) => (mod === 0 ? dice : `${dice}${mod > 0 ? '+' : '−'}${Math.abs(mod)}`)

export function getAttacks(c: Character): Attack[] {
  const mods = getAbilityMods(getAbilityScores(c))
  const prof = proficiencyBonus(totalLevel(c))
  const monk = classesOf(c).find(x => x.def.id === 'monk')
  const { armor, shield } = getEquippedArmor(c)
  const martialArts = monk && !armor && !shield
  const edition = rulesEdition(c)
  const rangedBonus = featBonus(c, 'rangedAttack')
  const castingWeapon = classesOf(c).some(x => x.subclass?.castingWeapon)
  const levelOf = (id: string) => classesOf(c).find(x => x.def.id === id)?.level ?? 0
  // Improved Divine Smite (2014) / Radiant Strikes (2024): 1d8 radiant on every melee weapon hit.
  const radiant = levelOf('paladin') >= RADIANT_STRIKE_LEVEL ? (edition === '2024' ? 'Radiant Strikes' : 'Improved Divine Smite') : undefined
  // Brutal Critical (2014): extra weapon dice on a melee critical hit.
  const barbarian = edition === '2024' ? 0 : levelOf('barbarian')
  const brutal = barbarian >= 17 ? 3 : barbarian >= 13 ? 2 : barbarian >= 9 ? 1 : 0
  const magicWeaponAbility = classesOf(c).find(x => x.subclass?.magicWeaponAbility)?.subclass?.magicWeaponAbility
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
    const monkWeapon = martialArts && isMonkWeapon(item, edition)
    if (monkWeapon && mods.dex > mods[ability]) ability = 'dex'
    // Pact of the Blade: proficient with the pact weapon; the 2024 rules (and Hex Warrior) let it use Charisma.
    if (entry.pact && (uses2024Spells(c) || castingWeapon) && mods.cha > mods[ability]) ability = 'cha'
    const proficient = entry.pact || isWeaponProficient(c, item)
    const magic = entry.magicBonus ?? 0
    // Battle Ready: magic weapons may use the subclass's ability (Intelligence).
    const isMagic = magic > 0 || !!entry.extraDamage || !!entry.effects?.length || !!entry.pact
    if (magicWeaponAbility && isMagic && mods[magicWeaponAbility] > mods[ability]) ability = magicWeaponAbility
    const reach = ranged ? 'ranged' : 'melee'
    const dmgMod = mods[ability] + magic + itemBonus(c, 'damage', true, reach)
    const notes: string[] = []
    if (entry.pact) notes.push('pact weapon')
    if (magic || entry.pact) notes.push('magical')
    if (entry.extraDamage) notes.push(`+${entry.extraDamage}`)
    if (item.range) notes.push(`range ${item.range}`)
    if (item.versatile) notes.push(`two-handed ${withMod(item.versatile, dmgMod)}`)
    if (!proficient) notes.push('not proficient')
    if (brutal && !ranged) notes.push(`crit +${brutal} ${brutal > 1 ? 'dice' : 'die'} (Brutal Critical)`)
    // The item's own extra damage keeps the roll; the radiant die is then a note.
    const extraDamage = entry.extraDamage || (radiant && !ranged ? '1d8 radiant' : undefined)
    if (radiant && !ranged) notes.push(entry.extraDamage ? `+1d8 radiant (${radiant})` : radiant)
    out.push({
      name: item.name,
      bonus: mods[ability] + magic + (proficient ? prof : 0) + itemBonus(c, 'attack', true, reach) + (ranged ? rangedBonus : 0),
      damage: withMod(item.damage, dmgMod),
      damageType: item.damageType,
      ability,
      proficient,
      notes,
      versatile: item.versatile ? withMod(item.versatile, dmgMod) : undefined,
      properties: item.properties,
      ...(extraDamage ? { extraDamage } : {}),
      itemId: item.id,
      ...(ranged ? {} : { reach: item.properties.includes('reach') ? 10 : 5 }),
      ...(item.range ? { range: item.range } : {}),
    })
  }

  const unarmedAbility: Ability = martialArts && mods.dex > mods.str ? 'dex' : 'str'
  out.push({
    name: 'Unarmed Strike',
    bonus: mods[unarmedAbility] + prof + itemBonus(c, 'attack', true, 'melee'),
    damage: martialArts
      ? withMod(martialArtsDie(monk.level, edition), mods[unarmedAbility] + itemBonus(c, 'damage', true, 'melee'))
      : `${Math.max(0, 1 + mods.str + itemBonus(c, 'damage', true, 'melee'))}`,
    damageType: 'bludgeoning',
    ability: unarmedAbility,
    proficient: true,
    // Ki-Empowered Strikes (2014 monk 6): unarmed strikes count as magical.
    notes: martialArts && edition !== '2024' && monk.level >= 6 ? ['magical'] : [],
    properties: [],
    reach: 5,
  })
  // Natural weapons (Tabaxi claws, Minotaur horns): unarmed strikes with a damage die and type.
  for (const w of raceProfile(c).naturalWeapons) {
    const ability: Ability = martialArts && mods.dex > mods.str ? 'dex' : 'str'
    out.push({
      name: w.name,
      bonus: mods[ability] + prof + itemBonus(c, 'attack', true, 'melee'),
      damage: withMod(w.damage, mods[ability] + itemBonus(c, 'damage', true, 'melee')),
      damageType: w.type,
      ability,
      proficient: true,
      notes: [],
      properties: [],
      reach: 5,
    })
  }
  return out
}

// ---------- Full derivation ----------

export interface DerivedStats {
  level: number
  proficiencyBonus: number
  abilities: Abilities
  mods: Abilities
  /** `advantage`: an item or action always gives advantage on it (rolled automatically). */
  saves: Record<Ability, { bonus: number; proficient: boolean; advantage?: boolean }>
  skills: Record<SkillId, { bonus: number; proficient: boolean; ability: Ability; expertise?: boolean; advantage?: boolean }>
  passivePerception: number
  initiative: number
  initiativeAdvantage?: boolean
  /** Ability checks with advantage from items (skills and initiative already include it). */
  checkAdvantage: Partial<Record<Ability, boolean>>
  speed: number
  /** Flying, swimming, climbing and burrowing speeds from items. */
  speeds: Partial<Record<MoveMode, number>>
  senses: Partial<Record<Sense, number>>
  /** Damage resistances and immunities and condition immunities from items and switched-on actions. */
  defenses: { resistances: string[]; immunities: string[]; conditionImmunities: ConditionId[] }
  /** Every advantage from items, situational ones (with `when`) included. */
  advantages: { on: AdvantageOn; when?: string; source: string }[]
  /** Spells items let the character cast. */
  itemSpells: { spell: string; note?: string; source: string }[]
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
  /** `text` describes features the SRD library has no entry for (other books, custom subclasses). */
  /** `detail`: what the feature has grown to at this level ("d8", "CR 1", "3 attacks"). `optionId`: a pick from a subclass list (a maneuver, a rune), listed right after its feature, or a picked invocation or pact boon (after all class features). */
  features: { level: number; name: string; className: string; text?: string; subclassId?: string; detail?: string; optionId?: string }[]
  /** Size from the race, or the player's pick when the race offers two. */
  size: Size
  traits: string[]
  languages: string[]
  tools: string[]
  /** Names of feats taken instead of an Ability Score Improvement. */
  feats: string[]
  warnings: string[]
}

/** All proficient skills: chosen + race + background + feats. */
export function getSkillProficiencies(c: Character): Set<SkillId> {
  const bg = getBackground(c)
  const fromFeats = getFeats(c).flatMap(f => f.effects.flatMap(e => (e.kind === 'skill' ? [e.skill] : [])))
  return new Set([...c.chosenSkills, ...racialSkills(c), ...(bg?.skillProficiencies ?? []), ...fromFeats])
}

/** What a class feature has grown to at a class level ("d8", "CR 1"), from its `detail` steps. */
export const featureDetail = (f: { detail?: [number, string][] }, level: number): string | undefined =>
  f.detail?.reduce<string | undefined>((d, [from, text]) => (level >= from ? text : d), undefined)

/** Aura of Protection (paladin 6, both editions): the Charisma modifier, at least +1, added to every saving throw. */
export function auraOfProtection(c: Character): number {
  const paladin = classesOf(c).find(x => x.def.id === 'paladin')
  return paladin && paladin.level >= AURA_OF_PROTECTION_LEVEL ? Math.max(1, getAbilityMods(getAbilityScores(c)).cha) : 0
}

const MONK_MOVEMENT: [number, number][] = [[18, 30], [14, 25], [10, 20], [6, 15], [2, 10]]

export function derive(c: Character): DerivedStats {
  const abilities = getAbilityScores(c)
  const mods = getAbilityMods(abilities)
  const level = totalLevel(c)
  const prof = proficiencyBonus(level)
  const classes = classesOf(c)
  const firstClass: ClassDef | undefined = classes[0]?.def
  const raceInfo = raceProfile(c)
  const race = raceInfo.race
  const bard = classes.find(x => x.def.id === 'bard')
  const jackOfAllTrades = bard && bard.level >= 2 ? Math.floor(prof / 2) : 0
  const warnings: string[] = []
  const choices = classChoices(c)
  const pickLists = subclassPickLists(c)
  const optionSlots = optionPickSlots(c)

  const itemSaves = itemBonus(c, 'saves')
  const itemChecks = itemBonus(c, 'checks')
  const advantages = effectsOf(c, 'advantage').map(({ source, effect: f }) => ({ on: f.on, ...(f.when?.trim() ? { when: f.when.trim() } : {}), source }))
  const hasAdv = (...on: AdvantageOn[]) => advantages.some(x => !x.when && on.includes(x.on)) || undefined
  const saveProfs = new Set(effectsOf(c, 'saveProficiency').map(x => x.effect.ability))
  const saves = {} as DerivedStats['saves']
  const aura = auraOfProtection(c)
  for (const a of ABILITIES) {
    // Saving throw proficiencies come from the first class only (and items).
    const proficient = !!firstClass?.savingThrows.includes(a) || saveProfs.has(a)
    const extra = effectsOf(c, 'save').reduce((n, x) => n + (x.effect.ability === a ? x.effect.value : 0), 0)
    const advantage = hasAdv('saves', `save:${a}`)
    saves[a] = { bonus: mods[a] + (proficient ? prof : 0) + itemSaves + extra + aura, proficient, ...(advantage ? { advantage } : {}) }
  }

  const profSkills = getSkillProficiencies(c)
  const skillFx = effectsOf(c, 'skillProficiency')
  const skills = {} as DerivedStats['skills']
  for (const s of ALL_SKILLS) {
    const ability = SKILLS[s].ability
    const proficient = profSkills.has(s) || skillFx.some(x => x.effect.skill === s)
    const expertise = skillFx.some(x => x.effect.skill === s && x.effect.expertise) || undefined
    const extra = effectsOf(c, 'skill').reduce((n, x) => n + (x.effect.skill === s ? x.effect.value : 0), 0)
    const advantage = hasAdv('checks', `skill:${s}`)
    skills[s] = {
      bonus: mods[ability] + (expertise ? 2 * prof : proficient ? prof : jackOfAllTrades) + itemChecks + extra,
      proficient, ability, ...(expertise ? { expertise } : {}), ...(advantage ? { advantage } : {}),
    }
  }
  const allChecks = hasAdv('checks')
  const checkAdvantage: DerivedStats['checkAdvantage'] = allChecks ? Object.fromEntries(ABILITIES.map(a => [a, true])) : {}
  const initiativeAdvantage = hasAdv('checks', 'initiative')
  const speeds: DerivedStats['speeds'] = {}
  const senses: DerivedStats['senses'] = {}
  for (const { effect: f } of effectsOf(c, 'sense')) senses[f.sense] = Math.max(senses[f.sense] ?? 0, f.value)
  const uniq = <T,>(xs: T[]) => [...new Set(xs)]
  const defenses: DerivedStats['defenses'] = {
    resistances: uniq(effectsOf(c, 'resistance').map(x => x.effect.damage.trim().toLowerCase()).filter(Boolean)),
    immunities: uniq(effectsOf(c, 'immunity').map(x => x.effect.damage.trim().toLowerCase()).filter(Boolean)),
    conditionImmunities: uniq(effectsOf(c, 'conditionImmunity').map(x => x.effect.condition)),
  }
  // Immunity beats resistance to the same type.
  defenses.resistances = defenses.resistances.filter(d => !defenses.immunities.includes(d))

  const { armor, shield } = getEquippedArmor(c)
  let speed = raceInfo.speed + featBonus(c, 'speed') + itemBonus(c, 'speed')
  if (armor?.category === 'heavy' && armor.strengthReq && abilities.str < armor.strengthReq) {
    speed -= 10
    warnings.push(`${armor.name} needs STR ${armor.strengthReq}: speed −10 ft.`)
  }
  const monk = classes.find(x => x.def.id === 'monk')
  if (monk && !armor && !shield) speed += MONK_MOVEMENT.find(([l]) => monk.level >= l)?.[1] ?? 0
  const barb = classes.find(x => x.def.id === 'barbarian')
  if (barb && barb.level >= 5 && armor?.category !== 'heavy') speed += 10
  // "Equal to your walking speed" (value 0) or a set number; the best of each kind wins.
  for (const { effect: f } of effectsOf(c, 'moveSpeed')) speeds[f.mode] = Math.max(speeds[f.mode] ?? 0, f.value || speed)

  for (const a of [armor, shield]) {
    if (a && !isArmorProficient(c, a)) warnings.push(`Not proficient with ${a.name}: disadvantage on STR/DEX rolls, no spellcasting.`)
  }

  const caster = classes.find(x => x.def.spellAbility)
  const spellAbility = caster?.def.spellAbility
  const carriedWeight = c.inventory.reduce((w, e) => w + (entryItem(e)?.weight ?? 0) * e.qty, 0)
  const carryingCapacity = abilities.str * 15
  if (carriedWeight > carryingCapacity) warnings.push('Carrying more than your capacity.')
  warnings.push(...multiclassWarnings(c), ...classOptionWarnings(c))

  return {
    level,
    proficiencyBonus: prof,
    abilities,
    mods,
    saves,
    skills,
    passivePerception: 10 + skills.perception.bonus + itemBonus(c, 'passivePerception'),
    // 2024 Alert adds the proficiency bonus instead of Jack of All Trades' half.
    initiative: mods.dex + (featEffects(c, 'initiativeProficiency').length || raceProfile(c).initiativeProficiency ? prof : jackOfAllTrades) + featBonus(c, 'initiative') + itemChecks + itemBonus(c, 'initiative'),
    ...(initiativeAdvantage ? { initiativeAdvantage } : {}),
    checkAdvantage,
    speed,
    speeds,
    senses,
    defenses,
    advantages,
    itemSpells: effectsOf(c, 'spell').map(({ source, effect: f }) => ({ spell: f.spell.trim(), ...(f.note?.trim() ? { note: f.note.trim() } : {}), source })),
    armorClass: getArmorClass(c),
    maxHp: getMaxHp(c),
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
    features: [
      ...classes.flatMap(({ def, level: l, subclass }) =>
        [...def.features, ...(subclass?.features ?? []).map(f => ({ ...f, subclassId: subclass!.id }))].filter(f => f.level <= l).sort((a, b) => a.level - b.level).flatMap(f => {
          // A class choice shows its picks: "Divine Order (Protector)", "Favored Enemy (Undead, Fiends)".
          // Keeping the base rule adds nothing; a renamed version ("Primal Awareness (Tasha's)") replaces the name.
          const picked = choices.filter(x => x.classId === def.id && x.choice.name === f.name && x.picked && x.picked.id !== 'phb').map(x => x.picked!.name)
          const name = picked.length === 1 && picked[0].startsWith(f.name) ? picked[0] : picked.length ? `${f.name} (${picked.join(', ')})` : f.name
          const { detail: steps, ...rest } = f as typeof f & { detail?: [number, string][] }
          const detail = featureDetail({ detail: steps }, l)
          // Subclass picks (maneuvers, runes, a totem animal) follow the feature that grants them.
          const options = 'subclassId' in f
            ? pickLists.filter(p => p.classId === def.id && p.list.feature === f.name).flatMap(p => p.options.filter(o => p.picked.some(x => x.id === o.id)))
            // Class option lists (Artificer Infusions and plans) follow the feature that grants them too.
            : optionSlots.filter(x => x.classId === def.id && x.name === f.name).flatMap(x => x.picked.map(p => p.option))
          return [
            { ...rest, name, className: def.name, ...(detail ? { detail } : {}) },
            ...options.map(o => ({ level: f.level, name: o.name, className: def.name, optionId: o.id, ...(o.text ? { text: o.text } : {}) })),
          ]
        }).concat(
          // Optional features taken (Tasha's Harness Divine Power) that the class's own list doesn't name.
          choices.filter(x => x.classId === def.id && x.choice.optional && x.picked && x.picked.id !== 'phb' && !def.features.some(f => f.name === x.choice.name))
            .map(x => ({ level: x.choice.level, name: x.picked!.name, className: def.name, text: x.picked!.detail })),
        ),
      ),
      // Picked invocations and pact boons, after the class features. A repeated pick names its cantrip.
      ...pickedClassOptions(c).filter(x => x.option.kind === 'invocation' || x.option.kind === 'pactBoon').map(({ pick, option }) => ({
        level: pick.level ?? option.minLevel ?? 1,
        name: option.choiceKind === 'cantrip' && pick.choice ? `${option.name} (${pick.choice})` : option.name,
        className: classById(pick.classId ?? option.classIds?.[0] ?? '', rulesEdition(c))?.name ?? '',
        optionId: option.id,
        ...(option.text ? { text: option.text } : {}),
      })),
    ],
    size: raceInfo.size,
    traits: raceInfo.traits.map(t => {
      const choice = race?.traitChoice
      const picked = choice?.name === t ? choice.options.find(o => o.id === c.traitChoices?.[choice.id]) : undefined
      if (picked) return `${t} (${picked.name}: ${picked.detail})`
      // A pick named like a trait (homebrew lineages) shows what was picked.
      const ch = raceInfo.choices.find(x => x.name === t)
      const names = ch ? pickedOptions(c, ch.id).map(id => ch.options.find(o => o.id === id)).filter(o => !!o).map(o => (o.detail ? `${o.name}: ${o.detail}` : o.name)) : []
      return names.length ? `${t} (${names.join(', ')})` : t
    }),
    languages: getLanguages(c),
    tools: getTools(c),
    feats: getFeats(c).map(f => f.name),
    warnings,
  }
}

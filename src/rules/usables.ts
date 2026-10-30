// What casting a spell does on the sheet: the "usable action" layer between spell definitions
// (SRD 5.1/5.2 and the book spells) and the live sheet. Every spell gets a plan: the slot it costs,
// the temporary HP or healing it gives, damage it deals now, and the effect it leaves running
// (AC, advantage, resistance, extra damage on hits, dice on d20 rolls) with its concentration and duration.
// Spells without known numbers still get a plan: cast, spend the slot, and track it while it lasts.
import type { ActionKind, LiveEffect } from '../model/character'
import type { Ability, ItemEffect } from './types'

/** The parts of a library spell the plans read (src/content's Spell has them all). */
export interface SpellInfo {
  id: string
  name: string
  level: number
  duration: string
  concentration: boolean
  castingTime?: string
  range?: string
  description?: string
  healBySlotLevel?: Record<number, string>
}

export interface CastContext {
  edition: '2014' | '2024'
  /** Spellcasting ability modifier. */
  mod: number
  /** Walking speed, for spells that double it (Haste). */
  speed?: number
}

/** The running part of a cast: a LiveEffect without its saved bookkeeping. */
export type EffectTemplate = Omit<LiveEffect, 'id' | 'name' | 'from' | 'on' | 'level' | 'concentration' | 'duration' | 'ends'>

export interface CastPlan {
  /** Temporary HP gained on casting: a number or dice ("1d4+4"). */
  tempHp?: string
  /** Hit points the caster regains on casting (Aid), as dice or a number. */
  heal?: string
  /** Damage dealt right away (2024 smites, cast after the hit). */
  hit?: { dice: string; type?: string }
  /** The effect left running, or undefined for an instant spell with nothing to track. */
  effect?: Omit<LiveEffect, 'on'>
}

type Template = (level: number, ctx: CastContext) => EffectTemplate & Pick<CastPlan, 'tempHp' | 'heal' | 'hit'>

const above = (level: number, base: number) => Math.max(0, level - base)
const dice = (n: number, sides: number) => `${n}d${sides}`
const plus = (expr: string, n: number) => (n ? `${expr}+${n}` : expr)
const BPS = ['bludgeoning', 'piercing', 'slashing'].map((damage): ItemEffect => ({ kind: 'resistance', damage }))

/** A smite: in 2014 it rides on the next hit; in 2024 it is cast after the hit, so it rolls at once. */
const smite = (n: number, sides: number, type: string, perLevel = 0, base = 1): Template => (level, { edition }) => {
  const d = dice(n + perLevel * above(level, base), sides)
  return edition === '2024' ? { hit: { dice: d, type } } : { damage: d, damageType: type, weaponOnly: true, once: true }
}

/**
 * Known numbers per spell id (ids are shared by both editions; `ctx.edition` covers the differences).
 * Anything not listed falls back to reading temporary hit points from the text, then to plain tracking.
 */
export const SPELL_TEMPLATES: Record<string, Template> = {
  // Temporary hit points
  'armor-of-agathys': level => ({ tempHp: String(5 * level), whileTempHp: true, reflect: { damage: String(5 * level), type: 'cold' } }),
  'false-life': (level, { edition }) => ({ tempHp: plus(edition === '2024' ? '2d4+4' : '1d4+4', 5 * above(level, 1)), whileTempHp: true }),
  heroism: (_l, { mod }) => ({ tempHp: String(Math.max(0, mod)), stats: [{ kind: 'conditionImmunity', condition: 'frightened' }] }),
  'tensers-transformation': () => ({
    tempHp: '50', damage: '2d12', damageType: 'force', weaponOnly: true,
    stats: [{ kind: 'advantage', on: 'attacks', when: 'with weapons' }, { kind: 'saveProficiency', ability: 'str' }, { kind: 'saveProficiency', ability: 'con' }],
  }),
  aid: level => ({ heal: String(5 * above(level, 1)), stats: [{ kind: 'hp', value: 5 * above(level, 1) }] }),
  // Armor class
  shield: () => ({ stats: [{ kind: 'ac', value: 5 }] }),
  'shield-of-faith': () => ({ stats: [{ kind: 'ac', value: 2 }] }),
  'mage-armor': () => ({ acBase: 13 }),
  barkskin: (_l, { edition }) => ({ acMin: edition === '2024' ? 17 : 16 }),
  haste: (_l, { speed }) => ({ stats: [{ kind: 'ac', value: 2 }, { kind: 'advantage', on: 'save:dex' }, ...(speed ? [{ kind: 'speed' as const, value: speed }] : [])] }),
  'warding-bond': () => ({ stats: [{ kind: 'ac', value: 1 }, { kind: 'saves', value: 1 }, { kind: 'resistance', damage: 'all' }] }),
  // Dice on d20 rolls
  bless: () => ({ rollDice: { attack: '1d4', save: '1d4' } }),
  guidance: () => ({ rollDice: { check: '1d4' } }),
  resistance: () => ({ rollDice: { save: '1d4' } }),
  // Extra damage on hits
  hex: () => ({ damage: '1d6', damageType: 'necrotic' }),
  'hunters-mark': (_l, { edition }) => ({ damage: '1d6', ...(edition === '2024' ? { damageType: 'force' } : {}), weaponOnly: true }),
  'divine-favor': () => ({ damage: '1d4', damageType: 'radiant', weaponOnly: true }),
  'searing-smite': smite(1, 6, 'fire', 1),
  'thunderous-smite': smite(2, 6, 'thunder', 1),
  'wrathful-smite': smite(1, 6, 'psychic', 1),
  'branding-smite': smite(2, 6, 'radiant', 1, 2),
  'shining-smite': smite(2, 6, 'radiant', 1, 2),
  'blinding-smite': smite(3, 8, 'radiant', 1, 3),
  'staggering-smite': smite(4, 6, 'psychic', 1, 4),
  'banishing-smite': smite(5, 10, 'force', 1, 5),
  'divine-smite': (level, { edition }) => (edition === '2024' ? { hit: { dice: dice(2 + above(level, 1), 8), type: 'radiant' } } : {}),
  'elemental-weapon': level => {
    const n = level >= 7 ? 3 : level >= 5 ? 2 : 1
    return { damage: dice(n, 4), weaponOnly: true, stats: [{ kind: 'attack', value: n }] }
  },
  'magic-weapon': level => {
    const n = level >= 6 ? 3 : level >= 4 ? 2 : 1
    return { stats: [{ kind: 'attack', value: n }, { kind: 'damage', value: n }] }
  },
  'holy-weapon': () => ({ damage: '2d8', damageType: 'radiant', weaponOnly: true }),
  'crusaders-mantle': () => ({ damage: '1d4', damageType: 'radiant', weaponOnly: true }),
  'spirit-shroud': level => ({ damage: dice(1 + Math.floor(above(level, 3) / 2), 8) }),
  'flame-arrows': () => ({ damage: '1d6', damageType: 'fire', weaponOnly: true }),
  'enlarge-reduce': () => ({ damage: '1d4', weaponOnly: true, stats: [{ kind: 'advantage', on: 'save:str' }, { kind: 'advantage', on: 'checks', when: 'with Strength' }] }),
  'absorb-elements': () => ({ damage: '1d6', weaponOnly: true, once: true }),
  // Resistances, advantage, movement and senses
  stoneskin: () => ({ stats: BPS }),
  'blade-ward': (_l, { edition }) => (edition === '2024' ? {} : { stats: BPS }),
  foresight: () => ({ stats: [{ kind: 'advantage', on: 'attacks' }, { kind: 'advantage', on: 'checks' }, { kind: 'advantage', on: 'saves' }] }),
  'beacon-of-hope': () => ({ stats: [{ kind: 'advantage', on: 'save:wis' }, { kind: 'advantage', on: 'saves', when: 'for death saves' }] }),
  'holy-aura': () => ({ stats: [{ kind: 'advantage', on: 'saves' }] }),
  'greater-invisibility': () => ({ stats: [{ kind: 'advantage', on: 'attacks' }] }),
  'circle-of-power': () => ({ stats: [{ kind: 'advantage', on: 'saves', when: 'against spells and magical effects' }] }),
  'pass-without-trace': () => ({ stats: [{ kind: 'skill', skill: 'stealth', value: 10 }] }),
  longstrider: () => ({ stats: [{ kind: 'speed', value: 10 }] }),
  fly: () => ({ stats: [{ kind: 'moveSpeed', mode: 'fly', value: 60 }] }),
  'spider-climb': () => ({ stats: [{ kind: 'moveSpeed', mode: 'climb', value: 0 }] }),
  darkvision: (_l, { edition }) => ({ stats: [{ kind: 'sense', sense: 'darkvision', value: edition === '2024' ? 150 : 60 }] }),
  'freedom-of-movement': () => ({ stats: [{ kind: 'conditionImmunity', condition: 'restrained' }, { kind: 'conditionImmunity', condition: 'paralyzed' }] }),
  'mind-blank': () => ({ stats: [{ kind: 'immunity', damage: 'psychic' }, { kind: 'conditionImmunity', condition: 'charmed' }] }),
}

/** Temporary hit points written in the text: "you gain 10 temporary hit points", "1d4 + 4 temporary hit points". */
export function tempHpFromText(text = ''): string | undefined {
  const m = /(\d+d\d+(?:\s*\+\s*\d+)?|\d+)\s+temporary hit points/i.exec(text)
  return m ? m[1].replace(/\s+/g, '') : undefined
}

/** Which rest ends a spell of this duration; undefined when it is instant. */
export function endsOn(duration: string): LiveEffect['ends'] | undefined {
  const d = duration.toLowerCase()
  if (!d.trim() || /instantaneous/.test(d)) return undefined
  if (/until dispelled|until triggered|special|permanent|\bday|\bdays/.test(d)) return 'never'
  const hours = /(\d+)\s*hour/.exec(d)
  if (hours) return Number(hours[1]) <= 1 ? 'short' : Number(hours[1]) <= 8 ? 'long' : 'never'
  return 'short'
}

export const spellEffectId = (spellId: string) => `spell:${spellId}`

/**
 * Everything a cast does, at the slot level it uses (cantrips: 0).
 * The effect is left out only for instant spells with nothing running; anything with a duration is tracked.
 */
export function planCast(spell: SpellInfo, castLevel: number, ctx: CastContext): CastPlan {
  const level = Math.max(spell.level, castLevel)
  const tpl = SPELL_TEMPLATES[spell.id]?.(level, ctx) ?? {}
  const { tempHp: knownTemp, heal, hit, ...running } = tpl
  const ends = endsOn(spell.duration)
  // An instantaneous spell's temporary HP (2024 False Life) just stay; nothing keeps running.
  if (!ends) delete running.whileTempHp
  const tempHp = knownTemp ?? (SPELL_TEMPLATES[spell.id] ? undefined : tempHpFromText(spell.description))
  const hasNumbers = Object.keys(running).length > 0
  const plan: CastPlan = {}
  if (tempHp && tempHp !== '0') plan.tempHp = tempHp
  if (heal && heal !== '0') plan.heal = heal
  if (hit) plan.hit = hit
  if (ends || hasNumbers) {
    plan.effect = {
      id: spellEffectId(spell.id), name: spell.name, from: 'spell',
      ...(spell.level > 0 ? { level } : {}),
      ...(spell.concentration ? { concentration: true } : {}),
      ...(/^self/i.test(spell.range ?? '') ? { self: true } : {}),
      duration: spell.duration,
      ends: ends ?? 'short',
      ...running,
    }
  }
  return plan
}

/** True when the spell changes numbers on the sheet while it runs, so it deserves an Effects switch before it is cast (Hex). */
export function hasRunningNumbers(spell: SpellInfo, ctx: CastContext): boolean {
  const tpl = SPELL_TEMPLATES[spell.id]?.(spell.level, ctx)
  if (!tpl) return false
  const { tempHp: _t, heal: _h, hit: _d, ...running } = tpl
  return Object.keys(running).length > 0
}

// ---- Features ----

export interface UseContext {
  edition: '2014' | '2024'
  /** Level in the class the resource belongs to (Second Wind heals 1d10 + fighter level). */
  classLevel: number
  /** Ability modifiers, for features that add one (Dark One's Blessing adds CHA). */
  mods?: Partial<Record<Ability, number>>
}

/** What using a feature does besides spending one use. */
export interface UsePlan {
  /** A pool spent in any amount (Lay on Hands): the player picks how many points, which heal them or an ally. */
  pool?: 'heal'
  heal?: string
  tempHp?: string
  effect?: Omit<LiveEffect, 'on'>
}

type FeatureTemplate = (ctx: UseContext) => UsePlan & { effectAs?: Omit<LiveEffect, 'on' | 'id' | 'name' | 'from'> }

/** Features with numbers, by resource id. Everything else still gets Use: it spends one and logs it. */
export const FEATURE_TEMPLATES: Record<string, FeatureTemplate> = {
  'second-wind': ({ classLevel }) => ({ heal: `1d10+${classLevel}` }),
  'lay-on-hands': () => ({ pool: 'heal' }),
  rage: ({ edition }) => ({
    effectAs: {
      duration: edition === '2024' ? '10 minutes' : '1 minute', ends: 'short',
      stats: [...BPS, { kind: 'advantage', on: 'save:str' }, { kind: 'advantage', on: 'checks', when: 'with Strength' }],
    },
  }),
  'wild-shape': ({ classLevel }) => ({ effectAs: { duration: hours(Math.max(1, Math.floor(classLevel / 2))), ends: 'long' } }),
  'innate-sorcery': () => ({
    effectAs: { duration: '1 minute', ends: 'short', stats: [{ kind: 'spellDc', value: 1 }, { kind: 'advantage', on: 'attacks', when: 'with spells' }] },
  }),
  // Features without uses, by feature id: used when they trigger.
  'dark-ones-blessing': ({ classLevel, mods }) => ({ tempHp: String(Math.max(1, (mods?.cha ?? 0) + classLevel)) }),
}

// ---- What a turn costs ----

/** "1 action", "1 bonus action", "1 reaction, which you take when..." → the group it goes under on the combat page. */
export function castingKind(castingTime = ''): Exclude<ActionKind, 'free'> {
  const t = castingTime.toLowerCase()
  if (/bonus action/.test(t)) return 'bonus'
  if (/reaction/.test(t)) return 'reaction'
  if (/^\s*1 action|^\s*action|magic action/.test(t)) return 'action'
  return 'other'
}

type Kind = ActionKind | { '2014': ActionKind; '2024': ActionKind }

/** How a feature is used in a turn, by its name (resources go by their label too). `spend`: points it costs from a pool. */
export interface FeatureAction { kind: Kind; spend?: { pools: string[]; n: number }; use?: string }

const KI = { pools: ['ki', 'focus'], n: 1 }

/** Features and resources by name. Anything with uses that is not listed goes under Other. */
export const FEATURE_ACTIONS: Record<string, FeatureAction> = {
  // Class features with uses
  'Rage': { kind: 'bonus' },
  'Bardic Inspiration': { kind: 'bonus' },
  'Channel Divinity': { kind: 'action' },
  'Divine Intervention': { kind: 'action' },
  'Wild Shape': { kind: { '2014': 'action', '2024': 'bonus' } },
  'Second Wind': { kind: 'bonus' },
  'Action Surge': { kind: 'free' },
  'Indomitable': { kind: 'free' },
  'Divine Sense': { kind: 'action' },
  'Lay on Hands': { kind: { '2014': 'action', '2024': 'bonus' } },
  'Cleansing Touch': { kind: 'action' },
  'Stroke of Luck': { kind: 'free' },
  'Innate Sorcery': { kind: 'bonus' },
  'Arcane Recovery': { kind: 'other' },
  'Magical Cunning': { kind: 'other' },
  // Subclass features with uses
  "Hexblade's Curse": { kind: 'bonus' },
  'Healing Light': { kind: 'bonus' },
  "Dark One's Own Luck": { kind: 'free' },
  'Hurl Through Hell': { kind: 'free' },
  'Tides of Chaos': { kind: 'free' },
  'Wrath of the Storm': { kind: 'reaction' },
  'Warding Flare': { kind: 'reaction' },
  'Combat Inspiration': { kind: 'reaction' },
  'Arcane Ward': { kind: 'other' },
  // Features without uses, or that spend a pool
  'Cunning Action': { kind: 'bonus' },
  'Uncanny Dodge': { kind: 'reaction' },
  'Reckless Attack': { kind: 'free' },
  'Flurry of Blows': { kind: 'bonus', spend: KI },
  'Patient Defense': { kind: 'bonus', spend: KI },
  'Step of the Wind': { kind: 'bonus', spend: KI },
  'Stunning Strike': { kind: 'free', spend: KI },
  'Deflect Missiles': { kind: 'reaction' },
  'Deflect Attacks': { kind: 'reaction' },
  "Dark One's Blessing": { kind: 'free', use: 'dark-ones-blessing' },
  // Race and feat uses
  'Breath Weapon': { kind: 'action' },
  'Relentless Endurance': { kind: 'free' },
  'Healing Hands': { kind: 'action' },
  'Fey Step': { kind: 'bonus' },
  'Shifting': { kind: 'bonus' },
  'Hidden Step': { kind: 'bonus' },
  "Stone's Endurance": { kind: 'reaction' },
  'Fury of the Small': { kind: 'free' },
  'Lucky': { kind: 'free' },
}

/** A feature's or resource's entry by its name: "Lay on Hands (HP pool)" and "Channel Divinity (2/rest)" match their base name. */
export function featureAction(name: string): FeatureAction | undefined {
  const base = name.replace(/\s*\(.*\)\s*$/, '').trim()
  return FEATURE_ACTIONS[name] ?? FEATURE_ACTIONS[base]
}

/** The group a feature goes under for this edition, or undefined when it is not one the combat page lists by name. */
export function featureActionKind(name: string, edition: '2014' | '2024'): ActionKind | undefined {
  const k = featureAction(name)?.kind
  return k === undefined ? undefined : typeof k === 'string' ? k : k[edition]
}

function hours(n: number) { return `${n} hour${n === 1 ? '' : 's'}` }

export const featureEffectId = (resourceId: string) => `feature:${resourceId}`

/** What one use of a feature's resource does: healing, temp HP, and the effect it starts (Rage). */
export function planUse(resourceId: string, name: string, ctx: UseContext): UsePlan {
  const tpl = FEATURE_TEMPLATES[resourceId]?.(ctx)
  if (!tpl) return {}
  const { effectAs, ...rest } = tpl
  return effectAs ? { ...rest, effect: { id: featureEffectId(resourceId), name, from: 'feature', ...effectAs } } : rest
}

// ---- Items ----

/** Healing potions by item id or name: what drinking one heals. */
const POTIONS: Record<string, string> = {
  'potion-healing': '2d4+2', 'potion-of-healing': '2d4+2', 'potion-of-healing-common': '2d4+2', 'potion of healing': '2d4+2',
  'potion-of-healing-greater': '4d4+4', 'potion of greater healing': '4d4+4',
  'potion-of-healing-superior': '8d4+8', 'potion of superior healing': '8d4+8',
  'potion-of-healing-supreme': '10d4+20', 'potion of supreme healing': '10d4+20',
}

/** The healing a potion gives when drunk, by its item id or name; undefined for anything else. */
export function potionHealing(itemId: string, name = ''): string | undefined {
  return POTIONS[itemId] ?? POTIONS[name.trim().toLowerCase()]
}

/** Potions, elixirs and oils: drunk (or applied) once, so they get Drink. */
export const isPotion = (name: string) => /^(potion|elixir|philter|oil)\b/i.test(name.trim())

/** A drunk potion's stat changes (Giant Strength, Resistance, Heroism...) as a running effect; most last an hour. */
export function potionEffect(uid: string, name: string, effects: ItemEffect[] = []): Omit<LiveEffect, 'on'> | undefined {
  const stats = effects.filter(f => f.kind !== 'charges' && f.kind !== 'spell')
  return stats.length ? { id: `item:${uid}`, name, from: 'item', duration: '1 hour', ends: 'short', stats } : undefined
}

/** "Hellish Rebuke (as 2nd level)" → the spell's name and the level it is cast at. */
export function itemSpellCast(text: string): { name: string; level?: number } {
  const m = /^(.*?)\s*\((?:as\s+)?(\d)(?:st|nd|rd|th)[- ]level\)\s*$/i.exec(text)
  return m ? { name: m[1].trim(), level: Number(m[2]) } : { name: text.replace(/\s*\(.*\)\s*$/, '').trim() }
}

/** How a race's or item's spell is limited, read from its note: uses that come back on a rest or at dawn, or item charges per cast. */
export type SpellLimit = { max: number; recharge: 'short' | 'long' | 'dawn' } | { charges: number }

const COUNT_WORDS: Record<string, number> = { once: 1, twice: 2, 'three times': 3, 'four times': 4, 'five times': 5 }

/** `prof`: the proficiency bonus, for spells usable that many times ("proficiency bonus times per long rest"). */
export function spellLimit(note = '', prof = 2): SpellLimit | undefined {
  const n = note.toLowerCase()
  if (!n.trim() || /at will/.test(n)) return undefined
  const charges = /(\d+)\s*charges?\b/.exec(n) ?? (/\bcharge\b/.test(n) ? ['', '1'] : null)
  if (charges) return { charges: Number(charges[1]) }
  const recharge = /short/.test(n) ? 'short' : /dawn/.test(n) ? 'dawn' : /long rest|per day|a day|\/day|daily|each day/.test(n) ? 'long' : undefined
  if (!recharge) return undefined
  const word = Object.keys(COUNT_WORDS).find(w => n.includes(w))
  const digits = /(\d+)\s*(?:\/|times|per|uses?|x\b)/.exec(n)
  const pb = /proficiency bonus|\bpb\b/.test(n)
  return { max: pb ? prof : word ? COUNT_WORDS[word] : digits ? Number(digits[1]) : 1, recharge }
}

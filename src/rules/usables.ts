// What casting a spell does on the sheet: the "usable action" layer between spell definitions
// (SRD 5.1/5.2 and the book spells) and the live sheet. Every spell gets a plan: the slot it costs,
// the temporary HP or healing it gives, damage it deals now, and the effect it leaves running
// (AC, advantage, resistance, extra damage on hits, dice on d20 rolls) with its concentration and duration.
// Spells without known numbers still get a plan: cast, spend the slot, and track it while it lasts.
import type { ActionKind, LiveEffect } from '../model/character'
import { STRENGTH_MELEE } from './rollMode'
import type { Ability, ItemEffect } from './types'
import { DAMAGE_TYPES } from './damage'

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
/** 2024 Rage of the Wilds, Bear: every damage type except force, necrotic, psychic and radiant. */
const WILD_BEAR = DAMAGE_TYPES.filter(d => !['force', 'necrotic', 'psychic', 'radiant'].includes(d)).map((damage): ItemEffect => ({ kind: 'resistance', damage }))
/** Bear Totem Spirit: every damage type except psychic. */
const BEAR = DAMAGE_TYPES.filter(d => d !== 'psychic').map((damage): ItemEffect => ({ kind: 'resistance', damage }))

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
  friends: () => ({ stats: [{ kind: 'advantage', on: 'checks', when: 'with Charisma against the target' }] }),
  // 2014: advantage on your first attack next turn; 2024 is a weapon attack cast at once.
  'true-strike': (_l, { edition }) => (edition === '2024' ? {} : { stats: [{ kind: 'advantage', on: 'attacks', when: 'on your first attack against the target' }] }),
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
  /** Character level and proficiency bonus, for race traits (Breath Weapon grows with the character). */
  level?: number
  prof?: number
  /** The dragonborn's ancestry: Breath Weapon's damage type, save and area. */
  breath?: { type: string; save: Ability; area: BreathArea }
  /** How many pact slots the warlock has (Magical Cunning brings half back). */
  pactSlots?: number
  /** Circle of the Moon: Wild Shape takes stronger beasts. */
  moon?: boolean
  /** 2014 Totem Warrior with the Bear spirit: raging resists every damage type but psychic. */
  bear?: boolean
  /** 2024 Path of the Wild Heart (barbarian 3+): each Rage picks Bear, Eagle or Wolf (Rage of the Wilds). */
  wildHeart?: boolean
  /** Channel Divinity: the options the character has, each with its class's level, spell save DC and casting modifier. */
  channel?: ChannelSource[]
}

/** One Channel Divinity option the character has (Turn Undead, Sacred Weapon), with the numbers of the class that gives it. */
export interface ChannelSource { name: string; classLevel: number; dc: number; mod: number }

/** A line of text a use shows in its result, as an i18n key under `use.note.` with its numbers. */
export interface UseNote { key: string; vars?: Record<string, string | number> }

/** One choice a use asks for first (Channel Divinity: Turn Undead or Sacred Weapon), with what that choice does. */
export interface UseOption { id: string; name: string; plan: UsePlan }

/** What using a feature does besides spending one use. */
export interface UsePlan {
  /** A pool spent in any amount (Lay on Hands): the player picks how many points, which heal them or an ally. */
  pool?: 'heal'
  heal?: string
  tempHp?: string
  effect?: Omit<LiveEffect, 'on'>
  /** Damage rolled on use (Breath Weapon), with the save it calls for and its area. */
  hit?: { dice: string; type?: string }
  save?: { dc: number; ability: Ability }
  area?: BreathArea
  /** A die handed to an ally (Bardic Inspiration). */
  give?: string
  /** Pact slots regained (Magical Cunning). */
  pactSlots?: number
  /** A beast form is picked first (Wild Shape), within these limits. */
  form?: WildShapeLimit
  /** Spent spell slots picked back (Arcane Recovery): combined levels up to `budget`, none above `maxLevel`. */
  recover?: { budget: number; maxLevel: number }
  /** One of these is picked first (Channel Divinity); the use then does what the picked one does. */
  options?: UseOption[]
  /** A resource refilled in full (Uncanny Metabolism: all Focus Points). */
  refill?: string
  /** What the use does that the sheet can't do for you (Guided Strike: +10 to the roll). */
  note?: UseNote
}

/** A breath's area: a cone's length, a line's width and length, or a choice of both (2024). */
export interface BreathArea { cone?: number; line?: [number, number] }

/** "5 by 30 ft. line", "15 ft. cone (DEX save)", "15 ft. cone or 30 ft. line" → its area. */
export function breathArea(text: string): BreathArea {
  const cone = /(\d+) ft\. cone/.exec(text)
  const line = /(?:(\d+) by )?(\d+) ft\. line/.exec(text)
  return { ...(cone ? { cone: Number(cone[1]) } : {}), ...(line ? { line: [Number(line[1] ?? 5), Number(line[2])] as [number, number] } : {}) }
}

/** The beasts Wild Shape can take: highest challenge rating and whether flying or swimming forms are allowed. */
export interface WildShapeLimit { maxCr: number; fly: boolean; swim: boolean }

export function wildShapeLimit(edition: '2014' | '2024', druidLevel: number, moon = false): WildShapeLimit {
  const l = druidLevel
  const base = l >= 8 ? 1 : l >= 4 ? 0.5 : 0.25
  const moonCr = edition === '2024' ? Math.max(1, Math.floor(l / 3)) : l >= 6 ? Math.floor(l / 3) : 1
  return { maxCr: moon ? Math.max(base, moonCr) : base, fly: l >= 8, swim: edition === '2024' || l >= 4 }
}

/** Breath Weapon damage dice: 2014 SRD grows 2d6 → 5d6; 2024 and Fizban's 1d10 → 4d10. */
export function breathDice(level: number, d10: boolean): string {
  const n = (d10 ? [1, 5, 11, 17] : [1, 6, 11, 16]).filter(x => level >= x).length
  return d10 ? `${n}d10` : `${n + 1}d6`
}

/** Bardic Inspiration's die by bard level. */
export const inspirationDie = (bardLevel: number) => `1d${bardLevel >= 15 ? 12 : bardLevel >= 10 ? 10 : bardLevel >= 5 ? 8 : 6}`

const breath = (d10: boolean): FeatureTemplate => ({ edition, level = 1, prof = 2, mods, breath: b }) => {
  const big = d10 || edition === '2024'
  const save = b?.save ?? 'dex'
  return {
    hit: { dice: breathDice(level, big), ...(b?.type ? { type: b.type } : {}) },
    save: { dc: 8 + (mods?.con ?? 0) + prof, ability: save },
    area: b?.area ?? (big ? { cone: 15, line: [5, 30] } : {}),
  }
}

type EffectAs = Omit<LiveEffect, 'on' | 'id' | 'name' | 'from'>
/** `optionsAs`: options whose effect is the feature's own (Rage of the Wilds: the same Rage, with the picked animal). */
type FeatureTemplate = (ctx: UseContext) => UsePlan & { effectAs?: EffectAs; optionsAs?: { id: string; name: string; effectAs: EffectAs; note?: UseNote }[] }

/** Features with numbers, by resource id. Everything else still gets Use: it spends one and logs it. */
export const FEATURE_TEMPLATES: Record<string, FeatureTemplate> = {
  'second-wind': ({ classLevel }) => ({ heal: `1d10+${classLevel}` }),
  'lay-on-hands': () => ({ pool: 'heal' }),
  rage: ({ edition, bear, wildHeart }) => {
    const rage = (resist: ItemEffect[]) => ({
      duration: edition === '2024' ? '10 minutes' : '1 minute', ends: 'short' as const,
      stats: [...resist, { kind: 'advantage', on: 'save:str' } as ItemEffect, { kind: 'advantage', on: 'checks', when: 'with Strength' } as ItemEffect],
    })
    // Rage of the Wilds (2024 Wild Heart): the animal is picked each time you rage.
    if (wildHeart) {
      return {
        optionsAs: [
          { id: 'bear', name: 'Bear', effectAs: rage(WILD_BEAR), note: { key: 'wildBear' } },
          { id: 'eagle', name: 'Eagle', effectAs: rage(BPS), note: { key: 'wildEagle' } },
          { id: 'wolf', name: 'Wolf', effectAs: rage(BPS), note: { key: 'wildWolf' } },
        ],
      }
    }
    return { effectAs: rage(bear ? BEAR : BPS) }
  },
  // 2024: temp HP equal to the druid level. The beast form is picked when used.
  'wild-shape': ({ classLevel, edition, moon }) => ({
    ...(edition === '2024' ? { tempHp: String(classLevel) } : {}),
    form: wildShapeLimit(edition, classLevel, moon),
    effectAs: { duration: hours(Math.max(1, Math.floor(classLevel / 2))), ends: 'long' },
  }),
  'bardic-inspiration': ({ classLevel }) => ({ give: inspirationDie(classLevel) }),
  // 2024 Magical Cunning: half the pact slots (rounded up) come back.
  'magical-cunning': ({ pactSlots = 1 }) => ({ pactSlots: Math.ceil(pactSlots / 2) }),
  'race:breath-weapon': breath(false),
  'race:breath-weapon-fizban': breath(true),
  'innate-sorcery': () => ({
    effectAs: { duration: '1 minute', ends: 'short', stats: [{ kind: 'spellDc', value: 1 }, { kind: 'advantage', on: 'attacks', when: 'with spells' }] },
  }),
  // Arcane Recovery and Natural Recovery: slots of combined level up to half the class level (rounded up), none 6th or higher.
  'arcane-recovery': ({ classLevel }) => ({ recover: { budget: Math.ceil(classLevel / 2), maxLevel: 5 } }),
  'sub:land:natural-recovery': ({ classLevel }) => ({ recover: { budget: Math.ceil(classLevel / 2), maxLevel: 5 } }),
  'sub:circle-of-the-land:natural-recovery': ({ classLevel }) => ({ recover: { budget: Math.ceil(classLevel / 2), maxLevel: 5 } }),
  'channel-divinity': ctx => ({ options: (ctx.channel ?? []).map(o => channelOption(o, ctx)) }),
  // 2024 Uncanny Metabolism: all Focus Points back and a Martial Arts die plus the monk level in healing.
  'class:monk:uncanny-metabolism': ({ classLevel, edition }) => ({ heal: `${martialArtsDie(classLevel, edition)}+${classLevel}`, refill: 'focus' }),
  // Features without uses, by feature id: used when they trigger.
  'dark-ones-blessing': ({ classLevel, mods }) => ({ tempHp: String(Math.max(1, (mods?.cha ?? 0) + classLevel)) }),
}

/** The Martial Arts die by monk level: 2014 d4 → d10, 2024 d6 → d12. */
export function martialArtsDie(monkLevel: number, edition: '2014' | '2024'): string {
  const step = [1, 5, 11, 17].filter(x => monkLevel >= x).length - 1
  return `1d${(edition === '2024' ? 6 : 4) + 2 * Math.max(0, step)}`
}

/** Reckless Attack: advantage on Strength melee attacks this turn (and attacks against you have advantage). */
export const RECKLESS_ID = 'feature:reckless-attack'
export const recklessEffect = (): Omit<LiveEffect, 'on'> => ({
  id: RECKLESS_ID, name: 'Reckless Attack', from: 'feature', duration: '1 round', ends: 'short',
  stats: [{ kind: 'advantage', on: 'attacks', when: STRENGTH_MELEE }],
})

// ---- Channel Divinity ----

type ChannelPlan = (o: ChannelSource, ctx: UseContext) => UsePlan & { effectAs?: Omit<LiveEffect, 'on' | 'id' | 'name' | 'from'> }

const saveOf = (ability: Ability): ChannelPlan => o => ({ save: { dc: o.dc, ability } })
const noted = (key: string, vars?: (o: ChannelSource, ctx: UseContext) => UseNote['vars']): ChannelPlan => (o, ctx) => ({ note: { key, ...(vars ? { vars: vars(o, ctx) } : {}) } })
const both = (...plans: ChannelPlan[]): ChannelPlan => (o, ctx) => Object.assign({}, ...plans.map(p => p(o, ctx)))
const lasting = (duration: string | ((ctx: UseContext) => string), stats: ItemEffect[] | ((o: ChannelSource) => ItemEffect[]) = []): ChannelPlan => (o, ctx) => {
  const list = typeof stats === 'function' ? stats(o) : stats
  return { effectAs: { duration: typeof duration === 'string' ? duration : duration(ctx), ends: 'short', ...(list.length ? { stats: list } : {}) } }
}
/** 2024 Divine Spark: 1d8 at cleric 2, 2d8 at 7, 3d8 at 13, 4d8 at 18, plus WIS. */
const sparkDice = (level: number) => [2, 7, 13, 18].filter(x => level >= x).length

/**
 * Channel Divinity options by name (class options, oath and domain options from every book), and what each does.
 * 2014 subclass features are named "Channel Divinity: X"; the name here is X. Options not listed still spend a use.
 */
export const CHANNEL_OPTIONS: Record<string, ChannelPlan> = {
  // Class options
  'Turn Undead': both(saveOf('wis'), noted('turnUndead')),
  'Divine Spark': both(o => ({ hit: { dice: plus(`${Math.max(1, sparkDice(o.classLevel))}d8`, o.mod) }, save: { dc: o.dc, ability: 'con' } }), noted('divineSpark')),
  'Divine Sense': both(lasting('10 minutes'), noted('divineSense')),
  // Cleric domains
  'Preserve Life': noted('preserveLife', o => ({ n: 5 * o.classLevel })),
  'Radiance of the Dawn': both(o => ({ hit: { dice: `2d10+${o.classLevel}`, type: 'radiant' }, save: { dc: o.dc, ability: 'con' } }), noted('radianceOfTheDawn')),
  'Guided Strike': noted('guidedStrike'),
  "War God's Blessing": noted('warGodsBlessing'),
  'Destructive Wrath': noted('destructiveWrath'),
  'Invoke Duplicity': both(lasting('1 minute'), noted('invokeDuplicity')),
  'Touch of Death': noted('touchOfDeath', o => ({ n: 5 + 2 * o.classLevel })),
  'Twilight Sanctuary': both(lasting('1 minute'), noted('twilightSanctuary')),
  'Knowledge of the Ages': both(lasting('10 minutes'), noted('knowledgeOfTheAges')),
  'Arcane Abjuration': saveOf('wis'),
  'Charm Animals and Plants': saveOf('wis'),
  "Order's Demand": saveOf('wis'),
  'Read Thoughts': saveOf('wis'),
  // Paladin oaths
  'Sacred Weapon': both(lasting(ctx => (ctx.edition === '2024' ? '10 minutes' : '1 minute'), o => [{ kind: 'attack', value: Math.max(1, o.mod) }]), noted('sacredWeapon')),
  'Turn the Unholy': saveOf('wis'),
  "Nature's Wrath": (o, ctx) => ({ save: { dc: o.dc, ability: ctx.edition === '2024' ? 'str' : 'dex' } }),
  'Turn the Faithless': saveOf('wis'),
  'Abjure Enemy': saveOf('wis'),
  'Vow of Enmity': both(lasting('1 minute', [{ kind: 'advantage', on: 'attacks', when: 'against the vowed creature' }]), noted('vowOfEnmity')),
  'Conquering Presence': saveOf('wis'),
  'Champion Challenge': saveOf('wis'),
  'Turn the Tide': noted('turnTheTide', (_o, ctx) => ({ dice: plus('1d6', Math.max(1, ctx.mods?.cha ?? 0)) })),
  'Inspiring Smite': noted('inspiringSmite', o => ({ dice: `2d8+${o.classLevel}` })),
  'Peerless Athlete': lasting(ctx => (ctx.edition === '2024' ? '1 hour' : '10 minutes'), [
    { kind: 'advantage', on: 'skill:athletics' }, { kind: 'advantage', on: 'skill:acrobatics' },
  ]),
  'Control Undead': saveOf('wis'),
  'Dreadful Aspect': saveOf('wis'),
  'Emissary of Peace': lasting('10 minutes', [{ kind: 'skill', skill: 'persuasion', value: 5 }]),
  'Rebuke the Violent': saveOf('wis'),
  "Watcher's Will": noted('watchersWill'),
  'Abjure the Extraplanar': saveOf('wis'),
}

/** "Channel Divinity: Sacred Weapon" → "Sacred Weapon"; undefined when the feature isn't a Channel Divinity option. */
export function channelOptionName(featureName: string): string | undefined {
  const m = /^Channel Divinity:\s*(.+)$/.exec(featureName.trim())
  if (m) return m[1]
  return CHANNEL_OPTIONS[featureName.trim()] ? featureName.trim() : undefined
}

function channelOption(o: ChannelSource, ctx: UseContext): UseOption {
  const tpl = CHANNEL_OPTIONS[o.name]?.(o, ctx) ?? {}
  const { effectAs, ...plan } = tpl
  const id = `channel-divinity:${o.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  return { id, name: o.name, plan: effectAs ? { ...plan, effect: { id: featureEffectId(id), name: o.name, from: 'feature', ...effectAs } } : plan }
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
export interface FeatureAction {
  kind: Kind
  spend?: { pools: string[]; n: number }
  use?: string
  /** A save it forces, and the ability its DC is figured from (Stunning Strike: CON save, DC 8 + WIS + proficiency). */
  save?: { ability: Ability; dc: Ability }
  /** Costs nothing; spending `boost` points from the pool does more (2024 Patient Defense). */
  boost?: { pools: string[]; n: number }
}

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
  'Natural Recovery': { kind: 'other' },
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
  'Martial Arts': { kind: 'bonus' },
  'Flurry of Blows': { kind: 'bonus', spend: KI },
  'Patient Defense': { kind: 'bonus', spend: KI },
  'Step of the Wind': { kind: 'bonus', spend: KI },
  'Stunning Strike': { kind: 'free', spend: KI, save: { ability: 'con', dc: 'wis' } },
  'Uncanny Metabolism': { kind: 'free' },
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
  const { effectAs, optionsAs, ...rest } = tpl
  const effect = (as: EffectAs, label = name) => ({ id: featureEffectId(resourceId), name: label, from: 'feature' as const, ...as })
  if (optionsAs) rest.options = optionsAs.map(o => ({ id: o.id, name: o.name, plan: { effect: effect(o.effectAs, `${name} (${o.name})`), ...(o.note ? { note: o.note } : {}) } }))
  return effectAs ? { ...rest, effect: effect(effectAs) } : rest
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

/** A spell given "at its maximum" (2024 Fiendish Vigor): its rolls count as their highest value. */
export const castsAtMax = (note = '') => /\bmaximum\b/i.test(note)

/** The highest a roll can come up: "2d4+4" → 12. */
export function maxOfDice(notation: string): number {
  return notation.replace(/\s+/g, '').split(/(?=[+-])/).reduce((sum, part) => {
    const m = /^([+-]?)(\d*)d(\d+)$/i.exec(part)
    const sign = part.startsWith('-') ? -1 : 1
    return sum + (m ? sign * Number(m[2] || 1) * Number(m[3]) : Number(part) || 0)
  }, 0)
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

/** Life Domain's Disciple of Life: a leveled healing spell restores 2 + the spell's level more (both editions). */
export function healingSpellBonus(classes: { classId: string; subclassId?: string }[], castLevel: number): number {
  const life = classes.some(c => c.classId === 'cleric' && (c.subclassId === 'life' || c.subclassId === 'life-domain'))
  return life && castLevel > 0 ? 2 + castLevel : 0
}

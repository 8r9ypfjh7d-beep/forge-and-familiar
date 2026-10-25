// Pure helpers for the combat page: spells as attack rows, the player's own actions, toggled effects, weapon mastery.
import type { Feature, Spell } from '../../content'
import type { ActionKind, Character, CustomAction } from '../../model/character'
import { getDamageRiders, type DerivedStats } from '../../rules'
import type { Ability } from '../../rules/types'
import { formatNotation, parseNotation } from '../../dice/notation'
import { spellDamage } from '../../quickcast/quickcast'
import type { SpellEntry } from '../../quickcast/types'
import { toQuickCast } from '../../spellbook/spellbook'

export type { ActionKind, CustomAction } from '../../model/character'

/** The groups shown under the attacks table, in order. */
export const ACTION_KINDS: ActionKind[] = ['action', 'bonus', 'reaction', 'free', 'other']

export const newActionId = () => `act-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const actionsOf = (c: Character, kind: ActionKind): CustomAction[] => (c.customActions ?? []).filter(a => a.kind === kind)

/** Adds an action the player typed in. Blank names are ignored. */
export function addAction(c: Character, action: CustomAction): Character {
  const name = action.name.trim()
  if (!name) return c
  return { ...c, customActions: [...(c.customActions ?? []), { ...action, name, description: action.description?.trim() || undefined }] }
}

export function updateAction(c: Character, id: string, patch: Partial<Omit<CustomAction, 'id'>>): Character {
  return { ...c, customActions: (c.customActions ?? []).map(a => (a.id === id ? { ...a, ...patch } : a)) }
}

export function removeAction(c: Character, id: string): Character {
  return { ...c, customActions: (c.customActions ?? []).filter(a => a.id !== id) }
}

const TOKENS: Record<string, (s: DerivedStats) => number> = {
  str: s => s.mods.str, dex: s => s.mods.dex, con: s => s.mods.con, int: s => s.mods.int, wis: s => s.mods.wis, cha: s => s.mods.cha,
  prof: s => s.proficiencyBonus, level: s => s.level,
}

/**
 * Dice a player typed for an action, with STR…CHA (modifiers), PROF and LEVEL filled in: "1d8+CHA" → "1d8+3".
 * Undefined when blank or not valid dice.
 */
export function resolveDice(text: string | undefined, stats: DerivedStats): string | undefined {
  const raw = text?.trim()
  if (!raw) return undefined
  const filled = raw.replace(/\s+/g, '')
    .replace(/(str|dex|con|int|wis|cha|prof|level)/gi, m => `${TOKENS[m.toLowerCase()](stats)}`)
    .replace(/\+-/g, '-').replace(/--/g, '+')
  try {
    return formatNotation(parseNotation(filled))
  } catch {
    return undefined
  }
}

/** A typed damage type that means healing, in English or Hebrew. */
export const isHealing = (type?: string) => !!type && /^(healing|heal|ריפוי)$/i.test(type.trim())

/** What tapping a custom action rolls: an attack bonus or a save DC, and dice. */
export function actionRoll(a: CustomAction, stats: DerivedStats): { attackBonus?: number; dc?: number; save?: Ability; dice?: string } {
  const r = a.roll
  if (!r) return {}
  const mod = r.ability ? stats.mods[r.ability] : 0
  return {
    ...(r.check === 'attack' ? { attackBonus: mod + stats.proficiencyBonus } : {}),
    ...(r.check === 'save' ? { dc: 8 + stats.proficiencyBonus + mod, ...(r.save ? { save: r.save } : {}) } : {}),
    ...(resolveDice(r.dice, stats) ? { dice: resolveDice(r.dice, stats) } : {}),
  }
}

/** One spell shown in the attacks table. */
export interface SpellAttackRow {
  name: string
  level: number
  /** Library range text ("120 feet", "Touch"), or blank for a typed-in spell. */
  range: string
  kind: 'attack' | 'save'
  /** Spell attack bonus, or the save DC. */
  value: number
  save?: Ability
  /** Damage or healing at the base level, cantrips scaled to the character. */
  damage?: string
  damageType?: string
  entry: Omit<SpellEntry, 'id' | 'kind'>
}

/**
 * Spells that attack or force a save: the character's known library spells first, then spells
 * typed into the quick-cast bar that aren't in the library (homebrew, other books).
 */
export function spellAttackRows(c: Character, stats: DerivedStats, library: Spell[]): SpellAttackRow[] {
  const sc = stats.spellcasting
  if (!sc) return []
  const byId = new Map(library.map(s => [s.id, s]))
  const known = (c.spells ?? []).map(k => byId.get(k.id)).filter((s): s is Spell => !!s)
  const out: SpellAttackRow[] = []
  const seen = new Set<string>()
  const push = (entry: Omit<SpellEntry, 'id' | 'kind'>, range: string) => {
    const key = entry.name.toLowerCase()
    if (seen.has(key) || entry.roll === 'none') return
    seen.add(key)
    const damage = spellDamage({ ...entry, id: '', kind: 'spell' }, entry.level, stats.level, stats.mods[sc.ability])
    out.push({
      name: entry.name, level: entry.level, range, kind: entry.roll,
      value: entry.roll === 'attack' ? sc.attackBonus : sc.saveDc,
      ...(entry.save ? { save: entry.save } : {}),
      ...(damage ? { damage } : {}),
      ...(entry.damageType ? { damageType: entry.damageType } : {}),
      entry,
    })
  }
  for (const s of known) push(toQuickCast(withRollFromText(s)), s.range)
  for (const q of c.quickCast ?? []) if (q.kind === 'spell') push(q, byName(library, q.name)?.range ?? '')
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

const ABILITY_WORDS: Record<string, Ability> = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' }

/** Some library spells (2024 Charm Person) have no structured attack or save: read it from the text. */
export function withRollFromText(s: Spell): Spell {
  if (s.attack || s.save) return s
  const attack = /\b(melee|ranged) spell attack\b/i.exec(s.description)
  if (attack) return { ...s, attack: attack[1].toLowerCase() as 'melee' | 'ranged' }
  const save = /\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw\b/i.exec(s.description)
  return save ? { ...s, save: { ability: ABILITY_WORDS[save[1].toLowerCase()], onSuccess: 'other' } } : s
}

const byName = (spells: Spell[], name: string) => spells.find(s => s.name.toLowerCase() === name.toLowerCase())

/** The library entry for one of derive()'s features: same name, the class's own entry first. */
export function matchFeature(features: Feature[], name: string, className: string): Feature | undefined {
  const n = name.toLowerCase()
  const same = features.filter(f => f.name.toLowerCase() === n)
  return same.find(f => f.classId === className.toLowerCase()) ?? same[0]
}

/** Damage a toggled effect adds to each hit. */
export interface EffectToggle {
  id: string
  /** Feature or spell name. */
  name: string
  damage: string
  damageType?: string
  /** Weapon attacks only (Rage, Sneak Attack); spell effects also ride on spell attacks. */
  weaponOnly?: boolean
  oncePerTurn?: boolean
}

/** Spells whose ongoing effect adds damage to the caster's hits (SRD 5.1 and 5.2). */
const SPELL_EFFECTS: Record<string, { damage: string; damageType?: string }> = {
  hex: { damage: '1d6', damageType: 'necrotic' },
  'hunters-mark': { damage: '1d6' },
  'divine-favor': { damage: '1d4', damageType: 'radiant' },
}

const slug = (name: string) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Effects the player can switch on: Rage and Sneak Attack from features, Hex-like spells they know or pinned. */
export function effectToggles(c: Character, stats: DerivedStats, spellNames: Record<string, string> = {}): EffectToggle[] {
  const out: EffectToggle[] = []
  for (const a of stats.attacks) {
    for (const r of getDamageRiders(c, a)) {
      if (!out.some(e => e.id === r.id)) out.push({ id: r.id, name: r.name, damage: r.damage, weaponOnly: true, ...(r.oncePerTurn ? { oncePerTurn: true } : {}) })
    }
  }
  const ids = new Set([...(c.spells ?? []).map(s => s.id), ...(c.quickCast ?? []).flatMap(q => (q.kind === 'spell' ? [slug(q.name)] : []))])
  for (const [id, fx] of Object.entries(SPELL_EFFECTS)) {
    if (ids.has(id)) out.push({ id, name: spellNames[id] ?? id, ...fx })
  }
  // The player's own actions that carry an effect (a curse, a blessing, a stance).
  for (const a of c.customActions ?? []) {
    const damage = a.effect && resolveDice(a.effect.damage, stats)
    if (damage) out.push({ id: `act:${a.id}`, name: a.name, damage, ...(a.effect?.type ? { damageType: a.effect.type } : {}) })
  }
  return out
}

/** Weapon Mastery (SRD 5.2): how many weapons' mastery properties the character can use. 0 without the feature. */
export function masteryLimit(c: Pick<Character, 'classes' | 'spellEdition'>): number {
  if (c.spellEdition !== '2024') return 0
  const per = (id: string, level: number) => {
    if (id === 'fighter') return level >= 16 ? 6 : level >= 10 ? 5 : level >= 4 ? 4 : 3
    if (id === 'barbarian') return level >= 10 ? 4 : level >= 4 ? 3 : 2
    return ['paladin', 'ranger', 'rogue'].includes(id) ? 2 : 0
  }
  return Math.max(0, ...c.classes.map(cl => per(cl.classId, cl.level)))
}

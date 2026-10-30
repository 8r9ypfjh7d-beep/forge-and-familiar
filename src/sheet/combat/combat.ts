// Pure helpers for the combat page: spells as attack rows, the player's own actions, toggled effects, weapon mastery.
import type { Feature, Spell } from '../../content'
import type { ActionKind, Character, CustomAction, LiveEffect } from '../../model/character'
import { cantripDamageBonus, classChoices, featureEffectId, getDamageRiders, getWeaponMasteryCount, hasRunningNumbers, itemSpellCast, planCast, spellEffectId, weaponMastery, type DerivedStats } from '../../rules'
import type { Ability, ItemEffect } from '../../rules/types'
import { formatNotation, parseNotation } from '../../dice/notation'
import { slotChoices, spellBeams, spellDamage } from '../../quickcast/quickcast'
import type { SlotChoice } from '../../quickcast/types'
import type { SpellEntry } from '../../quickcast/types'
import { editionOf } from '../../spellbook/access'
import { toQuickCast } from '../../spellbook/spellbook'
import { explainKey, featureKey } from '../../builder/why'
import type { MessageKey } from '../../i18n/locales/en'

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

/** Switches an action's effect on or off. Saved, so its stat changes stay until switched off. */
export function setActionActive(c: Character, id: string, on: boolean): Character {
  return updateAction(c, id, { active: on || undefined })
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
  /** Damage or healing at the base level, cantrips scaled to the character; per beam when it makes several attacks. */
  damage?: string
  /** Separate attacks it makes (Eldritch Blast's beams, Scorching Ray's rays), when more than one. */
  beams?: number
  damageType?: string
  entry: Omit<SpellEntry, 'id' | 'kind'>
}

/**
 * Spells that attack or force a save: the character's known library spells first, then spells
 * pinned by hand that aren't in the library (homebrew, other books).
 */
export function spellAttackRows(c: Character, stats: DerivedStats, library: Spell[]): SpellAttackRow[] {
  const innate = innateCantrips(stats, library)
  // A character without a casting class still attacks with a race's cantrip: its own ability, else the best of INT, WIS and CHA.
  const sc = stats.spellcasting ?? (innate.length ? innateCasting(stats, innate[0].ability) : undefined)
  if (!sc) return []
  const byId = new Map(library.map(s => [s.id, s]))
  const known = (c.spells ?? []).flatMap(k => { const s = byId.get(k.id); return s ? [{ s, classId: k.classId }] : [] })
  const out: SpellAttackRow[] = []
  const seen = new Set<string>()
  // 2024 Potent Spellcasting (Cleric Blessed Strikes, Druid Elemental Fury): WIS on that class's cantrip damage.
  const potent = new Set(c.rulesEdition === '2024' ? classChoices(c).filter(x => x.picked?.id === 'potent-spellcasting').map(x => x.classId) : [])
  const push = (entry: Omit<SpellEntry, 'id' | 'kind'>, range: string, classId?: string, own = sc) => {
    const key = entry.name.toLowerCase()
    if (seen.has(key) || entry.roll === 'none') return
    seen.add(key)
    const beams = spellBeams(entry, entry.level, stats.level)
    let damage = spellDamage({ ...entry, id: '', kind: 'spell' }, entry.level, stats.level, stats.mods[own.ability], cantripDamageBonus(c, entry.name, stats.mods.cha))
    const wis = stats.mods.wis
    if (damage && entry.level === 0 && classId && potent.has(classId) && wis) damage = formatNotation(parseNotation(`${damage}${wis > 0 ? '+' : ''}${wis}`))
    out.push({
      name: entry.name, level: entry.level, range, kind: entry.roll,
      value: entry.roll === 'attack' ? own.attackBonus : own.saveDc,
      ...(entry.save ? { save: entry.save } : {}),
      ...(damage ? { damage } : {}),
      ...(beams > 1 ? { beams } : {}),
      ...(entry.damageType ? { damageType: entry.damageType } : {}),
      entry,
    })
  }
  for (const { s, classId } of known) push(toQuickCast(withRollFromText(s)), s.range, classId)
  for (const q of c.quickCast ?? []) if (q.kind === 'spell') push(q, byName(library, q.name)?.range ?? '')
  // Cantrips from the race, a feat or an item (a Tiefling's Fire Bolt): at will, so they sit with the attacks.
  for (const { spell, ability } of innate) push(toQuickCast(withRollFromText(spell)), spell.range, undefined, ability ? innateCasting(stats, ability) : sc)
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

const ABILITY_WORDS: Record<string, Ability> = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' }

const NOTE_ABILITIES: [RegExp, Ability][] = [[/\bintelligence\b/i, 'int'], [/\bwisdom\b/i, 'wis'], [/\bcharisma\b/i, 'cha']]

/** Library cantrips the character casts from its race, feats or items, with the ability their note names, if any. */
function innateCantrips(stats: DerivedStats, library: Spell[]): { spell: Spell; ability?: Ability }[] {
  return stats.itemSpells.flatMap(s => {
    const spell = byName(library, itemSpellCast(s.spell).name)
    if (spell?.level !== 0) return []
    const ability = NOTE_ABILITIES.find(([re]) => re.test(s.note ?? ''))?.[1]
    return [{ spell, ...(ability ? { ability } : {}) }]
  })
}

/** Attack bonus and save DC for innate spells cast with `ability` (default: the best of INT, WIS and CHA). */
function innateCasting(stats: DerivedStats, ability?: Ability): NonNullable<DerivedStats['spellcasting']> {
  const a = ability ?? (['int', 'wis', 'cha'] as const).reduce((best, x) => (stats.mods[x] > stats.mods[best] ? x : best), 'cha' as Ability)
  return { ability: a, attackBonus: stats.proficiencyBonus + stats.mods[a], saveDc: 8 + stats.proficiencyBonus + stats.mods[a] }
}

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
export function matchFeature(features: Feature[], name: string, className: string, subclassId?: string): Feature | undefined {
  const n = name.toLowerCase()
  const same = features.filter(f => f.name.toLowerCase() === n)
  // Subclasses share names with different rules ("Bonus Proficiencies", "Divine Strike"): only that subclass's own entry fits.
  if (subclassId) return same.find(f => f.subclassId === subclassId)
  const base = same.filter(f => !f.subclassId)
  return base.find(f => f.classId === className.toLowerCase()) ?? base[0]
}

/**
 * A class or subclass feature's text: the player's own text, then the SRD library entry for that class or subclass,
 * then that subclass's own summary (why.subfeature), then the summary shared by every feature of that name.
 */
export function featureDescription(
  features: Feature[],
  f: Pick<DerivedStats['features'][number], 'name' | 'className' | 'subclassId' | 'text'>,
  explain: (key: MessageKey) => string,
): string | undefined {
  if (f.text) return f.text
  const srd = matchFeature(features, f.name, f.className, f.subclassId)?.description
  if (srd) return srd
  const own = f.subclassId ? explainKey('subfeature', `${f.subclassId}.${f.name}`) : undefined
  if (own) return explain(own)
  const shared = featureKey(f.name)
  return shared ? explain(shared) : undefined
}

const slug = (name: string) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Damage a toggled effect adds to each hit. */
export interface EffectToggle {
  id: string
  /** Feature or spell name. */
  name: string
  /** Extra damage dice on each hit; a custom action may only change stats. */
  damage?: string
  damageType?: string
  /** A custom action's or running spell's stat changes, applied by the rules engine while it is switched on. */
  stats?: ItemEffect[]
  /** A feature's own rider (Rage, Sneak Attack): it rides only on the weapons that allow it. */
  feature?: boolean
  /** Weapon attacks only (Divine Favor, smites, Rage); otherwise spell attacks get it too. */
  weaponOnly?: boolean
  oncePerTurn?: boolean
  /** The running spell or feature behind the switch (saved on the character), when there is one. */
  live?: LiveEffect
  /** What switching it on starts, for a known spell that isn't running yet (Hex before the fight). */
  start?: Omit<LiveEffect, 'on'>
  /** Switching it on spends this slot (2014 Divine Smite); for a spell, the slot a cast takes unless another is picked. */
  slot?: SlotChoice
  /** A known spell that isn't running: switching it on casts it (slot, temporary HP, rolls), like Cast. */
  spell?: Spell
}

/**
 * Effects the player can switch on: Rage and Sneak Attack from features, every known or pinned spell
 * whose running effect changes numbers (Hex, Bless, Shield of Faith...), everything running now, and the
 * player's own actions with an effect.
 */
export function effectToggles(c: Character, stats: DerivedStats, spells: Spell[] = []): EffectToggle[] {
  const out: EffectToggle[] = []
  for (const a of stats.attacks) {
    for (const r of getDamageRiders(c, a)) {
      if (out.some(e => e.id === r.id)) continue
      // Rage used from Resources is a running effect; its switch follows it.
      const live = (c.state.effects ?? []).find(e => e.id === featureEffectId(r.id))
      out.push({ id: r.id, name: r.name, damage: r.damage, feature: true, weaponOnly: true, ...(r.oncePerTurn ? { oncePerTurn: true } : {}), ...(live ? { live, stats: live.stats } : {}) })
    }
  }
  const running = c.state.effects ?? []
  const fromLive = (live: Omit<LiveEffect, 'on'> & { on?: boolean }) => ({
    ...(live.damage ? { damage: live.damage } : {}),
    ...(live.damageType ? { damageType: live.damageType } : {}),
    ...(live.weaponOnly ? { weaponOnly: true } : {}),
    ...(live.stats?.length ? { stats: live.stats } : {}),
  })
  const ids = new Set([...(c.spells ?? []).map(s => s.id), ...(c.quickCast ?? []).flatMap(q => (q.kind === 'spell' ? [slug(q.name)] : []))])
  const ctx = { edition: editionOf(c), mod: stats.spellcasting ? stats.mods[stats.spellcasting.ability] : 0, speed: stats.speed }
  for (const s of spells) {
    if (!ids.has(s.id) || !hasRunningNumbers(s, ctx)) continue
    const live = running.find(e => e.id === spellEffectId(s.id))
    // Shown at the slot a cast would take (a level 5 warlock's Armor of Agathys is 3rd level).
    const slot = s.level > 0 ? slotChoices(c, s.level)[0] : undefined
    const start = planCast(s, slot?.level ?? s.level, ctx).effect
    if (!start || out.some(e => e.id === start.id)) continue
    out.push({ id: start.id, name: s.name, ...fromLive(live ?? start), ...(live ? { live } : { start, spell: s, ...(slot ? { slot } : {}) }) })
  }
  // 2014 Divine Smite: a feature that spends a slot for radiant damage on the next hit, so its switch spends the lowest free slot.
  const paladin = c.classes.find(cl => cl.classId === 'paladin')
  if (paladin && paladin.level >= 2 && editionOf(c) !== '2024' && !out.some(e => e.id === 'feature:divine-smite')) {
    const live = running.find(e => e.id === 'feature:divine-smite')
    const slot = slotChoices(c, 1)[0]
    if (live || slot) {
      const damage = live?.damage ?? `${Math.min(5, 1 + (slot?.level ?? 1))}d8`
      const start = { id: 'feature:divine-smite', name: 'Divine Smite', from: 'feature' as const, damage, damageType: 'radiant', weaponOnly: true, once: true, ends: 'short' as const, ...(slot ? { level: slot.level } : {}) }
      out.push({ id: start.id, name: start.name, damage, damageType: 'radiant', weaponOnly: true, ...(live ? { live } : { start, slot }) })
    }
  }
  // Running effects from anything else: spells cast from an item or pinned under another name, features, items.
  for (const live of running) if (!out.some(e => e.id === live.id || e.live?.id === live.id)) out.push({ id: live.id, name: live.name, ...fromLive(live), live })
  // The player's own actions that carry an effect (a curse, a blessing, a stance): extra damage, stat changes or both.
  for (const a of c.customActions ?? []) {
    const damage = a.effect && resolveDice(a.effect.damage, stats)
    if (!damage && !a.stats?.length) continue
    out.push({
      id: `act:${a.id}`, name: a.name,
      ...(damage ? { damage } : {}),
      ...(damage && a.effect?.type ? { damageType: a.effect.type } : {}),
      ...(a.stats?.length ? { stats: a.stats } : {}),
    })
  }
  return out
}

/** An effect that went into one roll: the dice it added and the stat changes that applied. */
export interface UsedEffect { id: string; name: string; damage?: string; damageType?: string; stats: ItemEffect[] }

/**
 * Which switched-on effects changed a roll, so the result can say so.
 * `riderIds` are the effects whose dice were added; `applies` picks the stat changes that touch this roll.
 */
export function effectsUsed(active: EffectToggle[], riderIds: Iterable<string>, applies: (f: ItemEffect) => boolean): UsedEffect[] {
  const riders = new Set(riderIds)
  return active.flatMap(e => {
    const stats = (e.stats ?? []).filter(applies)
    const dice = riders.has(e.id) && e.damage
    if (!dice && !stats.length) return []
    return [{ id: e.id, name: e.name, ...(dice ? { damage: e.damage } : {}), ...(dice && e.damageType ? { damageType: e.damageType } : {}), stats }]
  })
}

/**
 * Weapon Mastery: the weapons the player picked in the builder, with their property, up to the limit.
 * Characters saved before the picks existed fall back to their attacks' weapons (`fallback` item ids).
 */
export function masteredWeapons(c: Pick<Character, 'classes' | 'spellEdition' | 'rulesEdition' | 'weaponMasteries'>, fallback: string[] = []): { itemId: string; mastery: string }[] {
  const limit = masteryLimit(c)
  const ids = c.weaponMasteries?.length ? c.weaponMasteries : fallback
  return [...new Set(ids)].flatMap(itemId => { const mastery = weaponMastery(itemId); return mastery ? [{ itemId, mastery }] : [] }).slice(0, limit)
}

/** Weapon Mastery (SRD 5.2): how many weapons' mastery properties the character can use. 0 without the feature. */
export function masteryLimit(c: Pick<Character, 'classes' | 'spellEdition' | 'rulesEdition'>): number {
  if (c.rulesEdition === '2024') return getWeaponMasteryCount(c)
  // Older saves that only switched their spells to 2024.
  if (c.spellEdition !== '2024') return 0
  const per = (id: string, level: number) => {
    if (id === 'fighter') return level >= 16 ? 6 : level >= 10 ? 5 : level >= 4 ? 4 : 3
    if (id === 'barbarian') return level >= 10 ? 4 : level >= 4 ? 3 : 2
    return ['paladin', 'ranger', 'rogue'].includes(id) ? 2 : 0
  }
  return Math.max(0, ...c.classes.map(cl => per(cl.classId, cl.level)))
}

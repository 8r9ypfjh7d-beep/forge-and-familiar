// Changes to a character's chosen spells, and turning a library spell into a quick-cast entry.
import type { Spell } from '../content'
import type { Character, KnownSpell } from '../model/character'
import { addEntry, AUTO_HIT, newEntryId } from '../quickcast/quickcast'
import type { SpellEntry } from '../quickcast/types'
import type { Ability } from '../rules/types'

export const spellsOf = (c: Character, classId?: string): KnownSpell[] =>
  (c.spells ?? []).filter(s => !classId || s.classId === classId)

export const hasSpell = (c: Character, classId: string, id: string) => spellsOf(c, classId).some(s => s.id === id)

export function addSpell(c: Character, classId: string, id: string): Character {
  if (hasSpell(c, classId, id)) return c
  return { ...c, spells: [...spellsOf(c), { id, classId }] }
}

export function removeSpell(c: Character, classId: string, id: string): Character {
  return { ...c, spells: spellsOf(c).filter(s => !(s.classId === classId && s.id === id)) }
}

/** A known spell counts as prepared unless it is a spellbook spell marked unprepared. */
export const isPrepared = (k: KnownSpell) => k.prepared !== false

/** Spells only in the wizard's book, not prepared through any class: they can't be cast except as rituals. */
export function unpreparedIds(c: Character): Set<string> {
  const known = spellsOf(c)
  return new Set(known.filter(k => !isPrepared(k) && !known.some(o => o.id === k.id && isPrepared(o))).map(k => k.id))
}

/** Prepares or unprepares a spellbook spell. */
export function setPrepared(c: Character, classId: string, id: string, on: boolean): Character {
  return {
    ...c,
    spells: spellsOf(c).map(s => {
      if (s.classId !== classId || s.id !== id) return s
      const { prepared: _, ...rest } = s
      return on ? rest : { ...rest, prepared: false }
    }),
  }
}

const DICE = /^(\d+)d(\d+)(.*)$/

/** "8d6" → "9d6" gives "1d6": what one slot level above adds. Undefined when the steps aren't plain dice. */
export function upcastStep(base?: string, next?: string): string | undefined {
  const a = base && DICE.exec(base.replace(/\s+/g, ''))
  const b = next && DICE.exec(next.replace(/\s+/g, ''))
  if (!a || !b || a[2] !== b[2] || Number(b[1]) <= Number(a[1])) return undefined
  // A flat bonus that grows too ("3d4+3" → "4d4+4") steps by its own difference.
  const flatA = Number(a[3] || 0)
  const flatB = Number(b[3] || 0)
  const flat = flatB - flatA
  return `${Number(b[1]) - Number(a[1])}d${a[2]}${flat > 0 ? `+${flat}` : ''}`
}

/** Spells whose library entry lacks its save or damage in one edition (2014 Spirit Guardians, 2024 Spiritual Weapon). */
const MISSING_NUMBERS: Record<string, { save?: Ability; damage: string; damageType: string; upcast?: string; addMod?: boolean }> = {
  'spirit guardians': { save: 'wis', damage: '3d8', damageType: 'radiant', upcast: '1d8' },
  'spiritual weapon': { damage: '1d8', damageType: 'force', addMod: true },
}

/** The quick-cast fields for a library spell: how it rolls, its damage or healing, and upcasting. */
export function toQuickCast(s: Spell): Omit<SpellEntry, 'id' | 'kind'> {
  const auto = AUTO_HIT[s.name.trim().toLowerCase()]
  if (auto) return { name: s.name, level: s.level, roll: 'auto', ...auto }
  const entry: Omit<SpellEntry, 'id' | 'kind'> = { name: s.name, level: s.level, roll: s.attack ? 'attack' : s.save ? 'save' : 'none' }
  if (s.save) entry.save = s.save.ability
  const bySlot = s.damage?.bySlotLevel
  const byChar = s.damage?.byCharacterLevel
  if (s.level === 0 && byChar) {
    entry.damage = byChar[1] ?? Object.values(byChar)[0]
    entry.cantripScaling = true
  } else if (bySlot?.[s.level]) {
    const noMod = (n?: string) => n?.replace(/\s*\+\s*MOD/i, '')
    entry.damage = noMod(bySlot[s.level])!.replace(/\s+/g, '')
    if (/MOD/i.test(bySlot[s.level])) entry.addMod = true
    const step = upcastStep(noMod(bySlot[s.level])!, noMod(bySlot[s.level + 1]))
    if (step) entry.upcast = step
  }
  if (entry.damage && s.damage?.type) entry.damageType = s.damage.type
  const gap = MISSING_NUMBERS[s.name.trim().toLowerCase()]
  if (gap) {
    if (!s.save && !s.attack && gap.save) { entry.roll = 'save'; entry.save = gap.save }
    if (!entry.damage) Object.assign(entry, { damage: gap.damage, damageType: gap.damageType, upcast: gap.upcast, addMod: gap.addMod })
  }
  const heal = s.healBySlotLevel?.[s.level]
  if (!entry.damage && heal) {
    entry.damage = heal.replace(/\s*\+\s*MOD/i, '').replace(/\s+/g, '')
    entry.damageType = 'healing'
    if (/MOD/i.test(heal)) entry.addMod = true
    const step = upcastStep(heal.replace(/\s*\+\s*MOD/i, ''), s.healBySlotLevel?.[s.level + 1]?.replace(/\s*\+\s*MOD/i, ''))
    if (step) entry.upcast = step
  }
  return entry
}

export const isPinned = (c: Character, name: string) => (c.quickCast ?? []).some(e => e.kind === 'spell' && e.name === name)

/** Pinned spells, in quick-cast order. Story mode and the combat quick-cast bar share this one list. */
export const pinnedSpells = (c: Character): SpellEntry[] => (c.quickCast ?? []).filter((e): e is SpellEntry => e.kind === 'spell')

/** Pins a library spell (to quick-cast, so it shows in both modes), or unpins every entry with its name. */
export function toggleSpellPin(c: Character, s: Spell): Character {
  if (!isPinned(c, s.name)) return addEntry(c, { id: newEntryId(), kind: 'spell', ...toQuickCast(s) })
  return { ...c, quickCast: (c.quickCast ?? []).filter(e => !(e.kind === 'spell' && e.name === s.name)) }
}

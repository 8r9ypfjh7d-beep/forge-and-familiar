// Changes to a character's chosen spells, and turning a library spell into a quick-cast entry.
import type { Edition, Spell } from '../content'
import type { Character, KnownSpell } from '../model/character'
import type { SpellEntry } from '../quickcast/types'

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

/** Switching rules editions keeps the chosen spells; ids are shared slugs, and ones the new list lacks just don't show. */
export const setEdition = (c: Character, edition: Edition): Character => ({ ...c, spellEdition: edition === '2014' ? undefined : edition })

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

/** The quick-cast fields for a library spell: how it rolls, its damage or healing, and upcasting. */
export function toQuickCast(s: Spell): Omit<SpellEntry, 'id' | 'kind'> {
  const entry: Omit<SpellEntry, 'id' | 'kind'> = { name: s.name, level: s.level, roll: s.attack ? 'attack' : s.save ? 'save' : 'none' }
  if (s.save) entry.save = s.save.ability
  const bySlot = s.damage?.bySlotLevel
  const byChar = s.damage?.byCharacterLevel
  if (s.level === 0 && byChar) {
    entry.damage = byChar[1] ?? Object.values(byChar)[0]
    entry.cantripScaling = true
  } else if (bySlot?.[s.level]) {
    entry.damage = bySlot[s.level].replace(/\s+/g, '')
    const step = upcastStep(bySlot[s.level], bySlot[s.level + 1])
    if (step) entry.upcast = step
  }
  if (entry.damage && s.damage?.type) entry.damageType = s.damage.type
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

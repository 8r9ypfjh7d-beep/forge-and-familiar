// The printable sheet's spell pages: each casting class's spells with its own save DC and attack, spells picked
// through feats, and spells from race and items. Pure: takes the content library like the spellbook does.
import type { CharacterClass, Spell, Subclass } from '../content'
import type { Character } from '../model/character'
import { derive, itemSpellCast, type Ability, type DerivedStats } from '../rules'
import { spellAccess } from '../spellbook/access'
import { extraSpellAbility, isExtraSpell } from '../spellbook/extra'
import { spellsOf, unpreparedIds } from '../spellbook/spellbook'

export interface PrintSpellRow {
  spell: Spell
  /** Subclass or class spells the rules always prepare. */
  always?: boolean
  /** False for a wizard's book spell that isn't prepared today. */
  prepared: boolean
}

export interface PrintSpellClass {
  classId: string
  className: string
  ability: Ability
  saveDc: number
  attack: number
  kind: 'known' | 'prepared'
  cantrips: number
  limit: number
  /** Wizards: how many spells the book should hold. */
  spellbook?: number
  rows: PrintSpellRow[]
}

export interface PrintOtherSpell {
  /** The text the race, feat or item gives ("Fireball (3rd level)"). */
  text: string
  /** The library spell, when it has one, for its details. */
  spell?: Spell
  source: string
  note?: string
  ability?: Ability
}

export interface PrintSpells {
  classes: PrintSpellClass[]
  /** Spells picked through feats or a trait (Magic Initiate, the High Elf cantrip). */
  feats: (PrintSpellRow & { ability?: Ability; saveDc?: number; attack?: number })[]
  other: PrintOtherSpell[]
  /** Every library spell above, once, by level then name: the rules text pages. */
  all: Spell[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const byLevel = (a: Spell, b: Spell) => a.level - b.level || a.name.localeCompare(b.name)

export function printSpells(
  c: Character,
  lib: { spells: Spell[]; classes: CharacterClass[]; subclasses: Subclass[] },
  d: DerivedStats = derive(c),
): PrintSpells {
  const byId = new Map(lib.spells.map(s => [s.id, s]))
  const byName = new Map(lib.spells.map(s => [norm(s.name), s]))
  const off = unpreparedIds(c)
  const dc = (a: Ability) => 8 + d.proficiencyBonus + d.mods[a]
  const hit = (a: Ability) => d.proficiencyBonus + d.mods[a]

  const classes: PrintSpellClass[] = spellAccess(c, lib.classes, lib.subclasses, d.abilities, undefined, lib.spells).map(a => {
    const chosen = spellsOf(c, a.classId).map(k => k.id)
    const rows = [...new Set([...a.alwaysPrepared, ...chosen])]
      .map(id => byId.get(id))
      .filter((s): s is Spell => !!s)
      .sort(byLevel)
      .map(spell => {
        const always = a.alwaysPrepared.includes(spell.id)
        return { spell, ...(always ? { always } : {}), prepared: always || spell.level === 0 || a.spellbook == null || !off.has(spell.id) }
      })
    return {
      classId: a.classId, className: a.className, ability: a.ability, saveDc: dc(a.ability), attack: hit(a.ability),
      kind: a.kind, cantrips: a.cantrips, limit: a.limit, ...(a.spellbook != null ? { spellbook: a.spellbook } : {}), rows,
    }
  })

  const feats = (c.spells ?? []).filter(isExtraSpell).flatMap(k => {
    const spell = byId.get(k.id)
    if (!spell) return []
    const ability = extraSpellAbility(c, k.id)
    return [{ spell, prepared: true, ...(ability ? { ability, saveDc: dc(ability), attack: hit(ability) } : {}) }]
  })
  feats.sort((a, b) => byLevel(a.spell, b.spell))

  const other: PrintOtherSpell[] = d.itemSpells.map(s => {
    const spell = byName.get(norm(itemSpellCast(s.spell).name))
    return { text: s.spell, source: s.source, ...(spell ? { spell } : {}), ...(s.note ? { note: s.note } : {}), ...(s.ability ? { ability: s.ability } : {}) }
  })

  const all = new Map<string, Spell>()
  for (const s of [...classes.flatMap(x => x.rows.map(r => r.spell)), ...feats.map(r => r.spell), ...other.flatMap(o => (o.spell ? [o.spell] : []))]) all.set(s.id, s)
  return { classes, feats, other, all: [...all.values()].sort(byLevel) }
}

/** Whether the character has anything for a spell page: a casting class, slots, or spells from elsewhere. */
export const hasSpellPage = (p: PrintSpells, slots: number) =>
  slots > 0 || p.classes.length > 0 || p.feats.length > 0 || p.other.length > 0

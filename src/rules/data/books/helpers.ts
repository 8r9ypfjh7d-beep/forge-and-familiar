// Shorthands for the book subclass tables.
import type { Ability, ItemEffect, SkillId, SubclassData, SubclassFeature, UsesCount } from '../../types'

export type Def = SubclassData & { id: string }

export const PHB = "Player's Handbook"
export const PHB24 = "Player's Handbook (2024)"
export const DMG = "Dungeon Master's Guide"
export const XGE = "Xanathar's Guide to Everything"
export const TCE = "Tasha's Cauldron of Everything"
export const SCAG = "Sword Coast Adventurer's Guide"
export const VRGR = "Van Richten's Guide to Ravenloft"
export const EGW = "Explorer's Guide to Wildemount"
export const FTD = "Fizban's Treasury of Dragons"
export const MOT = 'Mythic Odysseys of Theros'
export const BGG = "Bigby Presents: Glory of the Giants"
export const DSDQ = 'Dragonlance: Shadow of the Dragon Queen'
export const FRHOF = 'Forgotten Realms: Heroes of Faerûn'

export const f = (level: number, name: string, extra: Omit<SubclassFeature, 'level' | 'name'> = {}): SubclassFeature => ({ level, name, ...extra })
export const short = (count: UsesCount = 1) => ({ uses: { count, recharge: 'short' as const } })
export const long = (count: UsesCount = 1) => ({ uses: { count, recharge: 'long' as const } })
export const fx = (...effects: ItemEffect[]) => ({ effects })

export const resist = (damage: string): ItemEffect => ({ kind: 'resistance', damage })
export const skillProf = (skill: SkillId, expertise?: boolean): ItemEffect => ({ kind: 'skillProficiency', skill, ...(expertise ? { expertise } : {}) })
export const saveProf = (ability: Ability): ItemEffect => ({ kind: 'saveProficiency', ability })
export const move = (mode: 'fly' | 'swim' | 'climb' | 'burrow', value = 0): ItemEffect => ({ kind: 'moveSpeed', mode, value })
export const dark = (value: number): ItemEffect => ({ kind: 'sense', sense: 'darkvision', value })

/** Spell names by class level. */
export const spells = (...rows: [number, ...string[]][]) => rows.map(([level, ...names]) => ({ level, names }))
/** One list of spells per row, gained at the class levels given. */
const at = (levels: number[]) => (...lists: string[][]) => lists.map((names, i) => ({ level: levels[i], names }))
/** Spell levels 1–5 at class levels 1, 3, 5, 7, 9 (2014 domains, patrons, Aberrant Mind). */
export const fullSpells = at([1, 3, 5, 7, 9])
/** Spell levels 1–5 at class levels 3, 5, 9, 13, 17 (oaths, ranger subclasses). */
export const halfSpells = at([3, 5, 9, 13, 17])
/** 2024 full casters: spell levels 1–2 at 3, then 3, 4, 5 at 5, 7, 9. */
export const spells2024 = (first: string[], ...rest: string[][]) => at([3, 5, 7, 9])(first, ...rest)

/** A 2014 subclass played with 2024 rules: what came before the subclass level comes when the subclass is chosen. */
export const legacy = (d: Def, from = 3): Def => ({
  ...d,
  features: d.features.map(x => ({ ...x, level: Math.max(from, x.level) })),
  ...(d.spells ? { spells: d.spells.map(s => ({ ...s, level: Math.max(from, s.level) })) } : {}),
})

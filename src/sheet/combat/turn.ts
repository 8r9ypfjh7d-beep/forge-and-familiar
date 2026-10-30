// What a character can do on a turn, for the combat page's Actions / Bonus Actions / Reactions / Free / Other lists:
// their spells by casting time, features and resources by how they are used, and the pact weapon. Pure.
import type { Spell } from '../../content'
import type { ActionKind, Character } from '../../model/character'
import { castingKind, featureAction, featureActionKind, castsAtMax, itemSpellCast, pickedClassOptions, rulesEdition, type DerivedStats, type ResourceInfo } from '../../rules'
import type { Ability } from '../../rules/types'
import { grantedSpells } from '../../spellbook/extra'
import { isPrepared } from '../../spellbook/spellbook'
import { ACTION_KINDS } from './combat'

/** One row in a list: a spell to cast, a resource to use, a feature (its Use, or just its reminder), or the pact weapon. */
export type TurnRow =
  | { type: 'spell'; key: string; spell: Spell; free?: { source: string; level?: number; spend?: { id: string; n: number }; max?: boolean } }
  | { type: 'resource'; key: string; resource: ResourceInfo }
  | {
    type: 'feature'; key: string; name: string; className: string; subclassId?: string; text?: string; spend?: { id: string; n: number }; use?: string
    /** The save it forces, with the DC (Stunning Strike). */
    save?: { dc: number; ability: Ability }
    /** Free, or more for points from a pool (2024 Patient Defense: Disengage free, Disengage and Dodge for 1 Focus). */
    boost?: { id: string; n: number }
    /** Unarmed strikes it makes (Flurry of Blows), rolled on Use. */
    strikes?: number
  }
  | { type: 'pact'; key: string }

/** Pools spent a few points at a time by other features (Flurry of Blows) or on their own card (Metamagic). */
const POOLS = ['ki', 'focus', 'sorcery-points']

export interface TurnInput {
  /** The content library's spells for the character's edition. */
  spells: Spell[]
  /** Spells their classes always have prepared (domain, oath and patron lists). */
  alwaysPrepared?: string[]
  /** Lower-cased names of the spells already in the attacks table; action spells there are not listed again. */
  inTable?: Set<string>
}

export function turnActions(c: Character, d: DerivedStats, { spells, alwaysPrepared = [], inTable = new Set() }: TurnInput): Record<ActionKind, TurnRow[]> {
  const edition = rulesEdition(c)
  const out = Object.fromEntries(ACTION_KINDS.map(k => [k, [] as TurnRow[]])) as Record<ActionKind, TurnRow[]>
  const byId = new Map(spells.map(s => [s.id, s]))
  const byName = new Map(spells.map(s => [s.name.toLowerCase(), s]))
  // The player's own actions (and their uses, `act:`) show on their own rows; one of the same name hides the filled-in row.
  const custom = new Set((c.customActions ?? []).map(a => a.name.trim().toLowerCase()))
  const resources = d.resources.filter(r => !POOLS.includes(r.id) && !/^(spell|item|act):/.test(r.id) && !custom.has(r.label.toLowerCase()))
  // Resource labels by their base name too, so the "Lay on Hands" feature doesn't repeat the "Lay on Hands (HP pool)" row.
  const base = (name: string) => name.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase()
  const labels = new Set([...d.resources.filter(r => !r.id.startsWith('act:')).flatMap(r => [r.label.toLowerCase(), base(r.label)]), ...custom])

  // Features and resources first: they are what a class does each turn.
  for (const r of resources) {
    out[featureActionKind(r.label, edition) ?? 'other'].push({ type: 'resource', key: `res:${r.id}`, resource: r })
  }
  const seen = new Set<string>()
  const monk = c.classes.find(x => x.classId === 'monk')
  // The monk's pool features are rules under Ki / Monk's Focus, not features of their own: each gets its row.
  const pooled = monk && d.resources.some(r => r.id === 'ki' || r.id === 'focus')
    ? ['Flurry of Blows', 'Patient Defense', 'Step of the Wind'].map((name): { name: string; className: string; subclassId?: string; text?: string } => ({ name, className: 'Monk' })) : []
  for (const f of [...d.features, ...pooled]) {
    const a = featureAction(f.name)
    const kind = featureActionKind(f.name, edition)
    if (!a || !kind || seen.has(f.name) || labels.has(f.name.toLowerCase())) continue
    seen.add(f.name)
    // 2024: Patient Defense and Step of the Wind cost nothing; a Focus Point makes them better.
    const free = edition === '2024' && (f.name === 'Patient Defense' || f.name === 'Step of the Wind')
    const pool = a.spend && d.resources.find(r => a.spend!.pools.includes(r.id))
    const save = a.save && { dc: 8 + d.proficiencyBonus + d.mods[a.save.dc], ability: a.save.ability }
    const strikes = f.name === 'Flurry of Blows' ? (edition === '2024' && (monk?.level ?? 0) >= 10 ? 3 : 2) : 0
    out[kind].push({
      type: 'feature', key: `feat:${f.name}`, name: f.name, className: f.className,
      ...(f.subclassId ? { subclassId: f.subclassId } : {}), ...(f.text ? { text: f.text } : {}),
      ...(pool ? (free ? { boost: { id: pool.id, n: a.spend!.n } } : { spend: { id: pool.id, n: a.spend!.n } }) : {}),
      ...(a.use ? { use: a.use } : {}), ...(save ? { save } : {}), ...(strikes ? { strikes } : {}),
    })
  }
  if (pickedClassOptions(c).some(p => p.option.id.startsWith('pact-of-the-blade'))) out[edition === '2024' ? 'bonus' : 'action'].push({ type: 'pact', key: 'pact' })

  // Spells from items, race and feats, with their own uses or charges.
  const spellRows: TurnRow[] = []
  const free = new Set<string>()
  for (const s of d.itemSpells) {
    const { name, level } = itemSpellCast(s.spell)
    const spell = byName.get(name.toLowerCase())
    if (!spell) continue
    const spend = s.useId ? { id: s.useId, n: 1 } : s.charges ? { id: s.charges.id, n: s.charges.cost } : undefined
    free.add(spell.id)
    spellRows.push({ type: 'spell', key: `free:${spell.id}:${s.source}`, spell, free: { source: s.source, ...(level ? { level } : {}), ...(spend ? { spend } : {}), ...(castsAtMax(s.note) ? { max: true } : {}) } })
  }
  // Class spells (known, prepared, always prepared) and race spells without a limit.
  const own = [...(c.spells ?? []).filter(isPrepared).map(k => k.id), ...alwaysPrepared, ...grantedSpells(c, spells).filter(g => g.unlocked).map(g => g.spell.id)]
  for (const id of new Set(own)) {
    const spell = byId.get(id)
    if (!spell || (free.has(id) && !(c.spells ?? []).some(k => k.id === id))) continue
    spellRows.push({ type: 'spell', key: `spell:${id}`, spell })
  }
  const level = (r: TurnRow) => (r.type === 'spell' ? r.spell.level : 0)
  spellRows.sort((a, b) => level(a) - level(b) || (a.type === 'spell' && b.type === 'spell' ? a.spell.name.localeCompare(b.spell.name) : 0))
  for (const r of spellRows) {
    if (r.type !== 'spell') continue
    const kind = castingKind(r.spell.castingTime)
    // Action spells that attack or force a save are cast from the attacks table.
    if (kind === 'action' && !r.free && inTable.has(r.spell.name.toLowerCase())) continue
    if (custom.has(r.spell.name.toLowerCase())) continue
    out[kind].push(r)
  }
  return out
}

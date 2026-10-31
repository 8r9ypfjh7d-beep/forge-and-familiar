// Metamagic: how many options a sorcerer knows, which ones are picked and what each use costs.
// Picks are Character.classOptions entries of kind 'metamagic'; options come from the class option registry.
import type { Character } from '../model/character'
import { getFeats, type FeatInput } from './choices'
import { classOptionById, classOptions, registerClassOptions, type ClassOption } from './classOptions'
import { METAMAGIC, METAMAGIC_2024, METAMAGIC_COUNT } from './data/metamagic'
import { rulesEdition } from './edition'

registerClassOptions('metamagic', [...METAMAGIC, ...METAMAGIC_2024])

/** Metamagic options offered to this character's edition (official first, then homebrew). */
export const metamagicOptions = (c: Partial<Pick<Character, 'rulesEdition'>>) => classOptions('metamagic', rulesEdition(c))

/** Feats that teach two Metamagic options (Tasha's Metamagic Adept), any class. */
export const METAMAGIC_FEATS = ['metamagic-adept']

/** How many options the character knows: by sorcerer level (0 before Metamagic), +2 per Metamagic Adept. */
export function metamagicCount(c: FeatInput): number {
  const level = c.classes.find(cl => cl.classId === 'sorcerer')?.level ?? 0
  const fromClass = METAMAGIC_COUNT[rulesEdition(c)].reduce((n, [at, count]) => (level >= at ? count : n), 0)
  return fromClass + 2 * getFeats(c).filter(f => METAMAGIC_FEATS.includes(f.id)).length
}

/** Resources that hold sorcery points, the class pool first: sorcerer's, then Metamagic Adept's (feat:metamagic-adept). */
export const SORCERY_POOLS = ['sorcery-points', ...METAMAGIC_FEATS.map(id => `feat:${id}`)]

/** Font of Magic (both editions): sorcery points to create a spell slot of level 1-5. Turning a slot back gives its level in points. */
export const FONT_SLOT_COST = [2, 3, 5, 6, 7]

/** Font of Magic comes at sorcerer level 2. */
export const hasFontOfMagic = (c: Pick<Character, 'classes'>) => (c.classes.find(cl => cl.classId === 'sorcerer')?.level ?? 0) >= 2

/** Picked option ids, in pick order. */
export const metamagicIds = (c: Partial<Pick<Character, 'classOptions'>>) =>
  (c.classOptions ?? []).filter(p => p.kind === 'metamagic').map(p => p.id)

/** The picked options this character can use; unknown ids (a homebrew pack not on this device) are skipped. */
export function getMetamagic(c: Partial<Pick<Character, 'rulesEdition' | 'classOptions'>>): ClassOption[] {
  const edition = rulesEdition(c)
  return metamagicIds(c).flatMap(id => {
    const o = classOptionById(id, edition)
    return o?.kind === 'metamagic' ? [o] : []
  })
}

/** Turn one option on or off. Other kinds of picks are kept. Never limited: the builder warns when there are too many. */
export function toggleMetamagic(c: Partial<Pick<Character, 'classOptions'>>, id: string): NonNullable<Character['classOptions']> {
  const picks = c.classOptions ?? []
  return picks.some(p => p.kind === 'metamagic' && p.id === id)
    ? picks.filter(p => !(p.kind === 'metamagic' && p.id === id))
    : [...picks, { kind: 'metamagic', id, classId: 'sorcerer' }]
}

/** Sorcery points one use costs. Per-spell-level options (2014 Twinned) cost the spell's level, a cantrip the base cost. */
export function metamagicCost(o: ClassOption, spellLevel = 0): number {
  const base = o.cost ?? 0
  return o.costPerSpellLevel ? Math.max(base, spellLevel) : base
}

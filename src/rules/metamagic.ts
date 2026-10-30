// Metamagic: how many options a sorcerer knows, which ones are picked and what each use costs.
// Picks are Character.classOptions entries of kind 'metamagic'; options come from the class option registry.
import type { Character } from '../model/character'
import { classOptionById, classOptions, registerClassOptions, type ClassOption } from './classOptions'
import { METAMAGIC, METAMAGIC_2024, METAMAGIC_COUNT } from './data/metamagic'
import { rulesEdition } from './edition'

registerClassOptions('metamagic', [...METAMAGIC, ...METAMAGIC_2024])

type Input = Pick<Character, 'classes'> & Partial<Pick<Character, 'rulesEdition' | 'classOptions'>>

/** Metamagic options offered to this character's edition (official first, then homebrew). */
export const metamagicOptions = (c: Partial<Pick<Character, 'rulesEdition'>>) => classOptions('metamagic', rulesEdition(c))

/** How many options the character's sorcerer levels let them know (0 before Metamagic). */
export function metamagicCount(c: Input): number {
  const level = c.classes.find(cl => cl.classId === 'sorcerer')?.level ?? 0
  return METAMAGIC_COUNT[rulesEdition(c)].reduce((n, [at, count]) => (level >= at ? count : n), 0)
}

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

// Feat prerequisites the builder checks. Tables bend these often, so unmet ones are warnings, never blocks.
import { getAbilityScores } from './abilities'
import { classById } from './data/classes'
import { rulesEdition } from './edition'
import type { CharacterDraft } from './factory'
import { getFeats } from './choices'
import { getProficiencies } from './multiclass'
import { activeSubclasses } from './subclass'
import type { Ability, ArmorCategory, Feat } from './types'

export type FeatPrereq =
  | { kind: 'level'; level: number }
  | { kind: 'ability'; abilities: Partial<Record<Ability, number>> }
  | { kind: 'race'; races: string[] }
  | { kind: 'spellcasting' }
  | { kind: 'armor'; armor: ArmorCategory }
  | { kind: 'feat'; feats: string[] }
  | { kind: 'feature'; feature: string }

/** Every structured prerequisite of a feat, met or not, in display order. */
export function featPrereqs(f: Feat): FeatPrereq[] {
  const r = f.requires ?? {}
  return [
    ...(f.minLevel ? [{ kind: 'level' as const, level: f.minLevel }] : []),
    ...(r.abilities && Object.keys(r.abilities).length ? [{ kind: 'ability' as const, abilities: r.abilities }] : []),
    ...(r.races?.length ? [{ kind: 'race' as const, races: r.races }] : []),
    ...(r.spellcasting ? [{ kind: 'spellcasting' as const }] : []),
    ...(r.armor ? [{ kind: 'armor' as const, armor: r.armor }] : []),
    ...(r.feats?.length ? [{ kind: 'feat' as const, feats: r.feats }] : []),
    ...(r.feature ? [{ kind: 'feature' as const, feature: r.feature }] : []),
  ]
}

type Draft = Omit<CharacterDraft, 'name' | 'ownerId' | 'playerName' | 'alignment' | 'abilityMethod'> & Partial<CharacterDraft>

/** Can the character cast a spell: a casting class or a casting subclass (Eldritch Knight, Arcane Trickster). */
function canCast(c: Draft): boolean {
  const ed = rulesEdition(c)
  if (c.classes.some(cl => (classById(cl.classId, ed)?.caster ?? 'none') !== 'none')) return true
  return activeSubclasses(c).some(({ level, subclass }) => subclass.features.some(f => f.level <= level && /spellcasting/i.test(f.name)) || !!subclass.spells?.length)
}

/** The prerequisites the character doesn't meet for a feat taken at `level` (character level for the slot). */
export function unmetFeatPrereqs(c: Draft, f: Feat, level: number): FeatPrereq[] {
  const ed = rulesEdition(c)
  return featPrereqs(f).filter(p => {
    switch (p.kind) {
      case 'level': return level < p.level
      case 'ability': {
        const scores = getAbilityScores({ ...c, freeAbilityBonuses: c.freeAbilityBonuses ?? [] })
        return !Object.entries(p.abilities).some(([a, min]) => scores[a as Ability] >= (min ?? 0))
      }
      case 'race': return !p.races.some(r => r === c.raceId || r === c.subraceId)
      case 'spellcasting': return !canCast(c)
      case 'armor': return !getProficiencies(c).armor.has(p.armor)
      case 'feat': {
        const have = getFeats(c).map(x => x.id)
        return !p.feats.some(id => have.includes(id))
      }
      case 'feature': return !c.classes.some(cl => classById(cl.classId, ed)?.features.some(x => x.name === p.feature && x.level <= cl.level))
    }
  })
}

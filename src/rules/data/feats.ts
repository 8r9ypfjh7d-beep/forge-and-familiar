import type { Feat, RulesEdition } from '../types'
import { FEATS_2024 } from './srd52/feats'

// SRD 5.1 includes one feat. Groups add more as homebrew.
export const FEATS: Feat[] = [
  {
    id: 'grappler', name: 'Grappler', prerequisite: 'Strength 13 or higher',
    description: 'Advantage on attack rolls against a creature you are grappling, and you can try to pin a creature grappled by you.',
    effects: [],
  },
]

// Homebrew feats registered at runtime (ids namespaced `hb:<packId>:<slug>`).
let homebrew: Feat[] = []

/** Replace the registered homebrew feats. SRD ids always win. */
export function registerHomebrewFeats(list: Feat[]): void {
  const srd = new Set([...FEATS, ...FEATS_2024].map(f => f.id))
  homebrew = list.filter(f => !srd.has(f.id))
}

const srdFor = (edition: RulesEdition) => (edition === '2024' ? FEATS_2024 : FEATS)

/** SRD feats of the edition, then homebrew (offered in both). */
export const allFeats = (edition: RulesEdition = '2014'): Feat[] => [...srdFor(edition), ...homebrew]

export const featById = (id: string, edition: RulesEdition = '2014'): Feat | undefined =>
  srdFor(edition).find(f => f.id === id) ?? homebrew.find(f => f.id === id)

import type { Feat, RulesEdition } from '../types'
import { BOOK_FEATS, BOOK_FEATS_2024 } from './books/feats'
import { FEATS_2024 } from './srd52/feats'

// SRD 5.1 includes one feat; the official books' feats are in books/feats.ts. Groups add more as homebrew.
export const FEATS: Feat[] = [
  {
    id: 'grappler', name: 'Grappler', category: 'general', prerequisite: 'Strength 13 or higher', requires: { abilities: { str: 13 } },
    description: 'Advantage on attack rolls against a creature you are grappling, and you can try to pin a creature grappled by you.',
    effects: [],
  },
]

// Homebrew feats registered at runtime (ids namespaced `hb:<packId>:<slug>`).
let homebrew: Feat[] = []

/** Replace the registered homebrew feats. SRD ids always win. */
export function registerHomebrewFeats(list: Feat[]): void {
  const srd = new Set([...official['2014'], ...official['2024']].map(f => f.id))
  homebrew = list.filter(f => !srd.has(f.id))
}

const official: Record<RulesEdition, Feat[]> = { '2014': [...FEATS, ...BOOK_FEATS], '2024': [...FEATS_2024, ...BOOK_FEATS_2024] }
const srdFor = (edition: RulesEdition) => official[edition]

/** Player-made feat (Improvement.customFeat, Character.customOriginFeat). */
export const CUSTOM_FEAT = 'custom'

/** SRD and book feats of the edition, then homebrew (offered in both). */
export const allFeats = (edition: RulesEdition = '2014'): Feat[] => [...srdFor(edition), ...homebrew]

export const featById = (id: string, edition: RulesEdition = '2014'): Feat | undefined =>
  srdFor(edition).find(f => f.id === id) ?? homebrew.find(f => f.id === id)

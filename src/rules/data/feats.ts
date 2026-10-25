import type { Feat } from '../types'

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
  const srd = new Set(FEATS.map(f => f.id))
  homebrew = list.filter(f => !srd.has(f.id))
}

export const allFeats = (): Feat[] => [...FEATS, ...homebrew]

export const featById = (id: string): Feat | undefined => FEATS.find(f => f.id === id) ?? homebrew.find(f => f.id === id)

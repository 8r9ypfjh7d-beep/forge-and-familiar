// The character's edition of the content library, loaded once for the combat page, its features view and the printable sheet.
import { useEffect, useState } from 'react'
import { loadKind, type CharacterClass, type Equipment, type Feat, type Feature, type Spell, type Subclass, type Trait } from '../../content'
import type { Character } from '../../model/character'
import { editionOf, sourceFor, spellSourcesFor } from '../../spellbook/access'

export interface Library {
  spells: Spell[]
  features: Feature[]
  traits: Trait[]
  feats: Feat[]
  equipment: Equipment[]
  classes: CharacterClass[]
  subclasses: Subclass[]
}

export const EMPTY: Library = { spells: [], features: [], traits: [], feats: [], equipment: [], classes: [], subclasses: [] }

/** The character's edition of the content library. Empty while loading or if it fails: the page still works. */
export function useLibrary(character: Character): Library {
  const edition = editionOf(character)
  const source = sourceFor(edition)
  const [lib, setLib] = useState<{ source: string; data: Library } | null>(null)
  useEffect(() => {
    let live = true
    const sources = [source]
    Promise.all([
      loadKind('spells', { sources: spellSourcesFor(edition) }), loadKind('features', { sources }), loadKind('traits', { sources }),
      loadKind('feats', { sources }), loadKind('equipment', { sources }),
      loadKind('classes', { sources: spellSourcesFor(edition) }), loadKind('subclasses', { sources: spellSourcesFor(edition) }),
    ])
      .then(([spells, features, traits, feats, equipment, classes, subclasses]) => { if (live) setLib({ source, data: { spells, features, traits, feats, equipment, classes, subclasses } }) })
      .catch(() => { if (live) setLib({ source, data: EMPTY }) })
    return () => { live = false }
  }, [source])
  return lib?.source === source ? lib.data : EMPTY
}

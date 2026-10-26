// The pin form's spell chooser: every library spell for the character's rules edition,
// their own class and subclass lists first, with a name search.
import { useEffect, useState } from 'react'
import { BUNDLED, loadKind, type CharacterClass, type Spell, type Subclass } from '../content'
import type { Character } from '../model/character'
import { derive } from '../rules'
import { editionOf, sourceFor, spellAccess } from '../spellbook/access'
import { toQuickCast } from '../spellbook/spellbook'
import { byLevel, pickableSpells } from './picker'
import { ORDINAL } from './quickcast'
import type { SpellEntry } from './types'

interface Library { spells: Spell[]; classes: CharacterClass[]; subclasses: Subclass[] }

export function SpellPicker({ character, onPick }: { character: Character; onPick: (s: Omit<SpellEntry, 'id' | 'kind'>) => void }) {
  const source = sourceFor(editionOf(character))
  const [lib, setLib] = useState<Library | 'error' | null>(null)
  const [everyClass, setEveryClass] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    const sources = [source]
    Promise.all([loadKind('spells', { sources }), loadKind('classes', { sources }), loadKind('subclasses', { sources })])
      .then(([spells, classes, subclasses]) => { if (live) setLib({ spells, classes, subclasses }) })
      .catch(() => live && setLib('error'))
    return () => { live = false }
  }, [source])

  if (lib === 'error') return <p className="hint">The spell list could not load. Type the spell in below.</p>
  if (!lib) return <p className="hint">Loading spells…</p>

  const access = spellAccess(character, lib.classes, lib.subclasses, derive(character).abilities)
  const shown = pickableSpells(lib.spells, access, everyClass, query)
  const scope = everyClass || access.length === 0 ? 'every class' : 'spells you can cast'
  const attribution = BUNDLED.find(m => m.source.id === source)?.source.attribution

  return (
    <div className="qc-picker">
      <label>Find a spell ({shown.length} {scope})
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name" />
      </label>
      <label>Start from a spell
        <select value="" onChange={e => { const s = shown.find(x => x.id === e.target.value); if (s) onPick(toQuickCast(s)) }}>
          <option value="">{shown.length ? 'Choose…' : 'No spells match'}</option>
          {byLevel(shown).map(([level, spells]) => (
            <optgroup key={level} label={level === 0 ? 'Cantrips' : `${ORDINAL[level]} level`}>
              {spells.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.concentration ? ' (C)' : ''}{s.ritual ? ' (R)' : ''} · {s.castingTime}, {s.range}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {access.length > 0 && (
        <label className="check"><input type="checkbox" checked={everyClass} onChange={e => setEveryClass(e.target.checked)} />
          Show spells from every class</label>
      )}
      {attribution && <p className="qc-attrib">{attribution}</p>}
    </div>
  )
}

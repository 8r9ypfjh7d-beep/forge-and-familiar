import { useState } from 'react'
import type { Character } from '../../model/character'
import { attunementKey, entryItem } from '../../rules'
import { ATTUNEMENT_LIMIT, attune, endAttunement, setInspiration } from '../engine'
import type { Apply } from '../types'

export function Attunement({ character, apply }: { character: Character; apply: Apply }) {
  const { inspiration = false } = character.state
  // Items attuned from the inventory are stored by uid; show their current name.
  const attuned = (character.state.attuned ?? []).map(k => {
    const e = character.inventory.find(x => attunementKey(x.uid) === k)
    return e ? entryItem(e)?.name ?? e.itemId : k
  })
  const [item, setItem] = useState('')
  const full = attuned.length >= ATTUNEMENT_LIMIT

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = item.trim()
    if (!name || full) return
    apply(`Attuned to ${name}`, c => attune(c, name))
    setItem('')
  }

  return (
    <section className="card" aria-labelledby="att-title">
      <h2 id="att-title">Inspiration and attunement</h2>
      <button type="button" className={`inspiration${inspiration ? ' on' : ''}`} aria-pressed={inspiration}
        onClick={() => apply(inspiration ? 'Spent inspiration' : 'Gained inspiration', c => setInspiration(c, !inspiration))}>
        <span className="star" aria-hidden="true">{inspiration ? '★' : '☆'}</span>
        {inspiration ? 'Inspired: spend for advantage' : 'No inspiration'}
      </button>
      <ol className="attune-slots" aria-label={`Attuned items, ${attuned.length} of ${ATTUNEMENT_LIMIT}`}>
        {Array.from({ length: ATTUNEMENT_LIMIT }, (_, i) => (
          <li key={i} className={attuned[i] ? 'filled' : ''}>
            {attuned[i]
              ? <>
                  <span>{attuned[i]}</span>
                  <button type="button" className="btn ghost small" aria-label={`End attunement to ${attuned[i]}`}
                    onClick={() => apply(`Ended attunement to ${attuned[i]}`, c => endAttunement(c, i))}>End</button>
                </>
              : <span className="hint">Empty slot</span>}
          </li>
        ))}
      </ol>
      {full
        ? <p className="hint">All {ATTUNEMENT_LIMIT} slots used. End one to attune to another item.</p>
        : (
          <form className="attune-add" onSubmit={submit}>
            <input value={item} onChange={e => setItem(e.target.value)} placeholder="Magic item name" aria-label="Magic item to attune" />
            <button type="submit" className="btn" disabled={!item.trim()}>Attune</button>
          </form>
        )}
    </section>
  )
}

import type { Character } from '../model/character'
import { setPactUsed, setSlotUsed } from '../sheet/engine'
import type { Apply } from '../sheet/types'
import { takeReaction, useTurn } from '../turn'
import { getReactions, lowestFreeSlot, reactionBlocker, type Reaction } from './reactions'
import './reactions.css'

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** Spends the lowest free slot for a reaction spell. Returns the character unchanged if none is left. */
function spendSlot(c: Character, level: number): Character {
  const slot = lowestFreeSlot(c, level)
  if (!slot) return c
  return slot.pact
    ? setPactUsed(c, c.state.pactSlotsUsed + 1)
    : setSlotUsed(c, slot.level, (c.state.spellSlotsUsed[slot.level - 1] ?? 0) + 1)
}

/**
 * Reminds the player which reactions they have and when each triggers.
 * "Reaction used" is shared with the turn checklist (src/turn): not saved, kept for this tab, reset by New round or Next turn.
 */
export function ReactionReminders({ character, apply }: { character: Character; apply: Apply }) {
  const { turn, update } = useTurn(character.id)
  const used = turn.used.reaction ? (turn.reactionName ?? 'Reaction') : null
  const setUsed = (name: string | null) => update(t => takeReaction(t, name))

  const blocker = reactionBlocker(character)
  const reactions = getReactions(character)

  const use = (r: Reaction) => {
    if (r.cost.kind === 'slot') {
      const { level } = r.cost
      const slot = lowestFreeSlot(character, level)
      if (!slot) return
      apply(`Cast ${r.name} (${slot.pact ? 'pact' : ORDINAL[slot.level - 1] + '-level'} slot)`, c => spendSlot(c, level))
    }
    setUsed(r.name)
  }

  const status = blocker ? `Can't react: ${blocker}` : used ? `Used: ${used}` : 'Reaction ready'
  return (
    <section className="card ff-reactions" aria-labelledby="react-title">
      <div className="card-head">
        <h2 id="react-title">Reactions</h2>
        <button type="button" className="btn ghost small" disabled={!used} onClick={() => setUsed(null)}>New round</button>
      </div>
      <p className={`react-status ${blocker ? 'blocked' : used ? 'spent' : 'ready'}`} role="status">
        <span className="dot" aria-hidden="true" />{status}
      </p>
      <ul className="react-list">
        {reactions.map(r => (
          <li key={r.id} className={r.ready ? '' : 'unavailable'}>
            <div className="react-top">
              <strong>{r.name}</strong>
              <small>{r.source}</small>
              <button type="button" className="btn small" disabled={!!blocker || !!used || !r.ready}
                aria-label={`Use ${r.name}`} onClick={() => use(r)}>
                {r.cost.kind === 'slot' ? 'Cast' : 'Use'}
              </button>
            </div>
            <p className="react-when"><span>When</span> {r.trigger}</p>
            <p className="react-effect">{r.effect}</p>
            {r.note && <p className="react-note">{r.note}</p>}
          </li>
        ))}
      </ul>
      <p className="hint">One reaction per round. It comes back at the start of your turn.</p>
    </section>
  )
}

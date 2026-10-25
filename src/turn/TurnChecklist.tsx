import type { Character } from '../model/character'
import { derive } from '../rules'
import { bonusOptions, dash, FRESH_TURN, limits, move, movementTotal, nextTurn, toggle, type Slot } from './turn'
import { useTurn } from './useTurn'
import './turn.css'

const SLOTS: { slot: Slot; label: string }[] = [
  { slot: 'action', label: 'Action' },
  { slot: 'bonus', label: 'Bonus action' },
  { slot: 'reaction', label: 'Reaction' },
]

/** Tick off what you have used this turn. Lives inside the sheet's .ff-sheet scope. */
export function TurnChecklist({ character }: { character: Character }) {
  const { turn, update } = useTurn(character.id)
  const speed = derive(character).speed
  const { noActions, noMovement } = limits(character)
  const bonus = bonusOptions(character)
  const total = noMovement ? 0 : movementTotal(turn, speed)
  const left = Math.max(0, total - turn.moved)

  return (
    <section className="card turn" aria-labelledby="turn-title">
      <div className="card-head">
        <h2 id="turn-title">Turn <span className="turn-round">· round {turn.round}</span></h2>
        <div className="turn-head-actions">
          <button type="button" className="btn ghost small" onClick={() => update(() => FRESH_TURN)}>End combat</button>
          <button type="button" className="btn primary small" onClick={() => update(nextTurn)}>Next turn</button>
        </div>
      </div>

      <div className="turn-slots">
        {SLOTS.map(({ slot, label }) => {
          const used = turn.used[slot]
          return (
            <button key={slot} type="button" className={used ? 'turn-slot used' : 'turn-slot'} aria-pressed={used}
              disabled={!!noActions} onClick={() => update(t => toggle(t, slot))}>
              <span className="turn-box" aria-hidden="true">{used ? '✓' : ''}</span>
              <span className="turn-label">{label}</span>
              <span className="turn-state">{noActions ? 'Unavailable' : used ? 'Used' : 'Ready'}</span>
            </button>
          )
        })}
      </div>

      <div className="turn-move">
        <div className="turn-move-head">
          <span className="turn-label">Movement</span>
          <span><strong>{left}</strong> / {total} ft left</span>
        </div>
        <div className="turn-bar" aria-hidden="true"><span style={{ width: total ? `${(left / total) * 100}%` : '0%' }} /></div>
        <div className="row">
          <button type="button" className="btn small" onClick={() => update(t => move(t, -5, speed))} disabled={turn.moved === 0} aria-label="Take back 5 feet">−5 ft</button>
          <button type="button" className="btn small" onClick={() => update(t => move(t, 5, speed))} disabled={left === 0} aria-label="Move 5 feet">+5 ft</button>
          <button type="button" className="btn small" onClick={() => update(t => move(t, 30, speed))} disabled={left === 0} aria-label="Move 30 feet">+30 ft</button>
          <button type="button" className="btn small" onClick={() => update(dash)} disabled={!!noMovement || speed === 0}>Dash (+{speed} ft)</button>
        </div>
        {noMovement && <p className="hint">Speed is 0 while {noMovement}.</p>}
        {!noMovement && speed === 0 && <p className="hint">Speed is 0 from exhaustion.</p>}
        {turn.dashes > 0 && <p className="hint">Dashed {turn.dashes}×. Tick the action or bonus action you spent on it.</p>}
      </div>

      {noActions && <p className="hint">No actions or reactions while {noActions}.</p>}
      {!noActions && bonus.length > 0 && (
        <dl className="turn-options"><div><dt>Bonus actions</dt><dd>{bonus.join(' · ')}</dd></div></dl>
      )}
    </section>
  )
}

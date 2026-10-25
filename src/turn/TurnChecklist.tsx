import { useI18n, type MessageKey } from '../i18n'
import type { Character } from '../model/character'
import { derive } from '../rules'
import { bonusOptions, dash, FRESH_TURN, limits, move, movementTotal, nextTurn, toggle, type Slot } from './turn'
import { useTurn } from './useTurn'
import './turn.css'

/** A signed number isolated left-to-right, so the sign stays in front in Hebrew too. */
const signed = (n: number) => `\u2066${n < 0 ? '−' : '+'}${Math.abs(n)}\u2069`

const SLOTS: { slot: Slot; label: MessageKey }[] = [
  { slot: 'action', label: 'turn.action' },
  { slot: 'bonus', label: 'turn.bonus' },
  { slot: 'reaction', label: 'turn.reaction' },
]

/** Tick off what you have used this turn. Lives inside the sheet's .ff-sheet scope. */
export function TurnChecklist({ character }: { character: Character }) {
  const { t, term } = useI18n()
  const { turn, update } = useTurn(character.id)
  const speed = derive(character).speed
  const { noActions, noMovement } = limits(character)
  const bonus = bonusOptions(character)
  const total = noMovement ? 0 : movementTotal(turn, speed)
  const left = Math.max(0, total - turn.moved)
  const condition = (id: string) => term('condition', id, id)

  return (
    <section className="card turn" aria-labelledby="turn-title">
      <div className="card-head">
        <h2 id="turn-title">{t('turn.title')} <span className="turn-round">{t('turn.round', { n: turn.round })}</span></h2>
        <div className="turn-head-actions">
          <button type="button" className="btn ghost small" onClick={() => update(() => FRESH_TURN)}>{t('turn.endCombat')}</button>
          <button type="button" className="btn primary small" onClick={() => update(nextTurn)}>{t('turn.next')}</button>
        </div>
      </div>

      <div className="turn-slots">
        {SLOTS.map(({ slot, label }) => {
          const used = turn.used[slot]
          return (
            <button key={slot} type="button" className={used ? 'turn-slot used' : 'turn-slot'} aria-pressed={used}
              disabled={!!noActions} onClick={() => update(s => toggle(s, slot))}>
              <span className="turn-box" aria-hidden="true">{used ? '✓' : ''}</span>
              <span className="turn-label">{t(label)}</span>
              <span className="turn-state">{t(noActions ? 'turn.unavailable' : used ? 'turn.used' : 'turn.ready')}</span>
            </button>
          )
        })}
      </div>

      <div className="turn-move">
        <div className="turn-move-head">
          <span className="turn-label">{t('turn.movement')}</span>
          <span>{t('turn.left', { left, total })}</span>
        </div>
        <div className="turn-bar" aria-hidden="true"><span style={{ width: total ? `${(left / total) * 100}%` : '0%' }} /></div>
        <div className="row">
          <button type="button" className="btn small" onClick={() => update(s => move(s, -5, speed))} disabled={turn.moved === 0} aria-label={t('turn.backAria', { n: 5 })}>{t('turn.ft', { n: signed(-5) })}</button>
          <button type="button" className="btn small" onClick={() => update(s => move(s, 5, speed))} disabled={left === 0} aria-label={t('turn.moveAria', { n: 5 })}>{t('turn.ft', { n: signed(5) })}</button>
          <button type="button" className="btn small" onClick={() => update(s => move(s, 30, speed))} disabled={left === 0} aria-label={t('turn.moveAria', { n: 30 })}>{t('turn.ft', { n: signed(30) })}</button>
          <button type="button" className="btn small" onClick={() => update(dash)} disabled={!!noMovement || speed === 0}>{t('turn.dash', { n: speed })}</button>
        </div>
        {noMovement && <p className="hint">{t('turn.speedZeroCondition', { condition: condition(noMovement) })}</p>}
        {!noMovement && speed === 0 && <p className="hint">{t('turn.speedZeroExhaustion')}</p>}
        {turn.dashes > 0 && <p className="hint">{t('turn.dashed', { n: turn.dashes })}</p>}
      </div>

      {noActions && <p className="hint">{t('turn.noActions', { condition: condition(noActions) })}</p>}
      {!noActions && bonus.length > 0 && (
        <dl className="turn-options">
          <div><dt>{t('turn.bonusOptions')}</dt><dd>{bonus.map(name => term('feature', name, name)).join(' · ')}</dd></div>
        </dl>
      )}
    </section>
  )
}

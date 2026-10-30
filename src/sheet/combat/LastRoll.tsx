// One labeled line per roll ("To hit", "Damage (fire)"), shared by the combat page and the spell cards.
import type { RollResult } from '../../dice'
import { FadingResult } from '../../dice/ui'
import { useI18n } from '../../i18n'

/** A roll and what it is for, e.g. "To hit" or "Damage (force)". */
export interface Shown { roll: RollResult; what: string }

/**
 * The last roll a panel made, one labeled line per roll so "to hit" and "damage" can't be mixed up.
 * The dice history keeps them all. With `onDone` it fades away on its own (see FadingResult).
 */
export function LastRoll({ rolls, note, onDone }: { rolls: Shown[]; note?: string; onDone?: () => void }) {
  const { t } = useI18n()
  if (!rolls.length && !note) return null
  const body = (
    <>
      {rolls.map(({ roll: r, what }) => {
        const crit = r.d20?.crit
        const fumble = r.d20?.fumble
        const mode = r.d20 && r.d20.mode !== 'normal' ? t(r.d20.mode === 'advantage' ? 'dice.advShort' : 'dice.disShort') : ''
        return (
          <div key={r.id} className={`cs-rollline type-${r.type}${crit ? ' crit' : ''}${fumble ? ' fumble' : ''}`}>
            <span className="what">{what}{mode && <small> ({mode})</small>}</span>
            <span className="total">{r.total}</span>
            <span className="how" dir="ltr">{r.breakdown}</span>
            {r.type === 'attack' && (
              <span className="meaning">
                {fumble ? t('cs.roll.fumble') : crit ? t('cs.roll.crit') : t('cs.roll.hitsAc', { n: r.total })}
              </span>
            )}
          </div>
        )
      })}
      {note && <p className="hint">{note}</p>}
    </>
  )
  return onDone
    ? <FadingResult className="cs-last" onDone={onDone}>{body}</FadingResult>
    : <div className="cs-last" aria-live="polite">{body}</div>
}

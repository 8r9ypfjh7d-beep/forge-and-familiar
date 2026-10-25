// One roll: label, dice (dropped dice struck through), total, crit/fumble badge.
import { useI18n } from '../../i18n'
import type { RollResult } from '../types'

export function RollView({ roll, compact = false }: { roll: RollResult; compact?: boolean }) {
  const crit = roll.d20?.crit && roll.type !== 'deathSave'
  const fumble = roll.d20?.fumble
  const { t } = useI18n()
  return (
    <div className={`ff-roll${crit ? ' ff-roll--crit' : ''}${fumble ? ' ff-roll--fumble' : ''}${compact ? ' ff-roll--compact' : ''}`}>
      <div className="ff-roll__head">
        <span className="ff-roll__label">
          {roll.roller && <span className="ff-roll__who">{roll.roller.characterName} · </span>}
          {roll.label ?? roll.notation}
          {roll.d20 && roll.d20.mode !== 'normal' && (
            <span className="ff-roll__mode">{t(roll.d20.mode === 'advantage' ? 'dice.advShort' : 'dice.disShort')}</span>
          )}
        </span>
        <span className="ff-roll__total" aria-label={t('dice.total', { total: roll.total })}>{roll.total}</span>
      </div>
      <div className="ff-roll__detail">
        {roll.terms.map((t, i) => (
          <span key={i}>
            {(i > 0 || t.sign < 0) && <span className="ff-roll__op">{t.sign < 0 ? ' − ' : ' + '}</span>}
            {t.kind === 'const' ? (
              t.value
            ) : (
              <span title={t.notation}>
                [
                {t.rolls.map((r, j) => (
                  <span key={j}>
                    {j > 0 && ', '}
                    <span className={`ff-die${r.kept ? '' : ' ff-die--dropped'}${r.value === r.sides ? ' ff-die--max' : ''}${r.value === 1 ? ' ff-die--min' : ''}`}>
                      {r.value}
                    </span>
                  </span>
                ))}
                ]
              </span>
            )}
          </span>
        ))}
        {crit && <span className="ff-roll__badge">{t('dice.crit')}</span>}
        {fumble && <span className="ff-roll__badge">{t('dice.nat1')}</span>}
        {roll.autoFail && <span className="ff-roll__badge">{t('dice.autoFail')}</span>}
        {!compact && <span className="ff-roll__notation">{roll.notation}</span>}
      </div>
    </div>
  )
}

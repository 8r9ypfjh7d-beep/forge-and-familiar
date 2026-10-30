// One labeled line per roll ("To hit", "Damage (fire)"), shared by the combat page and the spell cards.
import { bySource, hasSources, type RollResult } from '../../dice'
import { FadingResult } from '../../dice/ui'
import { useI18n } from '../../i18n'

/** A roll and what it is for, e.g. "To hit" or "Damage (force)". `half` marks damage a successful save halves (Fireball). */
export interface Shown { roll: RollResult; what: string; half?: boolean }

/** The breakdown marks dropped dice as ~~4~~ ("[17, ~~4~~] + 5"): show them struck through. */
const struck = (text: string) => text.split(/~~(.+?)~~/).map((part, i) => (i % 2 ? <s key={i}>{part}</s> : part))

/**
 * The last roll a panel made, one labeled line per roll so "to hit" and "damage" can't be mixed up.
 * The dice history keeps them all. With `onDone` it fades away on its own (see FadingResult).
 */
export function LastRoll({ rolls, note, onDone }: { rolls: Shown[]; note?: string; onDone?: () => void }) {
  const { t, term, attackName } = useI18n()
  if (!rolls.length && !note) return null
  const body = (
    <>
      {rolls.map(({ roll: r, what, half }) => {
        const crit = r.d20?.crit
        const fumble = r.d20?.fumble
        const mode = r.d20 && r.d20.mode !== 'normal' ? t(r.d20.mode === 'advantage' ? 'dice.advShort' : 'dice.disShort') : ''
        return (
          <div key={r.id} className={`cs-rollline type-${r.type}${crit ? ' crit' : ''}${fumble ? ' fumble' : ''}`}>
            <span className="what">{what}{mode && <small>{mode}</small>}</span>
            <span className="total">{r.total}</span>
            {hasSources(r)
              ? (
                // Weapon, Hex and a smite each on their own line with their own type, so resistances can be applied per part.
                <ul className="how parts">
                  {bySource(r.terms).map((g, i) => (
                    <li key={i}>
                      {g.source && <span className="part-name">{attackName(g.source)}</span>}
                      <bdi dir="ltr">{struck(g.breakdown)} = {g.total}</bdi>
                      {g.damageType && <span className="part-type">{term('damage', g.damageType, g.damageType)}</span>}
                    </li>
                  ))}
                </ul>
              )
              : <span className="how" dir="ltr">{struck(r.breakdown)}</span>}
            {half && <span className="meaning">{t('cs.roll.halfOnSave', { n: Math.floor(r.total / 2) })}</span>}
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

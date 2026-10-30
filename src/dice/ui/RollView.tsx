// One roll: label, dice (dropped dice struck through), total, crit/fumble badge. Or one action: to-hit and damage on one card.
import { useI18n } from '../../i18n'
import { actionName } from '../history'
import type { RollResult, TermResult } from '../types'

/** Dice notation reads left to right in Hebrew too, and may break after each + or − instead of mid-die. */
function Notation({ text }: { text: string }) {
  const parts = text.split(/(?<=[+\-−])/)
  return <bdi dir="ltr">{parts.map((p, i) => <span key={i}>{i > 0 && <wbr />}{p}</span>)}</bdi>
}

/** The dice and modifiers in order: [4, 1] + 4. */
function Terms({ terms }: { terms: TermResult[] }) {
  return (
    <>
      {terms.map((t, i) => (
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
    </>
  )
}

/** Two or more named parts (weapon, Hex, a smite): worth one line each. */
const hasSources = (r: RollResult) => new Set(r.terms.map(t => t.source).filter(Boolean)).size > 1

/** Consecutive terms from the same source, with their subtotal. */
function bySource(terms: TermResult[]): { source?: string; terms: TermResult[]; total: number }[] {
  const out: { source?: string; terms: TermResult[]; total: number }[] = []
  for (const t of terms) {
    const value = t.sign * (t.kind === 'const' ? t.value : t.subtotal)
    const last = out[out.length - 1]
    if (last && last.source === t.source) { last.terms.push(t); last.total += value }
    else out.push({ source: t.source, terms: [t], total: value })
  }
  return out
}

/** One line per damage source: "Hex  [3, 3] = 6". */
function Sources({ terms }: { terms: TermResult[] }) {
  const { attackName } = useI18n()
  return (
    <ul className="ff-roll__sources">
      {bySource(terms).map((g, i) => (
        <li key={i}>
          {g.source && <span className="ff-roll__source">{attackName(g.source)}</span>}
          <bdi dir="ltr" className="ff-roll__dice"><Terms terms={g.terms} /></bdi>
          <bdi dir="ltr" className="ff-roll__subtotal">= {g.total}</bdi>
        </li>
      ))}
    </ul>
  )
}

export function RollView({ roll, compact = false }: { roll: RollResult; compact?: boolean }) {
  const crit = roll.d20?.crit && roll.type !== 'deathSave'
  const fumble = roll.d20?.fumble
  const { t } = useI18n()
  const plain = !roll.label || roll.label.trim() === roll.notation
  const sources = hasSources(roll)
  return (
    <div className={`ff-roll${crit ? ' ff-roll--crit' : ''}${fumble ? ' ff-roll--fumble' : ''}${compact ? ' ff-roll--compact' : ''}`}>
      <div className="ff-roll__head">
        <span className="ff-roll__label">
          {roll.roller && <span className="ff-roll__who">{roll.roller.characterName} · </span>}
          {plain ? <Notation text={roll.notation} /> : roll.label}
          {roll.d20 && roll.d20.mode !== 'normal' && (
            <span className="ff-roll__mode">{t(roll.d20.mode === 'advantage' ? 'dice.advShort' : 'dice.disShort')}</span>
          )}
        </span>
        <span className="ff-roll__total" aria-label={t('dice.total', { total: roll.total })}>{roll.total}</span>
      </div>
      <div className="ff-roll__detail">
        {sources ? <Sources terms={roll.terms} /> : <Terms terms={roll.terms} />}
        {crit && <span className="ff-roll__badge">{t('dice.crit')}</span>}
        {fumble && <span className="ff-roll__badge">{t('dice.nat1')}</span>}
        {roll.autoFail && <span className="ff-roll__badge">{t('dice.autoFail')}</span>}
        {!compact && !plain && <span className="ff-roll__notation"><Notation text={roll.notation} /></span>}
      </div>
    </div>
  )
}

/** One line of an action card: "To hit … 27 Critical!" or "Damage (slashing) … 93" with its dice. */
function ActionPart({ roll }: { roll: RollResult }) {
  const { t, term } = useI18n()
  const crit = roll.d20?.crit
  const fumble = roll.d20?.fumble
  const type = roll.damageType ?? /\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\b/.exec(roll.label ?? '')?.[1]
  const what = roll.type === 'attack' ? t('cs.roll.toHit')
    : roll.type !== 'damage' ? roll.label ?? roll.notation
      : type === 'healing' ? t('cs.roll.healing')
        : type ? t('cs.roll.damage', { type: term('damage', type, type) }) : t('cs.roll.damagePlain')
  return (
    <div className={`ff-roll__part ff-roll__part--${roll.type}`}>
      <div className="ff-roll__head">
        <span className="ff-roll__what">
          {what}
          {roll.d20 && roll.d20.mode !== 'normal' && (
            <span className="ff-roll__mode">{t(roll.d20.mode === 'advantage' ? 'dice.advShort' : 'dice.disShort')}</span>
          )}
          {crit && <span className="ff-roll__badge">{t('dice.crit')}</span>}
          {fumble && <span className="ff-roll__badge">{t('dice.nat1')}</span>}
        </span>
        <span className="ff-roll__total" aria-label={t('dice.total', { total: roll.total })}>{roll.total}</span>
      </div>
      <div className="ff-roll__detail">
        {hasSources(roll) ? <Sources terms={roll.terms} /> : (
          <>
            <Terms terms={roll.terms} />
            <span className="ff-roll__notation"><Notation text={roll.notation} /></span>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * A history entry: one roll, or the rolls of one action (groupByAction) on a single card,
 * with the to-hit and the damage each labelled.
 */
export function RollGroupView({ rolls, compact = false }: { rolls: readonly RollResult[]; compact?: boolean }) {
  const { attackName } = useI18n()
  if (rolls.length === 1) return <RollView roll={rolls[0]} compact={compact} />
  const hit = rolls.find(r => r.type === 'attack')
  const who = rolls[0].roller
  return (
    <div className={`ff-roll ff-roll--action${hit?.d20?.crit ? ' ff-roll--crit' : ''}${compact ? ' ff-roll--compact' : ''}`}>
      <div className="ff-roll__label">
        {who && <span className="ff-roll__who">{who.characterName} · </span>}
        {attackName(actionName(rolls))}
      </div>
      {rolls.map(r => <ActionPart key={r.id} roll={r} />)}
    </div>
  )
}

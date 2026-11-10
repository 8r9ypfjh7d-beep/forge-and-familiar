// Dice roller panel: quick dice buttons, a notation box, advantage toggle and the roll history.
import { useState, type FormEvent } from 'react'
import { useI18n } from '../../i18n'
import { DiceNotationError, formatNotation, parseNotation } from '../notation'
import { roll as rollNotation, rollD20 } from '../roll'
import { shareSecretRoll } from '../secretCloud'
import type { RollMode, RollOptions, RollResult, Term } from '../types'
import { useDice, useRollHistory } from './DiceProvider'
import { RollGroupView } from './RollView'
import { groupByAction } from '../history'
import './dice.css'

const DICE = [4, 6, 8, 10, 12, 20, 100] as const

interface Props {
  /** Tags free rolls with this character and filters the history to them. */
  character?: { id: string; name: string }
  /** Show every roll on this device instead of only this character's. */
  showAll?: boolean
  /** A player in a party: offers a switch that sends rolls to the party's DM only (see secret.ts). */
  secretTo?: { partyId: string; userId: string }
}

export function DiceTray({ character, showAll = false, secretTo }: Props) {
  const { record, roll, history } = useDice()
  const rolls = useRollHistory(showAll ? undefined : character?.id)
  const [pool, setPool] = useState<Record<number, number>>({})
  const [modifier, setModifier] = useState(0)
  const [mode, setMode] = useState<RollMode>('normal')
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState<string>()
  const [secretOn, setSecretOn] = useState(false)
  const [sent, setSent] = useState<{ id: string; label: string }[]>([])
  const { t } = useI18n()
  const secret = secretTo && secretOn ? secretTo : undefined

  // A secret roll skips this device's history and the roll animation, so the player never sees the
  // result and the party feed never gets it. Only the DM's secret log does.
  const send = (r: RollResult) => {
    if (!secret) return record(r)
    void shareSecretRoll(secret.partyId, { roll: r, fromUserId: secret.userId }).catch(() => {})
    setSent(list => [{ id: r.id, label: r.label ?? r.notation }, ...list].slice(0, 3))
    return r
  }
  const rollText = (notation: string, opts: RollOptions) => (secret ? send(rollNotation(notation, opts)) : roll(notation, opts))

  const roller = character && { characterId: character.id, characterName: character.name }
  const poolTerms: Term[] = [
    ...DICE.filter(s => pool[s]).map((s): Term => ({ kind: 'dice', sign: 1, count: pool[s], sides: s })),
    ...(modifier ? [{ kind: 'const', sign: modifier < 0 ? -1 : 1, value: Math.abs(modifier) } as Term] : []),
  ]
  const picked = poolTerms.some(t => t.kind === 'dice')
  // Nothing picked: the one Roll button rolls a d20 (with the modifier and advantage), the most common roll.
  const poolNotation = picked ? formatNotation(poolTerms) : formatNotation([{ kind: 'dice', sign: 1, count: 1, sides: 20 }, ...poolTerms])
  const singleD20 = !picked || DICE.every(s => (s === 20 ? pool[s] === 1 : !pool[s]))

  const add = (sides: number) => setPool(p => ({ ...p, [sides]: Math.min(99, (p[sides] ?? 0) + 1) }))
  const drop = (sides: number) => setPool(p => ({ ...p, [sides]: Math.max(0, (p[sides] ?? 0) - 1) }))
  const reset = () => {
    setPool({})
    setModifier(0)
  }

  const d20Mode = singleD20 && mode !== 'normal'
  const rollLabel = d20Mode ? t(mode === 'advantage' ? 'dice.withAdv' : 'dice.withDis') : poolNotation

  function rollPool() {
    // A lone d20 honours the advantage toggle; other pools roll as written.
    if (d20Mode) send(rollD20(modifier, { mode, roller, label: rollLabel }, 'custom'))
    else rollText(poolNotation, { roller })
    reset()
  }

  function submitText(e: FormEvent) {
    e.preventDefault()
    try {
      parseNotation(text)
      rollText(text, { roller, label: text.trim() })
      setText('')
      setError(undefined)
    } catch (err) {
      setError(err instanceof DiceNotationError ? err.message : t('dice.error'))
    }
  }

  return (
    <section className="ff-dice" aria-label={t('dice.roller')}>
      <div className="ff-dice__buttons">
        {DICE.map(s => (
          <button key={s} type="button" className="ff-dice__die" onClick={() => add(s)} aria-label={t('dice.addDie', { sides: s })}>
            d{s}
            {pool[s] ? <span className="ff-dice__count">{pool[s]}</span> : null}
          </button>
        ))}
      </div>

      <div className="ff-dice__row">
        <label className="ff-dice__mod">
          {t('dice.mod')}
          <input type="number" value={modifier} onChange={e => setModifier(Number(e.target.value) || 0)} />
        </label>
        <div className="ff-dice__modes" role="radiogroup" aria-label={t('dice.advantageGroup')}>
          {(['advantage', 'normal', 'disadvantage'] as const).map(m => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={mode === m ? 'is-on' : ''}
              onClick={() => setMode(m)}
              title={t(m === 'normal' ? 'dice.normal' : m === 'advantage' ? 'dice.advTitle' : 'dice.disTitle')}
            >
              {t(m === 'normal' ? 'dice.normal' : m === 'advantage' ? 'dice.adv' : 'dice.dis')}
            </button>
          ))}
        </div>
      </div>

      {secretTo && (
        <label className={`ff-dice__secret${secretOn ? ' is-on' : ''}`}>
          <input type="checkbox" checked={secretOn} onChange={e => setSecretOn(e.target.checked)} />
          <span aria-hidden="true">🔒</span> {t('dice.secret')}
          {secretOn && <span className="ff-dice__secret-hint">{t('dice.secretHint')}</span>}
        </label>
      )}

      {picked && (
        <ul className="ff-dice__chips" aria-label={t('dice.picked')}>
          {DICE.filter(s => pool[s]).map(s => (
            <li key={s}>
              <button type="button" className="ff-dice__chip" onClick={() => drop(s)} aria-label={t('dice.removeDie', { sides: s })}>
                <bdi dir="ltr">{pool[s]}d{s}</bdi> <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
          <li><button type="button" className="ff-dice__ghost" onClick={reset}>{t('dice.clear')}</button></li>
        </ul>
      )}

      <button type="button" className="ff-dice__roll ff-dice__roll--main" onClick={rollPool}>
        <span aria-hidden="true">🎲 </span>{t('dice.rollPool', { notation: poolNotation }) + (d20Mode ? t(mode === 'advantage' ? 'dice.advShort' : 'dice.disShort') : '')}
      </button>

      {typing
        ? (
          <form className="ff-dice__row" onSubmit={submitText}>
            <input
              className="ff-dice__text"
              autoFocus
              value={text}
              onChange={e => {
                setText(e.target.value)
                setError(undefined)
              }}
              placeholder="2d6+3, 4d6dl1, d%"
              aria-label={t('dice.notation')}
              aria-invalid={!!error}
              dir="ltr"
            />
            <button type="submit" className="ff-dice__ghost" disabled={!text.trim()}>{t('dice.roll')}</button>
          </form>
        )
        : <button type="button" className="ff-dice__link" onClick={() => setTyping(true)}>{t('dice.typeFormula')}</button>}
      {error && <p className="ff-dice__error" role="alert">{error}</p>}
      {secretTo && sent.length > 0 && (
        <ol className="ff-dice__sent" aria-live="polite">
          {sent.map(s => <li key={s.id}><span aria-hidden="true">🔒</span> {t('dice.secretSent', { label: s.label })}</li>)}
        </ol>
      )}

      <div className="ff-dice__history-head">
        <h3>{t('dice.history')}</h3>
        {rolls.length > 0 && (
          <button type="button" className="ff-dice__ghost" onClick={() => history.clear()}>{t('dice.clearHistory')}</button>
        )}
      </div>
      <ol className="ff-dice__history" aria-live="polite">
        {rolls.length === 0 && <li className="ff-dice__empty">{t('dice.empty')}</li>}
        {groupByAction(rolls, r => r).map((g, i) => (
          <li key={g[0].id}>
            <RollGroupView rolls={g} compact={i > 0} />
          </li>
        ))}
      </ol>
    </section>
  )
}

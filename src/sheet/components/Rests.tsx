import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character, HitDie } from '../../model/character'
import { abilityMod, formatMod, getAbilityScores } from '../../rules'
import { canLongRest, hitDiceRemaining, longRest, shortRest, spendHitDie, vitals } from '../engine'
import type { Apply } from '../types'
import { useSheetRolls } from '../dice'
import { LONG_REST_MINUTES, SHORT_REST_MINUTES } from '../clock'
import { useAdvanceTime } from '../useAdvanceTime'
import { MealChoice } from '../../supplies/Supplies'
import { defaultMeal, endDay, type Meal } from '../../supplies/supplies'

export function Rests({ character, apply }: { character: Character; apply: Apply }) {
  const [shortOpen, setShortOpen] = useState(false)
  const [confirmLong, setConfirmLong] = useState(false)
  const [meal, setMeal] = useState<Meal>('ration')
  const rolls = useSheetRolls(character)
  const advance = useAdvanceTime(character, apply)
  const con = abilityMod(getAbilityScores(character).con)
  const dice = hitDiceRemaining(character)
  const dead = vitals(character) === 'dead'
  const { t } = useI18n()

  const spend = (die: HitDie, manual?: number) => {
    const roll = manual ?? rolls.hitDie(die, con)
    const gained = Math.max(0, roll + con)
    apply(t('sheet.log.hitDie', { die, roll, con: formatMod(con), gained }), c => spendHitDie(c, die, roll))
  }

  return (
    <section className="card rests" aria-labelledby="rest-title">
      <h2 id="rest-title">{t('sheet.rest')}</h2>
      <p className="hint">
        {t('sheet.hitDice', { list: dice.map(d => `${d.remaining}/${d.total} ${d.die}`).join(', ') })}
      </p>
      <div className="row">
        <button type="button" className="btn" disabled={dead} onClick={() => setShortOpen(o => !o)} aria-expanded={shortOpen}>
          {t('rest.short')}
        </button>
        <button type="button" className="btn primary" disabled={!canLongRest(character)} onClick={() => { setMeal(defaultMeal(character)); setConfirmLong(true) }}>
          {t('rest.long')}
        </button>
      </div>
      {!canLongRest(character) && !dead && <p className="hint">{t('sheet.longRestNeedsHp')}</p>}

      {shortOpen && (
        <div className="rest-panel">
          <p>{t('sheet.shortRestHelp', { con: formatMod(con) })}</p>
          <ul className="dice-list">
            {dice.map(d => <HitDieRow key={d.die} die={d.die} remaining={d.remaining} disabled={vitals(character) !== 'healthy'} onSpend={spend} />)}
          </ul>
          <div className="row">
            <button type="button" className="btn primary"
              onClick={() => { advance(SHORT_REST_MINUTES, t('sheet.log.short'), shortRest); setShortOpen(false) }}>{t('sheet.finishShort')}</button>
            <button type="button" className="btn ghost" onClick={() => setShortOpen(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {confirmLong && (
        <div className="rest-panel" role="alertdialog" aria-label={t('sheet.confirmLong')}>
          <p>{t('sheet.longRestHelp')}</p>
          <MealChoice character={character} meal={meal} onChange={setMeal} />
          <div className="row">
            <button type="button" className="btn primary"
              onClick={() => { advance(LONG_REST_MINUTES, t(meal === 'ration' ? 'sheet.log.longRation' : meal === 'none' ? 'sheet.log.longHungry' : 'sheet.log.long'), c => endDay(c, longRest(c), meal)); setConfirmLong(false); setShortOpen(false) }}>{t('sheet.restUntilMorning')}</button>
            <button type="button" className="btn ghost" onClick={() => setConfirmLong(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </section>
  )
}

function HitDieRow({ die, remaining, disabled, onSpend }: { die: HitDie; remaining: number; disabled: boolean; onSpend: (die: HitDie, manual?: number) => void }) {
  const [manual, setManual] = useState('')
  const sides = Number(die.slice(1))
  const n = Number(manual)
  const off = disabled || remaining <= 0
  const { t } = useI18n()
  return (
    <li>
      <span className="track-label">{die} <small>{t('sheet.dieLeft', { n: remaining })}</small></span>
      <button type="button" className="btn" disabled={off} onClick={() => onSpend(die)}>{t('sheet.rollDie', { die })}</button>
      <form className="inline" onSubmit={e => { e.preventDefault(); if (n >= 1 && n <= sides) { onSpend(die, n); setManual('') } }}>
        <input aria-label={t('sheet.myRoll', { die })} placeholder={t('sheet.myRollPlaceholder')} inputMode="numeric" value={manual} disabled={off}
          onChange={e => setManual(e.target.value.replace(/\D/g, ''))} />
        <button type="submit" className="btn ghost" disabled={off || !(n >= 1 && n <= sides)}>{t('sheet.use')}</button>
      </form>
    </li>
  )
}

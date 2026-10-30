// Supplies card on the live sheet: ammunition per ranged weapon and the ration countdown.
import { useState } from 'react'
import type { Character } from '../model/character'
import { rollAttack } from '../dice'
import { useDice } from '../dice/ui'
import { useI18n } from '../i18n'
import { derive, formatMod } from '../rules'
import type { Apply } from '../sheet/types'
import { ammoSpent, daysWithoutFood, foodLimit, rangedWeapons, rationsLeft, recoverAmmo, spendAmmo, type Meal } from './supplies'
import './supplies.css'

/** At or below this many pieces the count turns to a warning. */
const LOW = 5

export function Supplies({ character, apply }: { character: Character; apply: Apply }) {
  const { record } = useDice()
  const { t, item } = useI18n()
  const [lastShot, setLastShot] = useState<string>()
  const ranged = rangedWeapons(character)
  const rations = rationsLeft(character)
  const hungry = daysWithoutFood(character)
  const limit = foodLimit(character)
  const ammoIds = [...new Set(ranged.map(r => r.ammoId))]
  const recoverable = ammoIds.map(id => ({ id, name: item(id, ranged.find(r => r.ammoId === id)!.ammoName), n: Math.floor(ammoSpent(character, id) / 2) }))
    .filter(r => r.n > 0)
  const recoverList = recoverable.map(r => `${r.name} +${r.n}`).join(', ')

  const shoot = (name: string, label: string, ammoId: string) => {
    const d = derive(character)
    const attack = d.attacks.find(a => a.name === name)
    if (!attack) return
    const r = record(rollAttack(attack, { character, lucky: d.lucky }))
    const text = t(r.d20?.crit ? 'supplies.log.shotNat20' : r.d20?.fumble ? 'supplies.log.shotNat1' : 'supplies.log.shot', { weapon: label, total: r.total })
    setLastShot(text)
    apply(text, c => spendAmmo(c, ammoId))
  }

  return (
    <section className="card supplies" aria-labelledby="supplies-title">
      <h2 id="supplies-title">{t('supplies.title')}</h2>
      <ul className="track-list">
        {ranged.map(({ weapon, ammoId, ammoName: english, left }) => {
          const label = item(weapon.id, weapon.name)
          const ammoName = item(ammoId, english)
          return (
          <li key={weapon.id}>
            <span className="track-label">{label}<small>{ammoName}</small></span>
            <span className={`supply-count${left <= LOW ? ' low' : ''}`}>{left === 0 ? t('supplies.out', { ammo: ammoName }) : t('supplies.left', { n: left })}</span>
            <button type="button" className="btn primary" disabled={left === 0} onClick={() => shoot(weapon.name, label, ammoId)}>
              {t('supplies.shoot')} <small>{formatMod(derive(character).attacks.find(a => a.name === weapon.name)?.bonus ?? 0)}</small>
            </button>
            <button type="button" className="btn ghost small" disabled={left === 0} aria-label={t('supplies.spendOne', { ammo: ammoName })}
              onClick={() => apply(t('supplies.log.spent', { ammo: ammoName }), c => spendAmmo(c, ammoId))}>−1</button>
          </li>
          )
        })}
        <li>
          <span className="track-label">{t('supplies.rations')}<small>{t('supplies.perRest')}</small></span>
          <span className={`supply-count${rations <= 1 ? ' low' : ''}`}>
            {rations === 0 ? t('supplies.noneLeft') : t('supplies.days', { count: rations })}
          </span>
        </li>
      </ul>
      {ranged.length === 0 && <p className="hint">{t('supplies.noAmmo')}</p>}
      {lastShot && <p className="hint" aria-live="polite">{lastShot}</p>}
      {hungry > 0 && (
        <p className={`hint${hungry >= limit ? ' supply-warn' : ''}`}>
          {t('supplies.hungry', { count: hungry })} {hungry >= limit ? t('supplies.pastLimit') : t('supplies.limit', { n: limit })}
        </p>
      )}
      {recoverable.length > 0 && (
        <div className="row">
          <button type="button" className="btn"
            onClick={() => apply(t('supplies.log.recovered', { list: recoverList }), recoverAmmo)}>
            {t('supplies.recover', { list: recoverList })}
          </button>
        </div>
      )}
    </section>
  )
}

const MEALS: Meal[] = ['ration', 'other', 'none']

/** The day's meal, picked in the long rest dialog and passed to endDay. */
export function MealChoice({ character, meal, onChange }: { character: Character; meal: Meal; onChange: (m: Meal) => void }) {
  const rations = rationsLeft(character)
  const { t } = useI18n()
  return (
    <fieldset className="meal-choice">
      <legend>{t('supplies.food')}</legend>
      {MEALS.map(m => (
        <label key={m}>
          <input type="radio" name="meal" value={m} checked={meal === m} disabled={m === 'ration' && rations === 0}
            onChange={() => onChange(m)} />
          {t(`supplies.meal.${m}`)}{m === 'ration' && <small> {t('supplies.rationsLeft', { n: rations })}</small>}
        </label>
      ))}
    </fieldset>
  )
}

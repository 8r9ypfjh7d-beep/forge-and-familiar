// Supplies card on the live sheet: ammunition per ranged weapon and the ration countdown.
import { useState } from 'react'
import type { Character } from '../model/character'
import { rollAttack } from '../dice'
import { useDice } from '../dice/ui'
import { derive, formatMod } from '../rules'
import type { Apply } from '../sheet/types'
import { ammoSpent, countOf, daysWithoutFood, foodLimit, rangedWeapons, recoverAmmo, spendAmmo, RATION_ID, type Meal } from './supplies'
import './supplies.css'

/** At or below this many pieces the count turns to a warning. */
const LOW = 5

export function Supplies({ character, apply }: { character: Character; apply: Apply }) {
  const { record } = useDice()
  const [lastShot, setLastShot] = useState<string>()
  const ranged = rangedWeapons(character)
  const rations = countOf(character, RATION_ID)
  const hungry = daysWithoutFood(character)
  const limit = foodLimit(character)
  const ammoIds = [...new Set(ranged.map(r => r.ammoId))]
  const recoverable = ammoIds.map(id => ({ id, name: ranged.find(r => r.ammoId === id)!.ammoName, n: Math.floor(ammoSpent(character, id) / 2) }))
    .filter(r => r.n > 0)

  const shoot = (name: string, ammoId: string) => {
    const d = derive(character)
    const attack = d.attacks.find(a => a.name === name)
    if (!attack) return
    const r = record(rollAttack(attack, { character, lucky: d.lucky }))
    const nat = r.d20?.crit ? ' (natural 20)' : r.d20?.fumble ? ' (natural 1)' : ''
    const text = `Shot the ${name}: ${r.total} to hit${nat}`
    setLastShot(text)
    apply(text, c => spendAmmo(c, ammoId))
  }

  return (
    <section className="card supplies" aria-labelledby="supplies-title">
      <h2 id="supplies-title">Ammo and rations</h2>
      <ul className="track-list">
        {ranged.map(({ weapon, ammoId, ammoName, left }) => (
          <li key={weapon.id}>
            <span className="track-label">{weapon.name}<small>{ammoName}</small></span>
            <span className={`supply-count${left <= LOW ? ' low' : ''}`}>{left === 0 ? `Out of ${ammoName.toLowerCase()}` : `${left} left`}</span>
            <button type="button" className="btn primary" disabled={left === 0} onClick={() => shoot(weapon.name, ammoId)}>
              Shoot <small>{formatMod(derive(character).attacks.find(a => a.name === weapon.name)?.bonus ?? 0)}</small>
            </button>
            <button type="button" className="btn ghost small" disabled={left === 0} aria-label={`Spend one ${ammoName} without rolling`}
              onClick={() => apply(`Spent one ${ammoName}`, c => spendAmmo(c, ammoId))}>−1</button>
          </li>
        ))}
        <li>
          <span className="track-label">Rations<small>one per long rest</small></span>
          <span className={`supply-count${rations <= 1 ? ' low' : ''}`}>
            {rations === 0 ? 'None left' : `${rations} ${rations === 1 ? 'day' : 'days'}`}
          </span>
        </li>
      </ul>
      {ranged.length === 0 && <p className="hint">Equip a bow or crossbow to track its ammunition here.</p>}
      {lastShot && <p className="hint" aria-live="polite">{lastShot}</p>}
      {hungry > 0 && (
        <p className={`hint${hungry >= limit ? ' supply-warn' : ''}`}>
          {hungry} {hungry === 1 ? 'day' : 'days'} without food.
          {hungry >= limit ? ' Past the limit of going without food.' : ` The limit is ${limit}.`}
        </p>
      )}
      {recoverable.length > 0 && (
        <div className="row">
          <button type="button" className="btn"
            onClick={() => apply(`Recovered ${recoverable.map(r => `${r.name} +${r.n}`).join(', ')}`, recoverAmmo)}>
            Search the battlefield: recover {recoverable.map(r => `${r.name} +${r.n}`).join(', ')}
          </button>
        </div>
      )}
    </section>
  )
}

const MEALS: { id: Meal; label: string }[] = [
  { id: 'ration', label: 'Eat a ration' },
  { id: 'other', label: 'Other food (inn, foraging, a feast)' },
  { id: 'none', label: 'Go hungry' },
]

/** The day's meal, picked in the long rest dialog and passed to endDay. */
export function MealChoice({ character, meal, onChange }: { character: Character; meal: Meal; onChange: (m: Meal) => void }) {
  const rations = countOf(character, RATION_ID)
  return (
    <fieldset className="meal-choice">
      <legend>Food today</legend>
      {MEALS.map(m => (
        <label key={m.id}>
          <input type="radio" name="meal" value={m.id} checked={meal === m.id} disabled={m.id === 'ration' && rations === 0}
            onChange={() => onChange(m.id)} />
          {m.label}{m.id === 'ration' && <small> ({rations} left)</small>}
        </label>
      ))}
    </fieldset>
  )
}

import { useState } from 'react'
import { ShowMath } from '../../explain/ShowMath'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { effectiveMaxHp, grantTempHp, heal, takeDamage, vitals } from '../engine'
import type { Apply } from '../types'

export function HitPoints({ character, apply }: { character: Character; apply: Apply }) {
  const [amount, setAmount] = useState('')
  const [critical, setCritical] = useState(false)
  const { currentHp, tempHp } = character.state
  const max = effectiveMaxHp(character)
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const pct = max ? (currentHp / max) * 100 : 0
  const state = vitals(character)
  const { t } = useI18n()

  const act = (fn: () => void) => { if (n > 0) { fn(); setAmount(''); setCritical(false) } }

  return (
    <section className="card hp" aria-labelledby="hp-title">
      <h2 id="hp-title">{t('sheet.hp')}</h2>
      <div className="hp-numbers">
        <div className="hp-current" aria-live="polite">
          <span className="big">{currentHp}</span><span className="of">/ <ShowMath character={character} stat="maxHp">{max}</ShowMath></span>
        </div>
        <div className={tempHp ? 'hp-temp has' : 'hp-temp'}>
          <span className="big">{tempHp}</span><span className="of">{t('sheet.temp')}</span>
        </div>
      </div>
      <div className="hp-bar" aria-hidden="true">
        <div className={`hp-fill ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}`} style={{ width: `${pct}%` }} />
        {tempHp > 0 && <div className="hp-temp-fill" style={{ width: `${Math.min(100, (tempHp / max) * 100)}%` }} />}
      </div>
      {state !== 'healthy' && <p className={`status status-${state}`}>{t(STATUS[state])}</p>}

      <form className="hp-controls" onSubmit={e => e.preventDefault()}>
        <label className="sr-only" htmlFor="hp-amount">{t('sheet.amount')}</label>
        <input
          id="hp-amount" inputMode="numeric" pattern="[0-9]*" placeholder="0"
          value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" className="btn danger" disabled={!n || state === 'dead'}
          onClick={() => act(() => apply(t(critical && currentHp === 0 ? 'sheet.log.damageCrit' : 'sheet.log.damage', { n }), c => takeDamage(c, n, { critical })))}>
          {t('sheet.damage')}
        </button>
        <button type="button" className="btn heal" disabled={!n || state === 'dead'}
          onClick={() => act(() => apply(t('sheet.log.heal', { n }), c => heal(c, n)))}>
          {t('sheet.heal')}
        </button>
        <button type="button" className="btn" disabled={!n}
          onClick={() => act(() => apply(t('sheet.log.temp', { n }), c => grantTempHp(c, n)))}>
          {t('sheet.tempHp')}
        </button>
      </form>
      {currentHp === 0 && state !== 'dead' && (
        <label className="check">
          <input type="checkbox" checked={critical} onChange={e => setCritical(e.target.checked)} />
          {t('sheet.critical')}
        </label>
      )}
    </section>
  )
}

const STATUS = {
  dying: 'sheet.status.dying',
  stable: 'sheet.status.stable',
  dead: 'sheet.status.dead',
} as const

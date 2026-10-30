import { useState } from 'react'
import { ShowMath } from '../../explain/ShowMath'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { DAMAGE_TYPES, concentrationDc, damageAfterDefenses, damageDefense, derive, meleeReprisals } from '../../rules'
import { editionOf } from '../../spellbook/access'
import { concentration } from '../effects'
import { effectiveMaxHp, grantTempHp, heal, takeDamage, vitals } from '../engine'
import type { Apply } from '../types'
import { AfterDamage, type Hit } from './AfterDamage'
import { Conditions } from './Conditions'

const TYPE_KEY = 'ff.damageType.v1'
const loadType = () => { try { return localStorage.getItem(TYPE_KEY) ?? '' } catch { return '' } }

export function HitPoints({ character, apply }: { character: Character; apply: Apply }) {
  const [amount, setAmount] = useState('')
  const [critical, setCritical] = useState(false)
  // The last damage type picked, remembered on this device; blank means untyped.
  const [type, setTypeState] = useState(loadType)
  const [hit, setHit] = useState<Hit | null>(null)
  const [said, setSaid] = useState<{ key: number; text: string } | null>(null)
  const { currentHp, tempHp } = character.state
  const max = effectiveMaxHp(character)
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const pct = max ? (currentHp / max) * 100 : 0
  const state = vitals(character)
  const { t, term } = useI18n()
  const d = derive(character)
  const typeName = (x: string) => term('damage', x, x)
  const typeLabel = (x: string) => term('damage', x, x[0].toUpperCase() + x.slice(1))
  const setType = (x: string) => { setTypeState(x); try { localStorage.setItem(TYPE_KEY, x) } catch { /* private mode */ } }

  const act = (fn: () => void) => { if (n > 0) { fn(); setAmount(''); setCritical(false) } }

  /** Damage through resistances and immunities, then what the hit calls for: a concentration save, reprisals, reactions. */
  const damage = () => {
    const defense = damageDefense(d, type || undefined, character)
    const taken = damageAfterDefenses(n, defense)
    const why = defense && t(defense === 'immune' ? 'hurt.immune' : 'hurt.resistant')
    const log = why
      ? t('hurt.log.typed', { taken, type: typeName(type), n, why })
      : type ? t('hurt.log.type', { n, type: typeName(type) }) : t(critical && currentHp === 0 ? 'sheet.log.damageCrit' : 'sheet.log.damage', { n })
    apply(log, c => takeDamage(c, taken, { critical }))
    const key = (hit?.key ?? 0) + 1
    const conc = concentration(character)
    setSaid(type ? { key, text: why ? t('hurt.typed', { n, type: typeName(type), taken, why }) : t('hurt.plain', { n, type: typeName(type) }) } : null)
    setHit({
      key,
      ...(type ? { type } : {}),
      ...(conc && taken > 0 ? { conc: { id: conc.id, name: conc.name, dc: concentrationDc(taken, editionOf(character)) } } : {}),
      reprisals: meleeReprisals(character),
    })
  }
  const defended = (x: string) => damageDefense(d, x, character)
  const types = [...DAMAGE_TYPES].sort((a, b) => Number(!defended(a)) - Number(!defended(b)))

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
        <button type="submit" className="btn danger" disabled={!n || state === 'dead'} onClick={() => act(damage)}>
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
      <label className="hp-type">
        <span>{t('hurt.type')}</span>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="">{t('hurt.anyType')}</option>
          {types.map(x => {
            const def = defended(x)
            return <option key={x} value={x}>{def ? t(def === 'immune' ? 'hurt.immuneMark' : 'hurt.resistantMark', { type: typeLabel(x) }) : typeLabel(x)}</option>
          })}
        </select>
      </label>
      {said && said.key === hit?.key && <p className="hp-said" aria-live="polite">{said.text}</p>}
      {hit && <AfterDamage key={hit.key} hit={hit} character={character} apply={apply} onClose={() => { setHit(null); setSaid(null) }} />}
      {currentHp === 0 && state !== 'dead' && (
        <label className="check">
          <input type="checkbox" checked={critical} onChange={e => setCritical(e.target.checked)} />
          {t('sheet.critical')}
        </label>
      )}
      <Conditions character={character} apply={apply} />
    </section>
  )
}

const STATUS = {
  dying: 'sheet.status.dying',
  stable: 'sheet.status.stable',
  dead: 'sheet.status.dead',
} as const

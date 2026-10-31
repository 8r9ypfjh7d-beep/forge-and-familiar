import { useState } from 'react'
import { Why } from '../../builder/Why'
import { metamagicKey } from '../../builder/why'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { FONT_SLOT_COST, getMetamagic, getSpellSlots, hasFontOfMagic, metamagicCost, rulesEdition, type ClassOption } from '../../rules'
import { setResourceUsed } from '../engine'
import { createSlot, slotToPoints, sorceryLeft, sorceryPools, spendSorcery } from '../fontOfMagic'
import type { Apply } from '../types'
import { Pips, Stepper } from './Pips'

export const SORCERY_POINTS = 'sorcery-points'
const PIP_LIMIT = 10

/**
 * Sorcery points (the sorcerer's pool and Metamagic Adept's), the picked Metamagic options with a Use button
 * that spends their cost, and Font of Magic's slot conversions.
 */
export function Metamagic({ character, apply }: { character: Character; apply: Apply }) {
  const { t, term } = useI18n()
  const options = getMetamagic(character)
  const pools = sorceryPools(character)
  if (pools.length === 0 && options.length === 0) return null
  const left = sorceryLeft(character)
  const font = hasFontOfMagic(character)
  return (
    <section className="card metamagic" aria-labelledby="mm-title">
      <h2 id="mm-title">{t('mm.title')} <Why id="choice.metamagic" compact /></h2>
      {pools.length > 0 && (
        <ul className="track-list">
          {pools.map(p => {
            const label = p.id === SORCERY_POINTS ? t('mm.points') : term('feat', 'metamagic-adept', 'Metamagic Adept')
            const set = (u: number) => apply(t(u > p.used ? 'sheet.log.used' : 'sheet.log.regained', { label }), c => setResourceUsed(c, p.id, u))
            return (
              <li key={p.id}>
                <span className="track-label">{label}<small>{t('rest.long')}</small></span>
                {p.max <= PIP_LIMIT
                  ? <Pips total={p.max} used={p.used} label={label} onChange={set} />
                  : <Stepper value={p.max - p.used} max={p.max} label={label} onChange={v => set(p.max - v)} />}
                {p.max <= PIP_LIMIT && <span className="track-count">{p.max - p.used}/{p.max}</span>}
              </li>
            )
          })}
        </ul>
      )}
      {options.length === 0
        ? <p className="hint">{t('mm.none')}</p>
        : <ul className="mm-list">{options.map(o => <Option key={o.id} option={o} character={character} left={left} apply={apply} />)}</ul>}
      <p className="hint">{t('mm.hint')}</p>
      {font && <FontOfMagic character={character} apply={apply} />}
    </section>
  )
}

function Option({ option: o, character, left, apply }: { option: ClassOption; character: Character; left: number; apply: Apply }) {
  const { t, term } = useI18n()
  const [level, setLevel] = useState(1)
  const name = term('metamagic', o.id, o.name)
  const cost = metamagicCost(o, level)
  const key = metamagicKey(o, rulesEdition(character))
  const text = o.text || (key ? t(key) : t('why.homebrew'))
  const short = cost > left
  return (
    <li>
      <span className="mm-name">
        <span className="mm-head"><strong>{name}</strong> <Why title={name} text={text} compact /></span>
        <small>{o.costPerSpellLevel ? t('mm.perLevel') : t('mm.cost', { count: cost })}</small>
      </span>
      {o.costPerSpellLevel && (
        <label className="mm-level">{t('mm.spellLevel')}
          <select value={level} onChange={e => setLevel(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, l) => <option key={l} value={l}>{l === 0 ? t('mm.cantrip') : l}</option>)}
          </select>
        </label>
      )}
      <button type="button" className="btn small" disabled={short} title={short ? t('mm.short') : undefined}
        aria-label={t('mm.useWhat', { name, cost })}
        onClick={() => apply(t('mm.log.used', { name, cost }), c => spendSorcery(c, cost) ?? c)}>
        {t('mm.use')} ({cost})
      </button>
    </li>
  )
}

/** Font of Magic: buy back an expended slot (1st-5th) with points, or turn an unused slot into points. */
function FontOfMagic({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const slots = getSpellSlots(character).slots
  const levels = FONT_SLOT_COST.map((cost, i) => ({ level: i + 1, cost, max: slots[i] ?? 0 })).filter(l => l.max > 0)
  if (levels.length === 0) return null
  return (
    <div className="mm-font">
      <h3 className="cs-sub">{t('mm.font')} <Why title={t('mm.font')} text={t('mm.fontWhy')} compact /></h3>
      <ul className="mm-list">
        {levels.map(({ level, cost }) => {
          const make = createSlot(character, level)
          const back = slotToPoints(character, level)
          return (
            <li key={level}>
              <span className="mm-name"><strong>{t('mm.slotLevel', { level })}</strong></span>
              <button type="button" className="btn small" disabled={!make} aria-label={t('mm.makeSlotWhat', { level, cost })}
                onClick={() => apply(t('mm.log.madeSlot', { level, cost }), c => createSlot(c, level) ?? c)}>
                {t('mm.makeSlot', { cost })}
              </button>
              <button type="button" className="btn small ghost" disabled={!back} aria-label={t('mm.slotToPointsWhat', { level })}
                onClick={() => apply(t('mm.log.slotToPoints', { level }), c => slotToPoints(c, level) ?? c)}>
                {t('mm.slotToPoints', { level })}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

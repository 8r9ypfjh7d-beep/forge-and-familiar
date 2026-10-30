import { useState } from 'react'
import { Why } from '../../builder/Why'
import { metamagicKey } from '../../builder/why'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { getMetamagic, getResources, metamagicCost, rulesEdition, type ClassOption } from '../../rules'
import { setResourceUsed } from '../engine'
import type { Apply } from '../types'
import { Pips, Stepper } from './Pips'

export const SORCERY_POINTS = 'sorcery-points'
const PIP_LIMIT = 10

/** The sorcery point pool and the picked Metamagic options, each with a Use button that spends its cost. */
export function Metamagic({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const options = getMetamagic(character)
  const pool = getResources(character).find(r => r.id === SORCERY_POINTS)
  if (!pool && options.length === 0) return null
  const max = pool?.max ?? 0
  const used = character.state.resources[SORCERY_POINTS]?.used ?? 0
  const left = max - used
  const label = t('mm.points')
  const setUsed = (u: number) => apply(t(u > used ? 'sheet.log.used' : 'sheet.log.regained', { label }), c => setResourceUsed(c, SORCERY_POINTS, u))
  return (
    <section className="card metamagic" aria-labelledby="mm-title">
      <h2 id="mm-title">{t('mm.title')} <Why id="choice.metamagic" compact /></h2>
      {pool && (
        <ul className="track-list">
          <li>
            <span className="track-label">{label}<small>{t('rest.long')}</small></span>
            {max <= PIP_LIMIT
              ? <Pips total={max} used={used} label={label} onChange={setUsed} />
              : <Stepper value={left} max={max} label={label} onChange={v => setUsed(max - v)} />}
            {max <= PIP_LIMIT && <span className="track-count">{left}/{max}</span>}
          </li>
        </ul>
      )}
      {options.length === 0
        ? <p className="hint">{t('mm.none')}</p>
        : <ul className="mm-list">{options.map(o => <Option key={o.id} option={o} character={character} left={left} apply={apply} used={used} />)}</ul>}
      <p className="hint">{t('mm.hint')}</p>
    </section>
  )
}

function Option({ option: o, character, left, used, apply }: { option: ClassOption; character: Character; left: number; used: number; apply: Apply }) {
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
        <strong>{name}</strong> <Why title={name} text={text} compact />
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
        onClick={() => apply(t('mm.log.used', { name, cost }), c => setResourceUsed(c, SORCERY_POINTS, used + cost))}>
        {t('mm.use')} ({cost})
      </button>
    </li>
  )
}

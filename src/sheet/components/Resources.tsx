import { useState } from 'react'
import { isValidNotation } from '../../dice'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { getResources } from '../../rules'
import { DAWN_ITEMS } from '../../rules/data/dawnItems'
import { dawn, dawnCounters, removeCounter, setResourceUsed, upsertCounter, type Counter } from '../engine'
import { useSheetRolls } from '../dice'
import type { Apply } from '../types'
import { Pips, Stepper } from './Pips'

const RECHARGE = { short: 'rest.short', long: 'rest.long', dawn: 'rest.dawn', none: 'rest.none' } as const
/** Pools larger than this show a stepper instead of a row of pips. */
const PIP_LIMIT = 10

export function Resources({ character, apply }: { character: Character; apply: Apply }) {
  const resources = getResources(character)
  const counters = character.state.counters ?? []
  const { t, term } = useI18n()
  const rolls = useSheetRolls(character)
  const atDawn = dawnCounters(character)
  // Item charges (from an item's effects) that come back at dawn, with what is spent.
  const dawnItems = resources.filter(r => r.recharge === 'dawn').map(r => ({ ...r, used: character.state.resources[r.id]?.used ?? 0 }))

  const onDawn = () => {
    const rolled: Record<string, number> = {}
    for (const k of atDawn) if (k.used > 0 && k.regain?.trim()) rolled[k.id] = rolls.total(k.regain, t('sheet.atDawn', { label: k.label }))
    for (const r of dawnItems) if (r.used > 0 && r.regain) rolled[r.id] = rolls.total(r.regain, t('sheet.atDawn', { label: r.label }))
    apply(t('sheet.log.dawn'), c => dawn(c, rolled))
  }

  return (
    <section className="card" aria-labelledby="res-title">
      <h2 id="res-title">{t('sheet.resources')}</h2>
      {resources.length === 0 && counters.length === 0 && <p className="hint">{t('sheet.resources.empty')}</p>}
      <ul className="track-list">
        {resources.map(r => {
          const used = character.state.resources[r.id]?.used ?? 0
          const label = term('resource', r.id, r.label)
          const set = (u: number) => apply(t(u > used ? 'sheet.log.used' : 'sheet.log.regained', { label }), c => setResourceUsed(c, r.id, u))
          return (
            <li key={r.id}>
              <span className="track-label">{label}<small>{t(RECHARGE[r.recharge])}{r.regain ? t('sheet.regains', { dice: r.regain }) : ''}</small></span>
              {r.max <= PIP_LIMIT
                ? <Pips total={r.max} used={used} label={label} onChange={set} />
                : <Stepper value={r.max - used} max={r.max} label={label} onChange={v => set(r.max - v)} />}
              {r.max <= PIP_LIMIT && <span className="track-count">{r.max - used}/{r.max}</span>}
            </li>
          )
        })}
        {counters.map(k => (
          <li key={k.id}>
            <span className="track-label">{k.label}<small>{t(RECHARGE[k.recharge])}{k.recharge === 'dawn' && k.regain ? t('sheet.regains', { dice: k.regain }) : ''}</small></span>
            <Stepper value={k.max - k.used} max={k.max} label={k.label}
              onChange={v => apply(t(k.max - v > k.used ? 'sheet.log.used' : 'sheet.log.regained', { label: k.label }), c => upsertCounter(c, { ...k, used: k.max - v }))} />
            <button type="button" className="btn ghost small" aria-label={t('sheet.removeWhat', { label: k.label })}
              onClick={() => apply(t('sheet.log.removedTracker', { label: k.label }), c => removeCounter(c, k.id))}>{t('common.remove')}</button>
          </li>
        ))}
      </ul>
      {atDawn.length + dawnItems.length > 0 && (
        <button type="button" className="btn small dawn" disabled={[...atDawn, ...dawnItems].every(k => k.used === 0)} onClick={onDawn}>
          {t('sheet.dawnButton')}
        </button>
      )}
      <AddCounter onAdd={k => apply(t('sheet.log.addedTracker', { label: k.label }), c => upsertCounter(c, k))} />
    </section>
  )
}

function AddCounter({ onAdd }: { onAdd: (k: Counter) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [max, setMax] = useState('20')
  const [recharge, setRecharge] = useState<Counter['recharge']>('none')
  const [regain, setRegain] = useState('')
  const regainOk = !regain.trim() || isValidNotation(regain.trim())
  const { t } = useI18n()

  if (!open) return <button type="button" className="btn ghost" onClick={() => setOpen(true)}>{t('sheet.addTracker')}</button>

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Math.floor(Number(max))
    if (!label.trim() || !(n > 0) || !regainOk) return
    const dice = recharge === 'dawn' && regain.trim() ? { regain: regain.trim() } : {}
    onAdd({ id: `custom-${Date.now().toString(36)}`, label: label.trim(), max: n, used: 0, recharge, ...dice })
    setLabel(''); setMax('20'); setRecharge('none'); setRegain(''); setOpen(false)
  }

  const preset = (id: string) => {
    const item = DAWN_ITEMS.find(i => i.id === id)
    if (!item) return
    setLabel(item.name); setMax(String(item.charges)); setRecharge('dawn'); setRegain(item.regain ?? '')
  }

  return (
    <form className="add-counter" onSubmit={submit}>
      <label className="wide">{t('sheet.tracker.preset')}
        <select value="" onChange={e => preset(e.target.value)}>
          <option value="">{t('sheet.tracker.presetPick')}</option>
          {DAWN_ITEMS.map(i => <option key={i.id} value={i.id}>{i.name} ({i.charges}{i.regain ? `, +${i.regain}` : ''})</option>)}
        </select>
      </label>
      <label>{t('sheet.tracker.name')}<input value={label} onChange={e => setLabel(e.target.value)} placeholder={t('sheet.tracker.placeholder')} autoFocus /></label>
      <label>{t('sheet.tracker.max')}<input value={max} onChange={e => setMax(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></label>
      <label>{t('sheet.tracker.recharge')}
        <select value={recharge} onChange={e => setRecharge(e.target.value as Counter['recharge'])}>
          <option value="none">{t('rest.none')}</option>
          <option value="short">{t('rest.short')}</option>
          <option value="long">{t('rest.long')}</option>
          <option value="dawn">{t('rest.dawnOption')}</option>
        </select>
      </label>
      {recharge === 'dawn' && (
        <label className="wide">Regains at dawn
          <input value={regain} onChange={e => setRegain(e.target.value)} placeholder="1d6+1, blank for all"
            aria-invalid={!regainOk} />
        </label>
      )}
      <div className="row">
        <button type="submit" className="btn primary">{t('common.add')}</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

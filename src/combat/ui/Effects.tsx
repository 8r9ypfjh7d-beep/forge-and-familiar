import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/locales/en'
import type { ConditionId } from '../../rules/types'
import { addEffect, endEffect } from '../engine'
import { CONDITIONS, type Effect, type Encounter } from '../types'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()

/** SRD durations in rounds (6 seconds each). */
const DURATIONS: { label: MessageKey; rounds: number | null; tick?: Effect['tick'] }[] = [
  { label: 'combat.dur.endNext', rounds: 1, tick: 'end' },
  { label: 'combat.dur.round', rounds: 1 },
  { label: 'combat.dur.minute', rounds: 10 },
  { label: 'combat.dur.tenMin', rounds: 100 },
  { label: 'combat.dur.hour', rounds: 600 },
  { label: 'combat.dur.untilEnded', rounds: null },
  { label: 'combat.dur.custom', rounds: -1 },
]

/** Active effects with time left, and the form to add one. */
export function Effects({ enc, act }: { enc: Encounter; act: Act }) {
  const { t, term } = useI18n()
  const name = (id?: string) => enc.combatants.find(c => c.id === id)?.name
  return (
    <section className="glass thick effects">
      <h3 className="glass-eyebrow">{t('combat.effects')}</h3>
      {enc.effects.length === 0
        ? <p className="muted small">{t('combat.effectsEmpty')}</p>
        : (
          <ul className="plain">
            {enc.effects.map(e => (
              <li key={e.id} className="effect">
                <div>
                  <strong>{e.name}</strong>{e.concentration && <span className="tag" title={t('combat.concentration')}>◎</span>}
                  <div className="muted small">
                    {[name(e.sourceId) && t('combat.fromLower', { name: name(e.sourceId) ?? '' }),
                      e.targetIds.length > 0 && t('combat.onLower', { names: e.targetIds.map(name).join(', ') }),
                      e.condition && term('condition', e.condition, e.condition)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="left">{e.remaining === null ? '∞' : t('combat.rounds', { count: e.remaining })}</span>
                <button className="icon" onClick={() => act(x => endEffect(x, e.id))} aria-label={t('combat.endEffect', { name: e.name })}>✕</button>
              </li>
            ))}
          </ul>
        )}
      {enc.combatants.length > 0 && <EffectForm enc={enc} act={act} />}
    </section>
  )
}

function EffectForm({ enc, act }: { enc: Encounter; act: Act }) {
  const { t, term } = useI18n()
  const [open, setOpen] = useState(false)
  const [effectName, setName] = useState('')
  const [sourceId, setSource] = useState(enc.activeId ?? '')
  const [targets, setTargets] = useState<string[]>([])
  const [duration, setDuration] = useState(2)
  const [custom, setCustom] = useState('3')
  const [condition, setCondition] = useState<ConditionId | ''>('')
  const [concentration, setConcentration] = useState(false)

  if (!open) return <button className="glass-btn small" onClick={() => { setSource(enc.activeId ?? ''); setOpen(true) }}>{t('combat.addEffect')}</button>

  const d = DURATIONS[duration]
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const remaining = d.rounds === -1 ? Math.max(1, Math.floor(Number(custom) || 1)) : d.rounds
    act(e => addEffect(e, {
      id: newId(), name: effectName.trim(), sourceId: sourceId || undefined, targetIds: targets,
      condition: condition || undefined, concentration: concentration && !!sourceId, remaining, tick: d.tick ?? 'start',
    }))
    setName(''); setTargets([]); setCondition(''); setConcentration(false); setOpen(false)
  }

  return (
    <form className="effect-form" onSubmit={submit}>
      <label>{t('combat.effectName')}<input autoFocus required value={effectName} onChange={e => setName(e.target.value)} placeholder={t('combat.effectPh')} /></label>
      <label>{t('combat.castBy')}
        <select value={sourceId} onChange={e => setSource(e.target.value)}>
          <option value="">{t('combat.noSource')}</option>
          {enc.combatants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>{t('combat.targets')}</legend>
        {enc.combatants.map(c => (
          <label key={c.id} className="check">
            <input type="checkbox" checked={targets.includes(c.id)}
              onChange={e => setTargets(e.target.checked ? [...targets, c.id] : targets.filter(t => t !== c.id))} />
            {c.name}
          </label>
        ))}
      </fieldset>
      <label>{t('combat.duration')}
        <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
          {DURATIONS.map((x, i) => <option key={x.label} value={i}>{t(x.label)}</option>)}
        </select>
      </label>
      {d.rounds === -1 && <label>{t('combat.roundsLabel')}<input inputMode="numeric" value={custom} onChange={e => setCustom(e.target.value)} /></label>}
      <label>{t('combat.appliesCondition')}
        <select value={condition} onChange={e => setCondition(e.target.value as ConditionId | '')}>
          <option value="">{t('common.none')}</option>
          {CONDITIONS.map(x => <option key={x} value={x}>{term('condition', x, x)}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={concentration} disabled={!sourceId} onChange={e => setConcentration(e.target.checked)} />
        {t('combat.concentration')}
      </label>
      <div className="row">
        <button className="glass-btn prominent" disabled={!effectName.trim()}>{t('combat.addEffectSubmit')}</button>
        <button type="button" className="glass-btn plain" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

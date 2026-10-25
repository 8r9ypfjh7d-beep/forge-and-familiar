import { useState } from 'react'
import type { ConditionId } from '../../rules/types'
import { addEffect, endEffect } from '../engine'
import { CONDITIONS, type Effect, type Encounter } from '../types'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()

/** SRD durations in rounds (6 seconds each). */
const DURATIONS: { label: string; rounds: number | null; tick?: Effect['tick'] }[] = [
  { label: 'Until the end of its next turn', rounds: 1, tick: 'end' },
  { label: '1 round', rounds: 1 },
  { label: '1 minute (10 rounds)', rounds: 10 },
  { label: '10 minutes', rounds: 100 },
  { label: '1 hour', rounds: 600 },
  { label: 'Until ended', rounds: null },
  { label: 'Custom rounds…', rounds: -1 },
]

/** Active effects with time left, and the form to add one. */
export function Effects({ enc, act }: { enc: Encounter; act: Act }) {
  const name = (id?: string) => enc.combatants.find(c => c.id === id)?.name
  return (
    <section className="panel effects">
      <h3>Spells and effects</h3>
      {enc.effects.length === 0
        ? <p className="muted small">Add a spell or condition with a duration and it ends on its own.</p>
        : (
          <ul className="plain">
            {enc.effects.map(e => (
              <li key={e.id} className="effect">
                <div>
                  <strong>{e.name}</strong>{e.concentration && <span className="tag" title="Concentration">◎</span>}
                  <div className="muted small">
                    {[name(e.sourceId) && `from ${name(e.sourceId)}`, e.targetIds.length > 0 && `on ${e.targetIds.map(name).join(', ')}`,
                      e.condition].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="left">{e.remaining === null ? '∞' : `${e.remaining} rd${e.remaining === 1 ? '' : 's'}`}</span>
                <button className="icon" onClick={() => act(x => endEffect(x, e.id))} aria-label={`End ${e.name}`}>✕</button>
              </li>
            ))}
          </ul>
        )}
      {enc.combatants.length > 0 && <EffectForm enc={enc} act={act} />}
    </section>
  )
}

function EffectForm({ enc, act }: { enc: Encounter; act: Act }) {
  const [open, setOpen] = useState(false)
  const [effectName, setName] = useState('')
  const [sourceId, setSource] = useState(enc.activeId ?? '')
  const [targets, setTargets] = useState<string[]>([])
  const [duration, setDuration] = useState(2)
  const [custom, setCustom] = useState('3')
  const [condition, setCondition] = useState<ConditionId | ''>('')
  const [concentration, setConcentration] = useState(false)

  if (!open) return <button className="btn small" onClick={() => { setSource(enc.activeId ?? ''); setOpen(true) }}>+ Add effect</button>

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
      <label>Name<input autoFocus required value={effectName} onChange={e => setName(e.target.value)} placeholder="Hold Person" /></label>
      <label>Cast by
        <select value={sourceId} onChange={e => setSource(e.target.value)}>
          <option value="">No one (ticks each round)</option>
          {enc.combatants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>Targets</legend>
        {enc.combatants.map(c => (
          <label key={c.id} className="check">
            <input type="checkbox" checked={targets.includes(c.id)}
              onChange={e => setTargets(e.target.checked ? [...targets, c.id] : targets.filter(t => t !== c.id))} />
            {c.name}
          </label>
        ))}
      </fieldset>
      <label>Duration
        <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
          {DURATIONS.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
        </select>
      </label>
      {d.rounds === -1 && <label>Rounds<input inputMode="numeric" value={custom} onChange={e => setCustom(e.target.value)} /></label>}
      <label>Applies condition
        <select value={condition} onChange={e => setCondition(e.target.value as ConditionId | '')}>
          <option value="">None</option>
          {CONDITIONS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={concentration} disabled={!sourceId} onChange={e => setConcentration(e.target.checked)} />
        Concentration
      </label>
      <div className="row">
        <button className="btn primary" disabled={!effectName.trim()}>Add effect</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

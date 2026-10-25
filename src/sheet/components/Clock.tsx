import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { dayOf, minutesToNextDawn, parseDuration, partOfDay, timeOfDay, MINUTES_PER_DAY } from '../clock'
import { clockOf, dawnCounters, setClock } from '../engine'
import type { Apply } from '../types'
import { useAdvanceTime, useDurationText } from '../useAdvanceTime'

const STEPS = [10, 60, 8 * 60]

export function Clock({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const duration = useDurationText()
  const advance = useAdvanceTime(character, apply)
  const [custom, setCustom] = useState('')
  const [editing, setEditing] = useState(false)
  const time = clockOf(character)
  const now = (v: number) => t('clock.now', { day: dayOf(v), time: timeOfDay(v) })
  const toDawn = minutesToNextDawn(time)
  const dawnItems = dawnCounters(character)
  const minutes = parseDuration(custom)

  return (
    <section className="card clock" aria-labelledby="clock-title">
      <div className="card-head">
        <h2 id="clock-title">{t('clock.title')}</h2>
        <button type="button" className="btn ghost small" onClick={() => setEditing(e => !e)} aria-expanded={editing}>
          {editing ? t('clock.done') : t('clock.set')}
        </button>
      </div>
      <p className="clock-now">
        <strong>{now(time)}</strong> <span className="chip">{t(`clock.part.${partOfDay(time)}`)}</span>
      </p>
      <p className="hint">{t('clock.nextDawn', { duration: duration(toDawn) })}</p>

      {editing && <SetClock time={time} onSet={v => apply(t('clock.log.set', { when: now(v) }), c => setClock(c, v))} />}

      <div className="row">
        {STEPS.map(m => (
          <button key={m} type="button" className="btn" onClick={() => advance(m, t('clock.log.passed'))}>
            {t('clock.plus', { duration: duration(m) })}
          </button>
        ))}
        <button type="button" className="btn primary" onClick={() => advance(toDawn, t('clock.log.waited'))}>{t('clock.skipToDawn')}</button>
      </div>
      <form className="inline clock-custom" onSubmit={e => { e.preventDefault(); if (minutes) { advance(minutes, t('clock.log.passed')); setCustom('') } }}>
        <input aria-label={t('clock.customLabel')} placeholder={t('clock.customPlaceholder')} dir="ltr" value={custom} onChange={e => setCustom(e.target.value)} />
        <button type="submit" className="btn ghost" disabled={!minutes}>{t('clock.pass')}</button>
      </form>

      <p className="hint">
        {dawnItems.length
          ? t('clock.dawnItems', { list: dawnItems.map(k => `${k.label} ${k.max - k.used}/${k.max}${k.regain ? ` (+${k.regain})` : ''}`).join(', ') })
          : t('clock.noDawnItems')}
      </p>
    </section>
  )
}

function SetClock({ time, onSet }: { time: number; onSet: (t: number) => void }) {
  const { t } = useI18n()
  const [day, setDay] = useState(String(dayOf(time)))
  const [clock, setClockText] = useState(timeOfDay(time))
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock)
  const d = Number(day)
  const valid = d >= 1 && !!match && Number(match[1]) < 24 && Number(match[2]) < 60
  return (
    <form className="add-counter" onSubmit={e => {
      e.preventDefault()
      if (valid && match) onSet((d - 1) * MINUTES_PER_DAY + Number(match[1]) * 60 + Number(match[2]))
    }}>
      <label>{t('clock.day')}<input value={day} inputMode="numeric" onChange={e => setDay(e.target.value.replace(/\D/g, ''))} /></label>
      <label>{t('clock.time')}<input type="time" value={clock} onChange={e => setClockText(e.target.value)} /></label>
      <div className="row">
        <button type="submit" className="btn primary" disabled={!valid}>{t('clock.setClock')}</button>
      </div>
      <p className="hint">{t('clock.setHint')}</p>
    </form>
  )
}

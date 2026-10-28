import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Party } from '../party/types'
import { bestOption, chosenOption, isFinished, relativeTime, reminderDue, tally, toIcs } from './poll'
import { watchPolls } from './cloud'
import { answer, dropDate, listPolls, lockIn, onSessionsChanged, proposeDate, refreshPolls, startPoll } from './store'
import type { Availability, SessionPoll } from './types'
import './schedule.css'

const NEXT: Record<string, Availability | undefined> = { none: 'yes', yes: 'maybe', maybe: 'no', no: undefined }
const MARK = { yes: '✓', maybe: '?', no: '✗', none: '–' } as const
const LABEL = { yes: 'schedule.answer.yes', maybe: 'schedule.answer.maybe', no: 'schedule.answer.no', none: 'schedule.answer.none' } as const

/** Keeps `now` fresh so countdowns and past dates update while the party view is open. */
function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

/** Pick the next game date with the party: propose dates, mark availability, DM locks one in. */
export function SessionScheduler({ party, userId, nameOf }: { party: Party; userId: string; nameOf: (id: string) => string }) {
  const [poll, setPoll] = useState<SessionPoll | null | undefined>(undefined)
  const now = useNow()
  const { t, locale } = useI18n()
  const [dateFmt, longFmt] = useMemo(() => [
    new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  ], [locale])

  const refresh = useCallback(() => { listPolls(party.id).then(list => setPoll(list[0] ?? null)) }, [party.id])
  useEffect(() => { refresh(); return onSessionsChanged(refresh) }, [refresh])
  // Cloud party: fetch now and on every change from another device.
  useEffect(() => {
    const pull = () => { void refreshPolls(party.id) }
    pull()
    return watchPolls(party.id, pull)
  }, [party.id])

  if (poll === undefined) return null
  const isDm = userId === party.dmId

  if (!poll || isFinished(poll, now)) {
    const last = poll && chosenOption(poll)
    return (
      <section className="panel ff-schedule" aria-labelledby="schedule-title">
        <div className="sched-head">
          <h3 id="schedule-title">{t('schedule.title')}</h3>
          <button className="btn primary small" onClick={() => startPoll(party.id, userId)}>{t('schedule.plan')}</button>
        </div>
        <p className="muted small">
          {last && `${t('schedule.lastPlayed', { date: longFmt.format(new Date(last.startsAt)) })} `}
          {t('schedule.help')}
        </p>
      </section>
    )
  }

  const chosen = chosenOption(poll)
  if (chosen) {
    const start = new Date(chosen.startsAt)
    const soon = reminderDue(poll, now)
    const when = relativeTime(start, now, locale)
    return (
      <section className={`panel ff-schedule locked ${soon ? 'soon' : ''}`} aria-labelledby="schedule-title">
        <div className="sched-head">
          <h3 id="schedule-title">{t('schedule.title')}</h3>
          {isDm && <button className="btn ghost small" onClick={() => lockIn(poll.id, undefined)}>{t('schedule.changeDate')}</button>}
        </div>
        <p className="when">{longFmt.format(start)}</p>
        <p className={soon ? 'strong' : 'muted'} role={soon ? 'status' : undefined}>
          {!when ? t('schedule.underway') : soon ? t('schedule.reminder', { when }) : t('schedule.starts', { when })}
        </p>
        <button className="btn small" onClick={() => downloadIcs(poll, party.name, now)}>{t('schedule.addCalendar')}</button>
        <p className="muted small">{t('schedule.calendarHelp')}</p>
      </section>
    )
  }

  const memberIds = party.members.map(m => m.userId)
  const tallies = tally(poll, memberIds, now)
  const best = bestOption(tallies)

  return (
    <section className="panel ff-schedule" aria-labelledby="schedule-title">
      <div className="sched-head">
        <h3 id="schedule-title">{t('schedule.pickTitle')}</h3>
        {best && <span className="small muted">{t('schedule.best')} <strong>{dateFmt.format(new Date(best.option.startsAt))}</strong></span>}
      </div>

      {tallies.length === 0
        ? <p className="muted small">{t('schedule.noDates')}</p>
        : (
          <div className="sched-scroll">
            <table className="sched-table">
              <thead>
                <tr>
                  <th scope="col">{t('schedule.date')}</th>
                  {memberIds.map(id => <th key={id} scope="col" className={id === userId ? 'me' : 'other'}>{id === userId ? t('schedule.you') : nameOf(id)}</th>)}
                  <th scope="col">{t('schedule.free')}</th>
                  <th scope="col"><span className="sr-only">{t('schedule.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {tallies.map(row => {
                  const o = row.option
                  const date = dateFmt.format(new Date(o.startsAt))
                  return (
                    <tr key={o.id} className={`${row.past ? 'past' : ''} ${best?.option.id === o.id ? 'best' : ''}`}>
                      <th scope="row">{date}{row.past && <span className="muted small"> {t('schedule.passed')}</span>}</th>
                      {memberIds.map(id => {
                        const a = poll.votes[id]?.[o.id] ?? 'none'
                        if (id !== userId) {
                          return <td key={id} className={`ans other ${a}`} title={`${nameOf(id)}: ${t(LABEL[a])}`}><span aria-label={t(LABEL[a])}>{MARK[a]}</span></td>
                        }
                        return (
                          <td key={id} className="me">
                            <button className={`ans-btn ${a}`} disabled={row.past}
                              onClick={() => answer(poll.id, userId, o.id, NEXT[a])}
                              aria-label={t('schedule.cellAria', { date, answer: t(LABEL[a]) })}>
                              {MARK[a]}
                            </button>
                          </td>
                        )
                      })}
                      <td className="count">{row.yes}<span className="muted">/{memberIds.length}</span>{row.maybe > 0 && <span className="muted small"> +{row.maybe}?</span>}</td>
                      <td className="acts">
                        {isDm && !row.past && <button className="btn primary small" onClick={() => lockIn(poll.id, o.id)}>{t('schedule.lockIn')}</button>}
                        {(isDm || o.proposedBy === userId) && (
                          <button className="btn ghost small" onClick={() => dropDate(poll.id, o.id)} aria-label={t('schedule.remove', { date })}>✕</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      <p className="muted small">{t('schedule.tapHelp')}{!isDm && ` ${t('schedule.dmLocks')}`}</p>
      <ProposeForm onPropose={d => proposeDate(poll.id, userId, d)} now={now} />
    </section>
  )
}

function ProposeForm({ onPropose, now }: { onPropose: (d: Date) => void; now: Date }) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const date = value ? new Date(value) : null
  const valid = !!date && !Number.isNaN(date.getTime()) && date > now
  return (
    <form className="row propose" onSubmit={e => { e.preventDefault(); if (valid) { onPropose(date!); setValue('') } }}>
      <label className="small strong" htmlFor="propose-date">{t('schedule.suggest')}</label>
      <input id="propose-date" type="datetime-local" dir="ltr" value={value} min={toLocalInput(now)} onChange={e => setValue(e.target.value)} />
      <button className="btn small" disabled={!valid}>{t('common.add')}</button>
    </form>
  )
}

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function downloadIcs(poll: SessionPoll, partyName: string, now: Date) {
  const ics = toIcs(poll, partyName, now)
  if (!ics) return
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${partyName.replace(/[^\w-]+/g, '-').toLowerCase() || 'session'}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

import { useEffect, useState } from 'react'
import { RollView, useDice } from '../dice/ui'
import { useI18n } from '../i18n'
import { mergePartyRolls, onMemberRollsChanged, readMemberRolls, type FeedEntry } from './feed'
import type { Party } from './types'


/** Live feed of the party's rolls. Updates when anyone rolls, here or in another tab. */
export function RollFeed({ party, nameOf }: { party: Party; nameOf: (userId: string) => string }) {
  const { history } = useDice()
  const { t } = useI18n()
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const load = () => {
      setFeed(mergePartyRolls(party, Object.fromEntries(party.members.map(m => [m.userId, readMemberRolls(m.userId)]))))
      setNow(Date.now())
    }
    load()
    const offOther = onMemberRollsChanged(load)
    const offMine = history.subscribe(load)
    return () => { offOther(); offMine() }
  }, [party, history])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  const ago = (iso: string) => {
    const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
    if (s < 10) return t('party.rolls.justNow')
    if (s < 60) return t('party.rolls.secondsAgo', { count: s })
    if (s < 3600) return t('party.rolls.minutesAgo', { count: Math.floor(s / 60) })
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <section className="panel roll-feed" aria-label={t('party.rolls.title')}>
      <h3>{t('party.rolls.title')}</h3>
      {feed.length === 0
        ? <p className="muted small">{t('party.rolls.empty')}</p>
        : (
          <ol aria-live="polite">
            {feed.map(({ roll, userId }, i) => (
              <li key={roll.id} className={i === 0 ? 'latest' : ''}>
                <div className="feed-meta small muted">
                  <span>{nameOf(userId)}</span>
                  <time dateTime={roll.timestamp}>{ago(roll.timestamp)}</time>
                </div>
                <RollView roll={roll} compact={i > 0} />
              </li>
            ))}
          </ol>
        )}
    </section>
  )
}

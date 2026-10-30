import { useEffect, useState } from 'react'
import { groupByAction, type RollResult } from '../dice'
import { RollGroupView, useDice } from '../dice/ui'
import { useI18n } from '../i18n'
import { fetchPartyRolls, sendRoll, watchPartyRolls } from './cloud'
import { mergePartyRolls, mergeRollLists, onMemberRollsChanged, readMemberRolls, type FeedEntry } from './feed'
import type { Party } from './types'

/**
 * Mounted once in the app: sends each new sheet roll to the cloud right away, so party members see
 * it in their feed within a second instead of at the next cloud sync.
 */
export function PartyRollRelay({ userId }: { userId: string }) {
  const { history } = useDice()
  useEffect(() => {
    let newest = history.all()[0]?.id
    return history.subscribe(() => {
      const latest = history.all()[0]
      if (!latest || latest.id === newest) return
      newest = latest.id
      if (!('secret' in latest && latest.secret)) void sendRoll(userId, latest).catch(() => {})
    })
  }, [history, userId])
  return null
}

/** Live feed of the party's rolls. Updates when anyone rolls: here, in another tab, or on another device. */
export function RollFeed({ party, nameOf }: { party: Party; nameOf: (userId: string) => string }) {
  const { history } = useDice()
  const { t } = useI18n()
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let live = true
    // Rolls from other devices come from the cloud; this device's own history fills in the rest.
    let remote: Record<string, RollResult[]> = {}
    const show = () => {
      if (!live) return
      setFeed(mergePartyRolls(party, Object.fromEntries(party.members.map(m =>
        [m.userId, mergeRollLists(readMemberRolls(m.userId), remote[m.userId] ?? [])]))))
      setNow(Date.now())
    }
    const fetchRemote = () => fetchPartyRolls(party.members.map(m => m.userId)).then(r => { remote = r; show() })
    show()
    fetchRemote()
    const offOther = onMemberRollsChanged(show)
    const offMine = history.subscribe(show)
    const offCloud = watchPartyRolls(fetchRemote)
    return () => { live = false; offOther(); offMine(); offCloud() }
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
    <section className="glass roll-feed" aria-label={t('party.rolls.title')}>
      <h3>{t('party.rolls.title')}</h3>
      {feed.length === 0
        ? <p className="muted small">{t('party.rolls.empty')}</p>
        : (
          <ol aria-live="polite">
            {groupByAction(feed, f => f.roll, (a, b) => a.userId === b.userId).map((group, i) => {
              const { roll, userId } = group[group.length - 1]
              return (
              <li key={group[0].roll.id} className={i === 0 ? 'latest' : ''}>
                <div className="feed-meta small muted">
                  <span>{nameOf(userId)}</span>
                  <time dateTime={roll.timestamp}>{ago(roll.timestamp)}</time>
                </div>
                <RollGroupView rolls={group.map(f => f.roll)} compact={i > 0} />
              </li>
              )
            })}
          </ol>
        )}
    </section>
  )
}

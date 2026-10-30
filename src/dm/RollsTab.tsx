// Rolls tab on the DM screen: every player's rolls, public and secret, with player and kind filters (live data: useDmRolls.ts).
import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { groupByAction } from '../dice'
import { clearSharedSecretRolls } from '../dice/secretCloud'
import { RollGroupView } from '../dice/ui'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { fetchAccountNames } from '../party/cloud'
import type { Party } from '../party/types'
import { listProfiles } from '../storage'
import { filterRolls, playerSummary, ROLL_KINDS, type DmRollEntry, type RollKind } from './rolls'

const KIND_KEYS: Record<RollKind, MessageKey> = {
  all: 'dm.rolls.kind.all', attacks: 'dm.rolls.kind.attacks', checks: 'dm.rolls.kind.checks', saves: 'dm.rolls.kind.saves', secret: 'dm.rolls.kind.secret',
}

/** Display names for players: profiles on this device first, then the server's account names. */
function usePlayerNames(): (userId: string) => string {
  const { t } = useI18n()
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let live = true
    listProfiles().then(ps => { if (live) setNames(n => ({ ...Object.fromEntries(ps.map(p => [p.id, p.displayName])), ...n })) })
    fetchAccountNames().then(a => { if (live) setNames(n => ({ ...a, ...n })) }).catch(() => {})
    return () => { live = false }
  }, [])
  return id => names[id] ?? t('party.unknownPlayer')
}

export function RollsTab({ party, entries }: { party?: Party; entries: readonly DmRollEntry[] }) {
  const { t } = useI18n()
  const nameOf = usePlayerNames()
  const [player, setPlayer] = useState<string | null>(null)
  const [kind, setKind] = useState<RollKind>('all')
  const [askClear, setAskClear] = useState(false)
  // The clock behind the "ago" times: ticks every 15 s and whenever the log changes.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { const id = setTimeout(() => setNow(Date.now()), 0); return () => clearTimeout(id) }, [entries])

  const summary = useMemo(() => (party ? playerSummary(party, entries) : []), [party, entries])
  const shown = useMemo(() => filterRolls(entries, { userId: player, kind }), [entries, player, kind])
  const secretCount = entries.filter(e => e.secret).length

  if (!party) return <p className="hint">{t('dm.rolls.noParty')}</p>

  const ago = (iso: string) => {
    const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
    if (s < 10) return t('party.rolls.justNow')
    if (s < 60) return t('party.rolls.secondsAgo', { count: s })
    if (s < 3600) return t('party.rolls.minutesAgo', { count: Math.floor(s / 60) })
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <section className="dm-rolls" aria-label={t('dm.tab.rolls')}>
      <div className="dm-rolls__players" role="group" aria-label={t('dm.rolls.players')}>
        <button type="button" className={`glass-chip${player === null ? ' on' : ''}`} aria-pressed={player === null} onClick={() => setPlayer(null)}>
          {t('dm.rolls.everyone')}
        </button>
        {summary.map(p => (
          <button key={p.userId} type="button" className={`glass-chip dm-rolls__player${player === p.userId ? ' on' : ''}`}
            aria-pressed={player === p.userId} onClick={() => setPlayer(player === p.userId ? null : p.userId)}>
            <span className="dm-rolls__name">{nameOf(p.userId)}</span>
            <span className="dm-rolls__stat">
              {p.count === 0 ? t('dm.rolls.noRolls') : `${t('dm.rolls.count', { count: p.count })} · ${ago(p.lastAt!)}`}
              {p.crits > 0 && <span className="dm-rolls__crit" title={t('dm.rolls.crits', { count: p.crits })}>{'★'}{p.crits}</span>}
              {p.fumbles > 0 && <span className="dm-rolls__fumble" title={t('dm.rolls.fumbles', { count: p.fumbles })}>{'☠'}{p.fumbles}</span>}
            </span>
          </button>
        ))}
      </div>
      <div className="row spread dm-rolls__bar">
        <div className="glass-segmented dm-rolls__kinds" role="radiogroup" aria-label={t('dm.rolls.kinds')}>
          {ROLL_KINDS.map(k => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
              {t(KIND_KEYS[k])}{k === 'secret' && secretCount > 0 ? ` ${secretCount}` : ''}
            </button>
          ))}
        </div>
        {secretCount > 0 && (
          <button type="button" className="btn ghost small" onClick={() => setAskClear(true)}>{t('dm.rolls.clearSecret')}</button>
        )}
      </div>
      <p className="hint dm-rolls__hint">{t('dm.rolls.hint')}</p>
      {entries.length === 0
        ? <p className="muted small">{t('dm.rolls.empty')}</p>
        : shown.length === 0
          ? <p className="muted small">{t('dm.rolls.none')}</p>
          : (
            <ol className="dm-rolls__list" aria-live="polite">
              {groupByAction(shown, e => e.roll, (a, b) => a.userId === b.userId && a.secret === b.secret).map((group, i) => {
                const { roll, userId, secret } = group[group.length - 1]
                return (
                  <li key={group[0].roll.id} className={`${i === 0 ? 'latest' : ''}${secret ? ' secret' : ''}`}>
                    <div className="dm-rolls__meta small muted">
                      <span>
                        {nameOf(userId)}
                        {secret && <span className="dm-rolls__tag"><span aria-hidden>🔒</span> {t('dm.rolls.secretTag')}</span>}
                      </span>
                      <time dateTime={roll.timestamp}>{ago(roll.timestamp)}</time>
                    </div>
                    <RollGroupView rolls={group.map(e => e.roll)} compact={i > 0} />
                  </li>
                )
              })}
            </ol>
          )}
      <ConfirmDialog open={askClear} title={t('dm.rolls.clearSecretAsk')} yes={t('dm.rolls.clearSecret')}
        onYes={() => { void clearSharedSecretRolls(party.id).catch(() => {}) }} onClose={() => setAskClear(false)} />
    </section>
  )
}

// Small cloud status chip for the top bar. Hidden while sync is off (no account or no server).
import { useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { getSyncStatus, onSyncStatus } from './runner'
import './sync.css'

/** `compact`: only a dot, and only when something is wrong (offline or failed), for the menu button. */
/** `local`: say "This device only" while sync is off, instead of showing nothing (the player menu's status line). */
export function SyncBadge({ compact = false, local = false }: { compact?: boolean; local?: boolean }) {
  const { t } = useI18n()
  const s = useSyncExternalStore(onSyncStatus, getSyncStatus)
  if (s.state === 'off') return local ? <span className="sync-badge sync-off" role="status"><span className="sync-dot" aria-hidden="true" />{t('sync.off')}</span> : null
  const label = s.state === 'idle' && s.pending ? t('sync.pending', { count: s.pending }) : t(`sync.${s.state}`)
  if (compact) {
    if (s.state !== 'offline' && s.state !== 'error') return null
    return <span className={`sync-badge sync-${s.state}`} title={label} role="img" aria-label={label}><span className="sync-dot" /></span>
  }
  return (
    <span className={`sync-badge sync-${s.state}`} title={t('sync.title')} role="status">
      <span className="sync-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

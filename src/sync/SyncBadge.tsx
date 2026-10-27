// Small cloud status chip for the top bar. Hidden while sync is off (no account or no server).
import { useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { getSyncStatus, onSyncStatus } from './runner'
import './sync.css'

export function SyncBadge() {
  const { t } = useI18n()
  const s = useSyncExternalStore(onSyncStatus, getSyncStatus)
  if (s.state === 'off') return null
  const label = s.state === 'idle' && s.pending ? t('sync.pending', { count: s.pending }) : t(`sync.${s.state}`)
  return (
    <span className={`sync-badge sync-${s.state}`} title={t('sync.title')} role="status">
      <span className="sync-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

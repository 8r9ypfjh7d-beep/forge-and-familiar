import { useEffect, useState } from 'react'
import { AccessibilityButton } from '../a11y/ui'
import { getCloudStatus, onCloudChanged } from '../cloud'
import { LanguagePicker, useI18n } from '../i18n'
import { activate, activateErrorKey } from './session'
import type { ActivateError } from './types'
import './accounts.css'

/** Front door on a new device: a personal activation code, or a local-only profile. */
export function ActivateScreen({ onLocal }: { onLocal: (name: string) => void }) {
  const { t } = useI18n()
  const [local, setLocal] = useState(false)
  const [name, setName] = useState('')
  return (
    <main className="welcome">
      <div className="welcome-card glass thick">
        <div className="row welcome-lang"><AccessibilityButton /><LanguagePicker /></div>
        <div className="welcome-mark" aria-hidden="true"><D20Icon /></div>
        <h1 className="glass-title">Forge &amp; Familiar</h1>
        {local ? (
          <>
            <p className="welcome-lead">{t('app.tagline')}</p>
            <form onSubmit={e => { e.preventDefault(); if (name.trim()) onLocal(name.trim()) }} className="code-form">
              <input className="glass-field" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t('app.yourName')} aria-label={t('app.yourName')} />
              <button className="glass-btn prominent" disabled={!name.trim()}>{t('app.start')}</button>
            </form>
            <button className="glass-btn small welcome-alt" onClick={() => setLocal(false)}>{t('account.haveCode')}</button>
          </>
        ) : (
          <>
            <p className="welcome-lead">{t('account.intro')}</p>
            <CodeForm />
            <button className="glass-btn small welcome-alt" onClick={() => setLocal(true)}>{t('account.noCode')}</button>
          </>
        )}
      </div>
    </main>
  )
}

/** The app's mark on the welcome card: a d20 outline. */
function D20Icon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 2.5 20.5 7.4v9.2L12 21.5l-8.5-4.9V7.4Z" />
      <path d="M12 2.5 7.6 9.8h8.8Zm-4.4 7.3L12 17l4.4-7.2M3.5 7.4l4.1 2.4m12.9-2.4-4.1 2.4M12 17v4.5M3.5 16.6 12 17l8.5-.4" />
    </svg>
  )
}

/** Cloud with an up arrow, for the Turn on sync card. */
function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.2 4.7 4.7 0 0 0 7 18.5Z" />
      <path d="M12 15.5v-5m-2.2 2.1L12 10.4l2.2 2.2" />
    </svg>
  )
}

/** Code input. On success the session event makes the app switch to the account. */
export function CodeForm({ onDone, autoFocus = true }: { onDone?: () => void; autoFocus?: boolean }) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [error, setError] = useState<ActivateError | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="code-form"
      onSubmit={async e => {
        e.preventDefault()
        setBusy(true)
        const s = await activate(code)
        setBusy(false)
        setError(typeof s === 'string' ? s : null)
        if (typeof s !== 'string') onDone?.()
      }}
    >
      <input
        className="glass-field" autoFocus={autoFocus} dir="ltr" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false}
        onChange={e => { setCode(e.target.value); setError(null) }}
        placeholder={t('account.codePlaceholder')} aria-label={t('account.code')}
        aria-invalid={!!error} aria-describedby={error ? 'code-error' : undefined}
      />
      <button className="glass-btn prominent" disabled={!code.trim() || busy}>{t('account.activate')}</button>
      {error && <p id="code-error" className="code-error" role="alert">{t(activateErrorKey(error))}</p>}
    </form>
  )
}

/** Marks the DM of the party in play in the top bar. Players need no badge. */
export function AccountBadge({ dm }: { dm: boolean }) {
  const { t } = useI18n()
  if (!dm) return null
  return <span className="account-badge small" title={t('account.dmTitle')}>{t('account.dmBadge')}</span>
}

const LATER_KEY = 'ff.cloudLinkLater'
const LATER_DAYS = 30

/** Whether "Not now" (tapped at `since`, ms) still hides the sync banner at `now`. */
export const cloudLinkSnoozed = (since: number | null, now = Date.now()) =>
  since !== null && Number.isFinite(since) && now - since < LATER_DAYS * 86_400_000 && now >= since

function readLater(): boolean {
  try { const v = localStorage.getItem(LATER_KEY); return cloudLinkSnoozed(v === null ? null : Number(v)) } catch { return false }
}

/**
 * Shown to an account activated before the server existed: one more code entry links this
 * device to the cloud, so its characters sync. Hides itself once linked. "Not now" hides it for
 * 30 days on this device; the player menu's "Enter activation code" still links it any time.
 */
export function CloudLinkNotice() {
  const { t } = useI18n()
  const [status, setStatus] = useState(getCloudStatus)
  const [later, setLaterState] = useState(readLater)
  const setLater = (v: boolean) => {
    try { localStorage.setItem(LATER_KEY, String(Date.now())) } catch { /* private mode: hide for this visit only */ }
    setLaterState(v)
  }
  useEffect(() => onCloudChanged(() => setStatus(getCloudStatus())), [])
  if (status !== 'unlinked' || later) return null
  return (
    <section className="cloud-link glass thick" aria-labelledby="cloud-link-title">
      <div className="cloud-link-icon" aria-hidden="true"><SyncIcon /></div>
      <div className="cloud-link-body">
        <h2 id="cloud-link-title">{t('account.cloudLinkTitle')}</h2>
        <p>{t('account.cloudLinkBody')}</p>
        <CodeForm autoFocus={false} />
        <button className="glass-btn small cloud-link-later" onClick={() => setLater(true)}>{t('account.cloudLinkLater')}</button>
      </div>
    </section>
  )
}

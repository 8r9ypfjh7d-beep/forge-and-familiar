import { useState } from 'react'
import { AccessibilityButton } from '../a11y/ui'
import { LanguagePicker, useI18n } from '../i18n'
import { activate, activateErrorKey } from './session'
import type { ActivateError, Session } from './types'
import './accounts.css'

/** Front door on a new device: a personal activation code, or a local-only profile. */
export function ActivateScreen({ onLocal }: { onLocal: (name: string) => void }) {
  const { t } = useI18n()
  const [local, setLocal] = useState(false)
  const [name, setName] = useState('')
  return (
    <main className="welcome panel">
      <div className="row welcome-lang"><AccessibilityButton /><LanguagePicker /></div>
      <h1>Forge &amp; Familiar</h1>
      {local ? (
        <>
          <p>{t('app.tagline')}</p>
          <form onSubmit={e => { e.preventDefault(); if (name.trim()) onLocal(name.trim()) }} className="row">
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t('app.yourName')} aria-label={t('app.yourName')} />
            <button className="btn primary" disabled={!name.trim()}>{t('app.start')}</button>
          </form>
          <button className="btn ghost small" onClick={() => setLocal(false)}>{t('account.haveCode')}</button>
        </>
      ) : (
        <>
          <p>{t('account.intro')}</p>
          <CodeForm />
          <button className="btn ghost small" onClick={() => setLocal(true)}>{t('account.noCode')}</button>
        </>
      )}
    </main>
  )
}

/** Code input. On success the session event makes the app switch to the account. */
export function CodeForm({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [error, setError] = useState<ActivateError | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="row"
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
        autoFocus dir="ltr" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false}
        onChange={e => { setCode(e.target.value); setError(null) }}
        placeholder={t('account.codePlaceholder')} aria-label={t('account.code')}
        aria-invalid={!!error} aria-describedby={error ? 'code-error' : undefined}
      />
      <button className="btn primary" disabled={!code.trim() || busy}>{t('account.activate')}</button>
      {error && <p id="code-error" className="bad small" role="alert">{t(activateErrorKey(error))}</p>}
    </form>
  )
}

/** Marks the DM's account in the top bar. Players' accounts need no badge. */
export function AccountBadge({ session }: { session: Session }) {
  const { t } = useI18n()
  if (session.role !== 'dm') return null
  return <span className="account-badge small" title={t('account.dmTitle')}>{t('account.dmBadge')}</span>
}

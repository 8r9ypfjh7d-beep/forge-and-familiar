// The top of the player menu: who is playing and whether their characters sync, the other players on
// this device as rows, and the account actions as plain buttons (never hidden inside a select).
import { useState } from 'react'
import { openActivationPrompt, signOut } from '../accounts'
import { PromptDialog, useConfirm } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n'
import type { UserProfile } from '../model/character'
import { SyncBadge } from '../sync'

export function PlayerPanel({ profiles, active, onSwitch, onAdd, signedIn, close }: {
  profiles: UserProfile[]
  active: UserProfile
  onSwitch: (id: string) => void
  onAdd: (name: string) => void
  /** This device is signed in to the open profile's account: offer "Sign out of this device". */
  signedIn: boolean
  close: () => void
}) {
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)
  const [confirm, confirmDialog] = useConfirm()
  const others = profiles.length > 1
  return (
    <div className="nav-account">
      <div className="nav-who">
        <span className="nav-avatar" aria-hidden="true">{active.displayName.slice(0, 1).toUpperCase()}</span>
        <span className="nav-who-text">
          <strong>{active.displayName}</strong>
          <SyncBadge local />
        </span>
      </div>
      {others && (
        <div className="nav-profiles" role="group" aria-label={t('app.player')}>
          {profiles.map(p => (
            <button key={p.id} type="button" className={`nav-item ${p.id === active.id ? 'on' : ''}`} aria-pressed={p.id === active.id}
              onClick={() => { close(); if (p.id !== active.id) onSwitch(p.id) }}>
              <span className="nav-check" aria-hidden="true">{p.id === active.id ? '✓' : ''}</span>{p.displayName}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="nav-item" onClick={() => setAdding(true)}>
        <span className="nav-check" aria-hidden="true">+</span>{t('nav.addPlayer')}
      </button>
      <button type="button" className="nav-item" onClick={() => { close(); openActivationPrompt() }}>
        <span className="nav-check" aria-hidden="true">#</span>{t('nav.enterCode')}
      </button>
      {signedIn && (
        <button type="button" className="nav-item nav-signout" onClick={() => confirm({
          title: t('nav.signOutAsk'), body: t('nav.signOutBody'), yes: t('nav.signOut'),
          onYes: () => { close(); void signOut() },
        })}>
          <span className="nav-check" aria-hidden="true">⎋</span>{t('nav.signOut')}
        </button>
      )}
      <PromptDialog open={adding} title={t('app.newPlayerPrompt')} yes={t('app.addPlayerYes')} onClose={() => setAdding(false)}
        onSubmit={name => { onAdd(name); close() }} />
      {confirmDialog}
    </div>
  )
}

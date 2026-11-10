import { useEffect, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { applyUpdate, canInstall, hasUpdate, promptInstall, subscribePwa } from './register'
import './pwa.css'

/** True while the browser reports no connection and the player has not dismissed the notice. */
function useOfflineNotice(): [boolean, () => void] {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return [offline, () => setOffline(false)]
}

const HIDE_KEY = 'ff.pwa.hideInstall'
const readHidden = () => { try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false } }

/** Floating strip for app-level notices: offline and new version ready. Renders nothing when there is nothing to say.
 *  Install is offered on Home (InstallCard) and in the player menu (InstallMenuItem), never over the sign-in screen. */
export function PwaPrompt() {
  const { t } = useI18n()
  const update = useSyncExternalStore(subscribePwa, hasUpdate)
  const [offline, dismissOffline] = useOfflineNotice()
  if (!offline && !update) return null

  return (
    <div className="ff-pwa" role="status" aria-live="polite">
      {offline && (
        <span className="ff-pwa-row">
          <span className="ff-pwa-note">{t('pwa.offline')}</span>
          <button className="btn ghost" onClick={dismissOffline}>{t('pwa.ok')}</button>
        </span>
      )}
      {update && (
        <span className="ff-pwa-row">
          <span className="ff-pwa-note">{t('pwa.update')}</span>
          <button className="btn primary" onClick={applyUpdate}>{t('pwa.reload')}</button>
        </span>
      )}
    </div>
  )
}

/** A card in the page flow offering to install the app, once the player has a character. "Not now" hides it for good;
 *  the player menu keeps an Install app row. */
export function InstallCard() {
  const { t } = useI18n()
  const install = useSyncExternalStore(subscribePwa, canInstall)
  const [hidden, setHidden] = useState(readHidden)
  if (!install || hidden) return null
  return (
    <div className="glass ff-install-card" role="region" aria-label={t('pwa.installApp')}>
      <span className="ff-pwa-note">{t('pwa.install')}</span>
      <span className="ff-pwa-row">
        <button className="glass-btn small prominent" onClick={() => void promptInstall()}>{t('pwa.installBtn')}</button>
        <button className="glass-btn small" onClick={() => { try { localStorage.setItem(HIDE_KEY, '1') } catch { /* hide for this visit */ } setHidden(true) }}>
          {t('pwa.notNow')}
        </button>
      </span>
    </div>
  )
}

/** "Install app" row for the player menu; shown while the browser offers installing. */
export function InstallMenuItem({ className = 'nav-item' }: { className?: string }) {
  const { t } = useI18n()
  const install = useSyncExternalStore(subscribePwa, canInstall)
  if (!install) return null
  return <button type="button" className={className} onClick={() => void promptInstall()}>{t('pwa.installApp')}</button>
}

import { useEffect, useState, useSyncExternalStore } from 'react'
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

/** Floating strip for app-level notices: offline, new version ready, install. Renders nothing when there is nothing to say. */
export function PwaPrompt() {
  const update = useSyncExternalStore(subscribePwa, hasUpdate)
  const install = useSyncExternalStore(subscribePwa, canInstall)
  const [offline, dismissOffline] = useOfflineNotice()
  const [hideInstall, setHideInstall] = useState(() => localStorage.getItem('ff.pwa.hideInstall') === '1')

  const showInstall = install && !hideInstall && !update
  if (!offline && !update && !showInstall) return null

  return (
    <div className="ff-pwa" role="status" aria-live="polite">
      {offline && (
        <span className="ff-pwa-row">
          <span className="ff-pwa-note">You're offline. Everything still works, and your characters are saved on this device.</span>
          <button className="btn ghost" onClick={dismissOffline}>OK</button>
        </span>
      )}
      {update && (
        <span className="ff-pwa-row">
          <span className="ff-pwa-note">A new version is ready.</span>
          <button className="btn primary" onClick={applyUpdate}>Reload</button>
        </span>
      )}
      {showInstall && (
        <span className="ff-pwa-row">
          <span className="ff-pwa-note">Install Forge &amp; Familiar for quick, offline access.</span>
          <button className="btn primary" onClick={() => void promptInstall()}>Install</button>
          <button
            className="btn ghost"
            onClick={() => {
              localStorage.setItem('ff.pwa.hideInstall', '1')
              setHideInstall(true)
            }}
          >
            Not now
          </button>
        </span>
      )}
    </div>
  )
}

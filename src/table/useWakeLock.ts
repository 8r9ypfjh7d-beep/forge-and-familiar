import { useEffect, useState } from 'react'

export type WakeLockStatus = 'on' | 'off' | 'unsupported'

/**
 * Keeps the screen awake while mounted. The browser drops the lock whenever
 * the tab is hidden, so it is asked for again each time the tab comes back.
 */
export function useWakeLock(): WakeLockStatus {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [status, setStatus] = useState<WakeLockStatus>(supported ? 'off' : 'unsupported')

  useEffect(() => {
    if (!supported) return
    let lock: WakeLockSentinel | null = null
    let live = true
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (!live) { lock.release(); return }
        setStatus('on')
        lock.addEventListener('release', () => { if (live) setStatus('off') })
      } catch {
        // Denied (battery saver, no user gesture yet): the screen may sleep.
        setStatus('off')
      }
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', acquire)
      lock?.release()
    }
  }, [supported])

  return status
}

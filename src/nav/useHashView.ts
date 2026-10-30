import { useCallback, useEffect, useState } from 'react'
import { hashToView, viewToHash, type View } from './route'

/** The screen in the address bar. `go` adds a history entry (or replaces it), so the back gesture walks the app's screens. */
export function useHashView(): [View, (v: View, replace?: boolean) => void] {
  const [view, setView] = useState<View>(() => hashToView(location.hash))
  useEffect(() => {
    const sync = () => {
      const next = hashToView(location.hash)
      setView(v => (JSON.stringify(v) === JSON.stringify(next) ? v : next))
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])
  const go = useCallback((v: View, replace = false) => {
    const hash = viewToHash(v)
    if (viewToHash(hashToView(location.hash)) !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash)
    setView(v)
  }, [])
  return [view, go]
}

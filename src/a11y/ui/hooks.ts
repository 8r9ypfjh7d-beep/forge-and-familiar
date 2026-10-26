import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { shortcutKey } from '../keyboard'
import { getSettings, subscribe } from '../settings'

export function useA11ySettings() {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}

/**
 * Moves focus to the first heading inside the returned ref whenever `key` changes,
 * so keyboard and screen reader users land on the new screen instead of the old button.
 */
export function useFocusOnChange<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    // Wait a frame: screens like the sheet load their content after the first render.
    const id = requestAnimationFrame(() => {
      const root = ref.current
      if (!root) return
      const target = root.querySelector<HTMLElement>('h1, h2') ?? root
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: false })
    })
    return () => cancelAnimationFrame(id)
  }, [key])
  return ref
}

/** Bare-key shortcuts, active only while the shortcuts setting is on and nobody is typing. */
export function useShortcuts(map: Record<string, () => void>) {
  const { shortcuts } = useA11ySettings()
  const latest = useRef(map)
  useLayoutEffect(() => { latest.current = map })
  useEffect(() => {
    if (!shortcuts) return
    const onKey = (e: KeyboardEvent) => {
      const key = shortcutKey(e)
      if (key === null || document.querySelector('dialog[open]')) return
      const fn = latest.current[key]
      if (fn) { e.preventDefault(); fn() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [shortcuts])
}

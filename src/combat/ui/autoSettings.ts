// The DM's automation switches for the tracker, kept on this device (ff.combatAuto.v1) for every fight.
import { useCallback, useState } from 'react'
import { DEFAULT_AUTO, type AutoSettings } from '../auto'

const KEY = 'ff.combatAuto.v1'

export function loadAuto(): AutoSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return { ...DEFAULT_AUTO, ...(raw ? (JSON.parse(raw) as Partial<AutoSettings>) : {}) }
  } catch {
    return DEFAULT_AUTO
  }
}

export function useAutoSettings(): [AutoSettings, (patch: Partial<AutoSettings>) => void] {
  const [auto, setAuto] = useState(loadAuto)
  const update = useCallback((patch: Partial<AutoSettings>) => {
    setAuto(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage blocked: this visit only */ }
      return next
    })
  }, [])
  return [auto, update]
}

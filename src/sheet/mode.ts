// Story and combat modes: which sheet sections show, and in what order.
// Pure layout plus a small per-character preference kept on this device (not on Character).
import { useCallback, useState } from 'react'

export type SheetMode = 'story' | 'combat'

export type SheetSection =
  | 'quickcast' | 'identity' | 'social' | 'notes' | 'inspiration'
  | 'hp' | 'death' | 'rests' | 'clock' | 'exhaustion' | 'stats'
  | 'turn' | 'reactions' | 'slots' | 'resources' | 'supplies' | 'history'

export interface SheetLayout {
  /** Full-width strip above the columns. */
  top: SheetSection[]
  columns: [SheetSection[], SheetSection[]]
}

/**
 * Story mode leads with who the character is (background, social skills, notes) and keeps
 * HP close by. Combat mode leads with HP, the turn, attacks and what can be spent.
 * A character at 0 HP gets HP and death saves first in either mode.
 */
export function sheetLayout(mode: SheetMode, { dying }: { dying: boolean }): SheetLayout {
  if (mode === 'combat') {
    return {
      top: ['quickcast'],
      columns: [
        ['hp', ...(dying ? ['death' as const] : []), 'turn', 'stats'],
        ['slots', 'resources', 'reactions', 'supplies', 'exhaustion', 'rests', 'history'],
      ],
    }
  }
  return {
    top: [],
    columns: [
      dying ? ['hp', 'death', 'identity', 'social', 'notes'] : ['identity', 'hp', 'social', 'notes'],
      ['inspiration', 'rests', 'clock', 'stats', 'slots', 'resources', 'supplies', 'exhaustion', 'history'],
    ],
  }
}

export const DEFAULT_MODE: SheetMode = 'story'
const modeKey = (id: string) => `ff.sheetMode.v1.${id}`

export function loadMode(characterId: string): SheetMode {
  try {
    return localStorage.getItem(modeKey(characterId)) === 'combat' ? 'combat' : DEFAULT_MODE
  } catch { return DEFAULT_MODE }
}

/** The sheet's mode for one character, remembered per device. */
export function useSheetMode(characterId: string): [SheetMode, (m: SheetMode) => void] {
  const [mode, setState] = useState(() => loadMode(characterId))
  const [forId, setForId] = useState(characterId)
  if (forId !== characterId) { setForId(characterId); setState(loadMode(characterId)) }
  const setMode = useCallback((m: SheetMode) => {
    setState(m)
    try { localStorage.setItem(modeKey(characterId), m) } catch { /* private mode */ }
  }, [characterId])
  return [mode, setMode]
}

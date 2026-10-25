// Story and combat modes: which sheet sections show, and in what order.
// Pure layout plus a small per-character preference kept on this device (not on Character).
import { useCallback, useState } from 'react'

export type SheetMode = 'story' | 'combat'

export type SheetSection =
  | 'quickcast' | 'identity' | 'social' | 'notes' | 'inspiration'
  | 'hp' | 'death' | 'rests' | 'clock' | 'exhaustion' | 'stats' | 'attacks'
  | 'turn' | 'reactions' | 'slots' | 'spells' | 'inventory' | 'resources' | 'supplies' | 'history'
  // Combat page (src/sheet/combat): summary header, skills rail, tabbed panel and its fight and features views.
  | 'summary' | 'skills' | 'tabs' | 'fight' | 'features'

/** Tabs of the combat page's main panel, like Roll20's character sheet. */
export type CombatTab = 'combat' | 'spells' | 'inventory' | 'features' | 'notes'

export interface SheetLayout {
  /** Full-width strip above the columns. */
  top: SheetSection[]
  columns: [SheetSection[], SheetSection[]]
  /** Combat page only: sections inside the summary's hit point block. */
  vitals?: SheetSection[]
  /** Combat page only: what each tab of the 'tabs' section shows. */
  tabs?: Record<CombatTab, SheetSection[]>
}

export const COMBAT_TABS: Record<CombatTab, SheetSection[]> = {
  combat: ['fight', 'resources', 'exhaustion'],
  spells: ['quickcast', 'slots', 'spells'],
  inventory: ['inventory', 'inspiration', 'supplies'],
  features: ['features'],
  notes: ['notes', 'identity', 'history'],
}

/**
 * Story mode leads with who the character is (background, social skills, notes) and keeps
 * HP close by. Combat mode is laid out like Roll20's sheet: a summary (who, HP and rests,
 * abilities, AC and speed) on top, the skills on the side, and tabs for combat, spells,
 * inventory, features and notes. A character at 0 HP gets death saves first in either mode.
 */
export function sheetLayout(mode: SheetMode, { dying }: { dying: boolean }): SheetLayout {
  if (mode === 'combat') {
    return {
      top: dying ? ['death', 'summary'] : ['summary'],
      columns: [['skills'], ['tabs']],
      vitals: ['hp', 'rests'],
      tabs: COMBAT_TABS,
    }
  }
  return {
    top: [],
    columns: [
      dying ? ['hp', 'death', 'identity', 'social', 'notes'] : ['identity', 'hp', 'social', 'notes'],
      ['inspiration', 'rests', 'clock', 'stats', 'attacks', 'inventory', 'slots', 'spells', 'resources', 'supplies', 'exhaustion', 'history'],
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

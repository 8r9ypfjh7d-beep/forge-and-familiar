// Story and combat modes: which sheet sections show, and in what order.
// Pure layout plus a small per-character preference kept on this device (not on Character).
import { useCallback, useState } from 'react'

export type SheetMode = 'story' | 'combat'

export type SheetSection =
  | 'quickcast' | 'identity' | 'notes' | 'storySpells' | 'abilities'
  | 'hp' | 'death' | 'rests' | 'attacks'
  | 'turn' | 'reactions' | 'slots' | 'spells' | 'inventory' | 'resources' | 'supplies' | 'history'
  // Combat page (src/sheet/combat): summary header, skills rail, tabbed panel and its fight and features views.
  | 'summary' | 'skills' | 'tabs' | 'fight' | 'features'

/** Tabs of the combat page's main panel, like Roll20's character sheet. */
export type CombatTab = 'combat' | 'spells' | 'inventory' | 'features' | 'notes'

export interface SheetLayout {
  /** Full-width strip above the columns. */
  top: SheetSection[]
  columns: [SheetSection[], SheetSection[]]
  /** Sections inside the hit point block: the combat summary's, or story mode's top card. */
  vitals?: SheetSection[]
  /** Combat page only: what each tab of the 'tabs' section shows. */
  tabs?: Record<CombatTab, SheetSection[]>
}

export const COMBAT_TABS: Record<CombatTab, SheetSection[]> = {
  combat: ['fight'],
  spells: ['quickcast', 'slots', 'spells'],
  inventory: ['inventory', 'supplies'],
  features: ['features'],
  notes: ['notes', 'identity', 'history'],
}

/**
 * Story mode is trimmed for roleplay: one top card with HP, rests and a small line on who the
 * character is, the combat page's abilities and skills, then notes and the spells the player
 * pinned for story moments. Combat mode is laid out like Roll20's sheet: a summary (who, HP and rests,
 * abilities, AC and speed) on top, the skills on the side, and tabs for combat, spells,
 * inventory, features and notes. A character at 0 HP gets death saves on top in either mode.
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
    top: dying ? ['death', 'identity', 'abilities'] : ['identity', 'abilities'],
    columns: [['skills'], ['notes', 'storySpells', 'slots', 'attacks', 'inventory']],
    vitals: ['hp', 'rests'],
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

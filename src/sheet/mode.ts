// Story and combat modes: which sheet sections show, and in what order.
// Pure layout plus a small per-character preference kept on this device (not on Character).
import { useCallback, useState } from 'react'

export type SheetMode = 'story' | 'combat'

export type SheetSection =
  | 'notes' | 'abilities'
  | 'hp' | 'death' | 'rests' | 'attacks'
  | 'spells' | 'inventory' | 'resources' | 'supplies' | 'history'
  // Shared by both modes: the character card (who, AC and speed, HP and Rest) and the skills rail.
  // Story mode's side also has the Spells card (spell slots and pinned spells).
  | 'summary' | 'skills' | 'spellCard'
  // Combat page (src/sheet/combat): tabbed panel and its fight and features views.
  | 'tabs' | 'fight' | 'features'
  // Tamir's Super Saiyan strip (src/powerup), only on his characters.
  | 'powerUp'

/** Tabs of the combat page's main panel, like Roll20's character sheet. */
export type CombatTab = 'combat' | 'spells' | 'inventory' | 'features' | 'notes'

export interface SheetLayout {
  /** Full-width strip above the columns. */
  top: SheetSection[]
  columns: [SheetSection[], SheetSection[]]
  /** Sections inside the character card's hit point block. */
  vitals?: SheetSection[]
  /** Combat page only: what each tab of the 'tabs' section shows. */
  tabs?: Record<CombatTab, SheetSection[]>
}

export const COMBAT_TABS: Record<CombatTab, SheetSection[]> = {
  combat: ['fight'],
  spells: ['spells'],
  inventory: ['inventory', 'supplies'],
  features: ['features'],
  notes: ['notes', 'history'],
}

/** Widgets both modes show, identically and in the same place. */
const SHARED_TOP: SheetSection[] = ['summary', 'abilities']
const SHARED_SIDE: SheetSection[] = ['skills']

/**
 * Both modes share the same widgets in the same places: the character card (who, AC and speed,
 * HP and Rest) and the abilities on top, the skills on the side. Story mode adds the Spells card
 * (slots and pinned spells) above the skills and fills the main column with notes, attacks and
 * inventory; combat mode fills it with Roll20-style tabs for combat, spells, inventory, features
 * and notes, whose Spells tab already holds the slots and spells, so it has no Spells card.
 * A character at 0 HP gets death saves on top in either mode. `powerUp` adds Tamir's strip card under the character card.
 */
export function sheetLayout(mode: SheetMode, { dying, powerUp }: { dying: boolean; powerUp?: boolean }): SheetLayout {
  const shared: SheetSection[] = powerUp ? ['summary', 'powerUp', ...SHARED_TOP.slice(1)] : SHARED_TOP
  const top = dying ? ['death' as const, ...shared] : shared
  const vitals: SheetSection[] = ['hp', 'rests']
  if (mode === 'combat') return { top, columns: [SHARED_SIDE, ['tabs']], vitals, tabs: COMBAT_TABS }
  return { top, columns: [['spellCard', ...SHARED_SIDE], ['notes', 'attacks', 'inventory']], vitals }
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

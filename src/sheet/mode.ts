// Story and combat modes: which sheet sections show, and in what order.
// Pure layout plus a small per-character preference kept on this device (not on Character).
import { useCallback, useState, useSyncExternalStore } from 'react'

export type SheetMode = 'story' | 'combat'

export type SheetSection =
  | 'notes' | 'abilities'
  | 'hp' | 'death' | 'rests' | 'attacks'
  | 'spells' | 'inventory' | 'resources' | 'supplies' | 'history'
  // Sorcery points and Metamagic options (sorcerers), in combat's Spells tab.
  | 'metamagic'
  // Shared by both modes: the character card (who, AC and speed, HP and Rest) and the skills rail.
  // Story mode's side also has the Spells card (spell slots and pinned spells).
  | 'summary' | 'skills' | 'spellCard'
  // Combat page (src/sheet/combat): tabbed panel and its fight and features views.
  | 'tabs' | 'fight' | 'features'
  // Story mode's Effects card: running spells and switches (combat shows them in its Combat tab).
  | 'effects'
  // The DM's charms and blessings (src/sheet/components/Boons.tsx): story mode only when there are some.
  | 'boons'
  // Tamir's Super Saiyan strip (src/powerup), only on his characters.
  | 'powerUp'
  // The party's live battle map (src/combat/live), only while the DM runs a combat.
  | 'map'

/** Tabs of the combat page's main panel, like Roll20's character sheet. */
export type CombatTab = 'combat' | 'map' | 'checks' | 'spells' | 'inventory' | 'features' | 'notes'

export interface SheetLayout {
  /** Full-width strip above the columns. */
  top: SheetSection[]
  columns: [SheetSection[], SheetSection[]]
  /** Sections inside the character card's hit point block. */
  vitals?: SheetSection[]
  /** Combat page only: what each tab of the 'tabs' section shows. */
  tabs?: Partial<Record<CombatTab, SheetSection[]>>
}

export const COMBAT_TABS: Partial<Record<CombatTab, SheetSection[]>> = {
  combat: ['fight'],
  spells: ['spells', 'metamagic'],
  inventory: ['inventory', 'supplies'],
  // Uses of class, subclass, race and feat features (Channel Divinity, Second Wind) sit above the features they belong to.
  features: ['resources', 'features'],
  notes: ['notes', 'history'],
}

/** Phones: abilities and skills move into a Checks tab, so the tabs sit right under HP and Rest. */
export const PHONE_COMBAT_TABS: Partial<Record<CombatTab, SheetSection[]>> = {
  combat: COMBAT_TABS.combat,
  checks: ['abilities', 'skills'],
  spells: COMBAT_TABS.spells,
  inventory: COMBAT_TABS.inventory,
  features: COMBAT_TABS.features,
  notes: COMBAT_TABS.notes,
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
 * Feature uses and trackers live only in combat's Features & Traits tab, since story mode leaves them out.
 * A character at 0 HP gets death saves on top in either mode. `powerUp` adds Tamir's strip card under the character card.
 * On a phone (`narrow`) combat mode puts abilities and skills in a Checks tab, so a turn starts
 * right under HP instead of below six abilities and eighteen skills. While the DM runs a live combat
 * for the character's party (`liveMap`) a Map tab follows the Combat tab; it leaves when combat ends.
 */
export function sheetLayout(mode: SheetMode, { dying, powerUp, narrow, liveMap }: { dying: boolean; powerUp?: boolean; narrow?: boolean; liveMap?: boolean }): SheetLayout {
  const phoneCombat = mode === 'combat' && !!narrow
  const sharedTop = phoneCombat ? SHARED_TOP.filter(s => s !== 'abilities') : SHARED_TOP
  const shared: SheetSection[] = powerUp ? ['summary', 'powerUp', ...sharedTop.slice(1)] : sharedTop
  const top = dying ? ['death' as const, ...shared] : shared
  const vitals: SheetSection[] = ['hp', 'rests']
  if (phoneCombat) return { top, columns: [[], ['tabs']], vitals, tabs: withMap(PHONE_COMBAT_TABS, liveMap) }
  if (mode === 'combat') return { top, columns: [SHARED_SIDE, ['tabs']], vitals, tabs: withMap(COMBAT_TABS, liveMap) }
  return { top, columns: [['spellCard', ...SHARED_SIDE], ['notes', 'effects', 'boons', 'attacks', 'inventory']], vitals }
}

/** The Map tab right after Combat, only while a live combat exists. */
function withMap(tabs: Partial<Record<CombatTab, SheetSection[]>>, liveMap?: boolean): Partial<Record<CombatTab, SheetSection[]>> {
  if (!liveMap) return tabs
  const { combat, ...rest } = tabs
  return { combat, map: ['map'], ...rest }
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

/** Below this width the sheet is one column (sheet.css .sheet-grid), so combat mode uses the phone layout. */
export const NARROW_QUERY = '(max-width: 819px)'

function subscribeNarrow(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => {}
  const q = matchMedia(NARROW_QUERY)
  q.addEventListener('change', onChange)
  return () => q.removeEventListener('change', onChange)
}
const isNarrow = () => typeof matchMedia === 'function' && matchMedia(NARROW_QUERY).matches

/** True while the screen is phone-sized; follows rotation and window resizes. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, isNarrow, () => false)
}

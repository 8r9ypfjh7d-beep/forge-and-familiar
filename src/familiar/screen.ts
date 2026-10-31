// What is on screen for the Familiar: the sheet or builder sets it, the panel reads it. Pure (no React); hooks are in ui/screen.ts.
import type { ToolData } from './tools/registry'
import type { FamiliarContext } from './types'

export interface FamiliarScreen {
  context: FamiliarContext
  /** Context card text (characterCard, draftCard), rebuilt as the screen changes. */
  card?: string
  edition?: '2014' | '2024'
  role?: 'player' | 'dm'
  /** Data access for the tools (the open character, the builder draft). */
  data?: ToolData
  /** Quick chips: `familiar.chip.*` i18n keys. */
  chips?: string[]
}

export const GENERAL_SCREEN: FamiliarScreen = { context: { kind: 'general' } }

let current: FamiliarScreen = GENERAL_SCREEN
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(fn => fn())

/** Sets the screen; the returned function clears it only if nothing replaced it since. */
export function setFamiliarScreen(screen: FamiliarScreen): () => void {
  current = screen
  notify()
  return () => {
    if (current !== screen) return
    current = GENERAL_SCREEN
    notify()
  }
}

export const getFamiliarScreen = () => current

export function subscribeFamiliarScreen(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** A request to open the panel, optionally with a question to send (or prefill). */
export interface OpenRequest {
  prompt?: string
  /** Send the prompt right away instead of only filling the input. */
  send?: boolean
}

const openers = new Set<(r: OpenRequest) => void>()
const openerListeners = new Set<() => void>()

/** The panel registers here; entry points stay hidden while nothing is registered. */
export function onFamiliarOpen(handler: (r: OpenRequest) => void): () => void {
  openers.add(handler)
  openerListeners.forEach(fn => fn())
  return () => {
    openers.delete(handler)
    openerListeners.forEach(fn => fn())
  }
}

export const familiarAvailable = () => openers.size > 0

export function subscribeFamiliarAvailable(fn: () => void): () => void {
  openerListeners.add(fn)
  return () => { openerListeners.delete(fn) }
}

/** Opens the panel; false when no panel is mounted. */
export function askFamiliar(r: OpenRequest = {}): boolean {
  openers.forEach(fn => fn(r))
  return openers.size > 0
}

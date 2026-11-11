// Roll results open right under the thing that was tapped. A capture-phase click listener remembers the last
// control the player pressed; a FadingResult that mounts just after it floats beneath that control.
// `placeUnder` is the pure geometry, so it can be tested without a browser.

const RECENT_MS = 1500
let last: { el: Element; at: number } | null = null

function remember(e: Event) {
  const t = e.target
  if (!(t instanceof Element)) return
  // Taps on a result card itself never become an anchor.
  if (t.closest('.fading-result')) return
  last = { el: t.closest('button, [role="button"], a, summary, label') ?? t, at: Date.now() }
}

if (typeof document !== 'undefined') document.addEventListener('click', remember, true)

/** The control tapped a moment ago, if it is still on the page. */
export function recentTrigger(now = Date.now()): Element | null {
  if (!last || now - last.at > RECENT_MS || !last.el.isConnected) return null
  return last.el
}

export interface Box { top: number; bottom: number; left: number; right: number }
export interface Placement { top: number; left: number; width: number; above: boolean }

const GAP = 6
const EDGE = 12
const MAX_WIDTH = 380

/**
 * Where a card of height `h` goes for a trigger box, in viewport pixels: below the trigger, lined up with its
 * start edge (the right edge in Hebrew), kept inside the screen. It flips above only when below would run off
 * the bottom and above has more room.
 */
export function placeUnder(trigger: Box, h: number, view: { width: number; height: number }, rtl: boolean): Placement {
  const width = Math.min(MAX_WIDTH, view.width - EDGE * 2)
  const start = rtl ? trigger.right - width : trigger.left
  const left = Math.min(Math.max(EDGE, start), view.width - EDGE - width)
  const below = trigger.bottom + GAP
  const roomBelow = view.height - EDGE - below
  const roomAbove = trigger.top - GAP - EDGE
  const above = h > roomBelow && roomAbove > roomBelow
  return { top: above ? trigger.top - GAP - h : below, left, width, above }
}

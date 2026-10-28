// Dynamic opacity for floating bars: how much content sits under the top and bottom edges,
// written to <html> as --glass-top and --glass-bottom (0..1) for glass.css to read.

/** Distance over which a bar goes from clear to its thickest fill, in px. */
export const EDGE_RANGE = 48

/** 0 when nothing is past the edge, 1 once `distance` px of content is past it. Rounded to 0.01 to skip no-op writes. */
export function edgeLevel(distance: number, range = EDGE_RANGE): number {
  if (!(distance > 0) || !(range > 0)) return 0
  return Math.round(Math.min(1, distance / range) * 100) / 100
}

/** Levels for a scroll position: content scrolled under the top bar, and content still below the bottom bar. */
export function scrollLevels(scrollY: number, viewport: number, page: number) {
  return { top: edgeLevel(scrollY), bottom: edgeLevel(page - viewport - scrollY) }
}

/** Keeps --glass-top/--glass-bottom in step with scrolling and resizing. Returns a cleanup. */
export function installScrollGlass(win: Window = window): () => void {
  const root = win.document.documentElement
  let frame = 0
  let last = ''
  const update = () => {
    frame = 0
    const { top, bottom } = scrollLevels(win.scrollY, win.innerHeight, root.scrollHeight)
    const key = `${top}/${bottom}`
    if (key === last) return
    last = key
    root.style.setProperty('--glass-top', String(top))
    root.style.setProperty('--glass-bottom', String(bottom))
  }
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update) }
  win.addEventListener('scroll', schedule, { passive: true })
  win.addEventListener('resize', schedule)
  // Page height changes without a scroll (a card opens, a list loads).
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
  observer?.observe(win.document.body)
  update()
  return () => {
    win.removeEventListener('scroll', schedule)
    win.removeEventListener('resize', schedule)
    observer?.disconnect()
    if (frame) win.cancelAnimationFrame(frame)
  }
}

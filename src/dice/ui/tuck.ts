import { useEffect } from 'react'

/**
 * Floating buttons (dice, the Familiar) slide out of the way while the page scrolls down, so they don't cover
 * Cast buttons and roll totals, and come back on scroll up or once scrolling stops. Sets `data-fabs="tucked"`
 * on <html>; the buttons' CSS does the rest.
 */
export function useTuckOnScroll(enabled = true) {
  useEffect(() => {
    const root = document.documentElement
    if (!enabled) { delete root.dataset.fabs; return }
    let last = window.scrollY
    let timer: ReturnType<typeof setTimeout> | undefined
    const show = () => { delete root.dataset.fabs }
    const onScroll = () => {
      const y = window.scrollY
      if (y > last + 4 && y > 80) root.dataset.fabs = 'tucked'
      else if (y < last - 4) show()
      last = y
      clearTimeout(timer)
      timer = setTimeout(show, 700)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); show() }
  }, [enabled])
}

// A roll result card that cleans itself up: it fades out a few seconds after the roll, sooner if tapped or
// swiped sideways, and holds still while the pointer rests on it, a finger presses it or it has focus.
// Give it a new `key` per roll so a fresh roll replaces the card and restarts the clock.
// Every roll is still in the dice button's history.
// It opens floating right under the control that was tapped (see anchor.ts), so the player never scrolls to find it;
// with nothing tapped (or `inline`) it stays where it sits in the page.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'
import { placeUnder, recentTrigger, type Placement } from './anchor'
import './dice.css'

export const RESULT_SHOW_MS = 8000
const FADE_MS = 300
const SWIPE_PX = 70
const TAP_MS = 350

interface Props {
  onDone: () => void
  className?: string
  children: ReactNode
  /** How long the card stays before fading. */
  ms?: number
  ref?: Ref<HTMLDivElement>
  /** Stay in place in the page instead of floating under the tapped control (it already sits under it). */
  inline?: boolean
}

/** Only keyboard focus holds the card; a tap focuses it too, and that must not keep it forever. */
function keyboardFocus(el: HTMLElement): boolean {
  try { return el.matches(':focus-visible') } catch { return false }
}

export function FadingResult({ onDone, className, children, ms = RESULT_SHOW_MS, ref, inline }: Props) {
  const { t, dir } = useI18n()
  const [anchor] = useState(() => (inline ? null : recentTrigger()))
  const [place, setPlace] = useState<Placement | null>(null)
  const self = useRef<HTMLDivElement | null>(null)
  const setRef = (el: HTMLDivElement | null) => {
    self.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as RefObject<HTMLDivElement | null>).current = el
  }

  // Follow the tapped control while the page scrolls or the card grows.
  useLayoutEffect(() => {
    if (!anchor) return
    let frame = 0
    const measure = () => {
      const el = self.current
      if (!el) return
      const r = anchor.getBoundingClientRect()
      setPlace(placeUnder(r, el.offsetHeight, { width: window.innerWidth, height: window.innerHeight }, dir === 'rtl'))
    }
    const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', later, true)
    window.addEventListener('resize', later)
    const grow = typeof ResizeObserver === 'function' ? new ResizeObserver(later) : null
    if (self.current) grow?.observe(self.current)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', later, true)
      window.removeEventListener('resize', later)
      grow?.disconnect()
    }
  }, [anchor, dir])
  const [fading, setFading] = useState(false)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [closing, setClosing] = useState(false)
  const [press, setPress] = useState<{ x: number; at: number; touch: boolean } | null>(null)
  const [dx, setDx] = useState(0)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  const held = hover || focus || !!press

  useEffect(() => {
    if (held) return
    const id = setTimeout(() => setFading(true), ms)
    return () => clearTimeout(id)
  }, [held, ms])

  useEffect(() => {
    if (!fading && !closing) return
    const id = setTimeout(() => done.current(), FADE_MS)
    return () => clearTimeout(id)
  }, [fading, closing])

  // Touching, hovering or focusing a card that has started to fade brings it back.
  const hold = () => setFading(false)
  const dismiss = () => { setPress(null); setClosing(true) }

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    hold()
    setPress({ x: e.clientX, at: Date.now(), touch: e.pointerType !== 'mouse' })
    setDx(0)
  }
  const move = (e: PointerEvent<HTMLDivElement>) => { if (press?.touch) setDx(e.clientX - press.x) }
  const up = () => {
    if (!press) return
    const tap = Math.abs(dx) < 8 && Date.now() - press.at < TAP_MS
    if (tap || Math.abs(dx) > SWIPE_PX) return dismiss()
    setPress(null)
    setDx(0)
  }
  const cancel = () => { setPress(null); setDx(0) }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Delete') { e.preventDefault(); dismiss() }
  }

  const gone = fading || closing
  const slide = closing && Math.abs(dx) > SWIPE_PX ? Math.sign(dx) * 400 : dx
  const swipe: CSSProperties | undefined = slide ? { transform: `translateX(${slide}px)`, opacity: gone ? 0 : Math.max(0.3, 1 - Math.abs(dx) / 200) } : undefined
  const at: CSSProperties | undefined = anchor
    ? place ? { top: place.top, left: place.left, width: place.width } : { visibility: 'hidden' }
    : undefined
  const card = (
    <div
      ref={setRef}
      aria-live="polite"
      dir={anchor ? dir : undefined}
      className={`fading-result${anchor ? ` is-anchored${place?.above ? ' is-above' : ''}` : ''}${gone ? ' out' : ''}${press ? ' pressed' : ''}${className ? ` ${className}` : ''}`}
      style={at || swipe ? { ...at, ...swipe } : undefined}
      title={t('dice.dismissHint')}
      tabIndex={0}
      onPointerEnter={e => { if (e.pointerType === 'mouse') { hold(); setHover(true) } }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(false); if (press && e.pointerType === 'mouse') cancel() }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onFocus={e => { if (keyboardFocus(e.currentTarget)) { hold(); setFocus(true) } }}
      onBlur={() => setFocus(false)}
      onKeyDown={key}
    >
      {children}
    </div>
  )
  return anchor ? createPortal(card, document.body) : card
}

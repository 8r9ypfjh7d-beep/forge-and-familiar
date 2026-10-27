// A roll result card that cleans itself up: it fades out a few seconds after the roll, sooner if tapped or
// swiped sideways, and holds still while the pointer rests on it, a finger presses it or it has focus.
// Give it a new `key` per roll so a fresh roll replaces the card and restarts the clock.
// Every roll is still in the dice button's history.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from 'react'
import { useI18n } from '../../i18n'
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
}

/** Only keyboard focus holds the card; a tap focuses it too, and that must not keep it forever. */
function keyboardFocus(el: HTMLElement): boolean {
  try { return el.matches(':focus-visible') } catch { return false }
}

export function FadingResult({ onDone, className, children, ms = RESULT_SHOW_MS, ref }: Props) {
  const { t } = useI18n()
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
  return (
    <div
      ref={ref}
      aria-live="polite"
      className={`fading-result${gone ? ' out' : ''}${press ? ' pressed' : ''}${className ? ` ${className}` : ''}`}
      style={slide ? { transform: `translateX(${slide}px)`, opacity: gone ? 0 : Math.max(0.3, 1 - Math.abs(dx) / 200) } : undefined}
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
}

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { WHY, type WhyId } from './why'
import './why.css'

/** A small "why?" button that opens a plain-language explanation for new players. */
export function Why({ id, compact }: { id: WhyId; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const popId = useId()
  const t = WHY[id]

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Open toward whichever side has room, so the bubble never runs off a phone screen.
  useLayoutEffect(() => {
    if (open && ref.current) setAlignRight(ref.current.getBoundingClientRect().left > window.innerWidth / 2)
  }, [open])

  return (
    <span className={`why ${compact ? 'compact' : ''}`} ref={ref}>
      <button
        type="button"
        className="why-btn"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={`Why? ${t.title}`}
        onClick={e => { e.preventDefault(); setOpen(o => !o) }}
      >
        {compact ? '?' : 'why?'}
      </button>
      {open && (
        <span id={popId} role="note" className={`why-pop ${alignRight ? 'right' : ''}`}>
          <strong>{t.title}</strong>
          {t.text}
        </span>
      )}
    </span>
  )
}

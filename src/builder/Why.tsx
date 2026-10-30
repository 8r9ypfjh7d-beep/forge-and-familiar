import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { explainKey, type ExplainKind, type WhyId } from './why'
import './why.css'

type WhyProps = {
  /** Shows a capsule with this text instead of "why?" (or "?" when compact). */
  label?: string
  compact?: boolean
} & ({ id: WhyId } | { title: string; text: string })

/** A small "why?" button that opens a plain-language explanation for new players. */
export function Why(props: WhyProps) {
  const { label, compact } = props
  const [open, setOpen] = useState(false)
  const [alignEnd, setAlignEnd] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)
  const popId = useId()
  const { t } = useI18n()
  const title = 'id' in props ? t(`why.${props.id}.title`) : props.title
  const text = 'id' in props ? t(`why.${props.id}.text`) : props.text

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
  // Near the end edge (right in English, left in Hebrew) it hangs from the end instead.
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const nearRight = ref.current.getBoundingClientRect().left > window.innerWidth / 2
    setAlignEnd(getComputedStyle(ref.current).direction === 'rtl' ? !nearRight : nearRight)
    setShift(0)
  }, [open])

  // A button mid-line (like the card legend) can still push the bubble past an edge: nudge it back on screen.
  useLayoutEffect(() => {
    if (!open || !popRef.current) return
    // Measure the unscaled box: the open animation starts at 94% size.
    const r = popRef.current.getBoundingClientRect()
    const half = popRef.current.offsetWidth / 2
    const left = (r.left + r.right) / 2 - half
    const right = left + 2 * half
    const margin = 8
    if (right > window.innerWidth - margin) setShift(s => s - (right - window.innerWidth + margin))
    else if (left < margin) setShift(s => s + (margin - left))
  }, [open, alignEnd])

  return (
    <span className={`why ${compact ? 'compact' : ''}`} ref={ref}>
      <button
        type="button"
        className="why-btn"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={t('why.label', { title })}
        onClick={e => { e.preventDefault(); setOpen(o => !o) }}
      >
        {label ?? (compact ? '?' : t('why.button'))}
      </button>
      {open && (
        <span id={popId} ref={popRef} role="note" className={`why-pop glass-sheet ${alignEnd ? 'end' : ''}`} style={shift ? { translate: `${shift}px 0` } : undefined}>
          <strong>{title}</strong>
          {text}
        </span>
      )}
    </span>
  )
}

/** One option and the key that explains it (none for homebrew). */
export interface ExplainItem {
  name: string
  key?: MessageKey
  /** "Level 3" style note shown after the name. */
  note?: string
  /** The player's own text (custom subclass features); wins over `key`. */
  text?: string
}

/** Names with a one-line plain-language explanation each, e.g. a class's features or a race's traits. */
export function ExplainList({ items }: { items: ExplainItem[] }) {
  const { t } = useI18n()
  if (items.length === 0) return null
  return (
    <ul className="why-list">
      {items.map((it, i) => (
        <li key={`${it.name}-${i}`}>
          <strong>{it.name}</strong>
          {it.note && <span className="muted"> · {it.note}</span>}
          <span className="why-list-text">{it.text || (it.key ? t(it.key) : t('why.homebrew'))}</span>
        </li>
      ))}
    </ul>
  )
}

/** The explanation line for one picked option; SRD options all have one, homebrew gets "ask your DM". */
export function Explain({ kind, id }: { kind: ExplainKind; id: string }) {
  const { t } = useI18n()
  const key = explainKey(kind, id)
  return <p className="why-explain small">{key ? t(key) : t('why.homebrew')}</p>
}

import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Character } from '../model/character'
import { formatMod } from '../rules'
import { explain, type StatKey, type StatMath } from './math'
import './explain.css'

/**
 * Wraps a number on the sheet in a button; tapping it shows how the number is built.
 * Uses the native popover so Esc and tapping outside close it; it is portalled to
 * <body> so layout rules of the surrounding card (e.g. `div { display: flex }`) never reach it.
 */
export function ShowMath({ character, stat, children, className }: {
  character: Character
  stat: StatKey
  children: ReactNode
  className?: string
}) {
  const id = useId()
  const pop = useRef<HTMLDivElement>(null)
  const [math, setMath] = useState<StatMath | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const m = explain(character, stat)
    if (!m) return
    const r = e.currentTarget.getBoundingClientRect()
    const width = Math.min(300, window.innerWidth - 32)
    setMath(m)
    setPos({ top: r.bottom + 6, left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)) })
    pop.current?.showPopover?.()
    // The popover is fixed to where the number was, so close it once the page moves.
    window.addEventListener('scroll', () => pop.current?.hidePopover?.(), { once: true, passive: true })
  }

  return (
    <>
      <button type="button" className={`show-math ${className ?? ''}`} onClick={open} aria-haspopup="dialog" aria-controls={id}>
        {children}
      </button>
      {createPortal(
        <div ref={pop} id={id} popover="auto" role="dialog" aria-label={math?.title} className="math-pop" style={pos}>
          {math && <MathTable math={math} />}
        </div>,
        document.body,
      )}
    </>
  )
}

const fmt = (n: number, signed: boolean) => (signed ? formatMod(n) : `${n}`)

export function MathTable({ math }: { math: StatMath }) {
  return (
    <>
      <h3>{math.title}</h3>
      <table>
        <tbody>
          {math.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.label}</td>
              <td>{i === 0 ? fmt(l.value, math.signed) : formatMod(l.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td>Total</td><td>{fmt(math.total, math.signed)}</td></tr>
        </tfoot>
      </table>
      {math.notes.map(n => <p key={n}>{n}</p>)}
    </>
  )
}

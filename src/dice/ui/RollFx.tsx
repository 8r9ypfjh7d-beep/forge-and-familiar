// Roll effects overlay: a die tumbles and lands on every recorded roll; a natural 20 or natural 1 takes over the screen (CritFx), except on quiet rolls.
// Reduce motion (a11y panel or the OS) skips the tumble and the effects; the result and the joke stay.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CRIT_LINES, fxCritKind, headlineDie, pickLine, type CritKind, type DieFace, type RollFxBus } from '../fx'
import { CritFx, type Crit } from './CritFx'
import './dice.css'

const TUMBLE_MS = 650
const HOLD_MS = 700

export function motionReduced(): boolean {
  if (typeof document === 'undefined') return true
  if (document.documentElement.dataset.motion === 'reduce') return true
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Outline per die, on a 100x100 box. */
const SHAPES: Record<number, string> = {
  4: '50,8 94,88 6,88',
  6: '12,12 88,12 88,88 12,88',
  8: '50,4 94,50 50,96 6,50',
  10: '50,4 92,40 50,96 8,40',
  12: '50,4 95,37 78,92 22,92 5,37',
  20: '50,3 92,27 92,73 50,97 8,73 8,27',
}
const shapeFor = (sides: number) => SHAPES[sides] ?? SHAPES[sides === 100 ? 10 : 20]

interface Shown {
  key: number
  face: DieFace
  value: number
  landed: boolean
}

export function RollFx({ bus }: { bus: RollFxBus }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const [crit, setCrit] = useState<Crit | null>(null)
  const lastLine = useRef<Record<CritKind, number>>({ nat20: 0, nat1: 0 })
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clear = () => { timers.current.forEach(id => clearTimeout(id)); timers.current = [] }
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    const unsub = bus.subscribe((r, opts) => {
      const face = headlineDie(r)
      if (!face) return
      clear()
      const kind = fxCritKind(r, opts)
      const key = Date.now()
      const land = () => {
        if (kind) {
          const line = pickLine(Math.random, CRIT_LINES[kind], lastLine.current[kind])
          lastLine.current[kind] = line
          setShown(null)
          setCrit({ key, kind, line })
          return
        }
        setShown({ key, face, value: face.value, landed: true })
        later(() => setShown(null), HOLD_MS)
      }
      if (motionReduced()) return land()
      setCrit(null)
      setShown({ key, face, value: 1 + Math.floor(Math.random() * face.sides), landed: false })
      const tick = window.setInterval(() => {
        setShown(s => (s && s.key === key && !s.landed ? { ...s, value: 1 + Math.floor(Math.random() * face.sides) } : s))
      }, 70)
      later(() => { clearInterval(tick); land() }, TUMBLE_MS)
      timers.current.push(tick)
    })
    return () => { unsub(); clear() }
  }, [bus])

  const done = useCallback(() => setCrit(null), [])
  return (
    <>
      {shown && (
        <div key={shown.key} className={`ff-rollfx${shown.landed ? ' is-landed' : ''}`} aria-hidden="true">
          <svg className="ff-rollfx__die" viewBox="0 0 100 100" width="88" height="88">
            <polygon points={shapeFor(shown.face.sides)} />
            <text x="50" y="52" dominantBaseline="middle" textAnchor="middle">{shown.value}</text>
          </svg>
          <span className="ff-rollfx__sides">d{shown.face.sides}</span>
        </div>
      )}
      {crit && <CritFx key={crit.key} crit={crit} still={motionReduced()} onDone={done} />}
    </>
  )
}

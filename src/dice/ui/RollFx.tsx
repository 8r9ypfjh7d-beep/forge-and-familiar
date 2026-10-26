// Roll effects overlay: a die tumbles and lands on every recorded roll; a natural 20 gets a short, dismissable surprise.
// Reduce motion (a11y panel or the OS) skips the tumble and the confetti; the result and the joke stay.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/locales/en'
import { headlineDie, isNat20, pickNat20Line, type DieFace, type RollFxBus } from '../fx'
import './dice.css'

const TUMBLE_MS = 650
const HOLD_MS = 700
const EGG_MS = 5000
const CONFETTI = 14

function motionReduced(): boolean {
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
  nat20: boolean
}

export function RollFx({ bus }: { bus: RollFxBus }) {
  const { t } = useI18n()
  const [shown, setShown] = useState<Shown | null>(null)
  const [egg, setEgg] = useState<{ line: number } | null>(null)
  const lastLine = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clear = () => { timers.current.forEach(id => clearTimeout(id)); timers.current = [] }
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    const unsub = bus.subscribe(r => {
      const face = headlineDie(r)
      if (!face) return
      clear()
      const nat20 = isNat20(r)
      const key = Date.now()
      const land = () => {
        setShown({ key, face, value: face.value, landed: true, nat20 })
        if (nat20) {
          lastLine.current = pickNat20Line(Math.random, lastLine.current)
          setEgg({ line: lastLine.current })
          later(() => setEgg(null), EGG_MS)
        }
        later(() => setShown(null), HOLD_MS + (nat20 ? 500 : 0))
      }
      if (motionReduced()) return land()
      setEgg(null)
      setShown({ key, face, value: 1 + Math.floor(Math.random() * face.sides), landed: false, nat20 })
      const tick = window.setInterval(() => {
        setShown(s => (s && s.key === key && !s.landed ? { ...s, value: 1 + Math.floor(Math.random() * face.sides) } : s))
      }, 70)
      later(() => { clearInterval(tick); land() }, TUMBLE_MS)
      timers.current.push(tick)
    })
    return () => { unsub(); clear() }
  }, [bus])

  useEffect(() => {
    if (!egg) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEgg(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [egg])

  const confetti = egg && !motionReduced()
  return (
    <>
      {shown && (
        <div key={shown.key} className={`ff-rollfx${shown.landed ? ' is-landed' : ''}${shown.nat20 && shown.landed ? ' is-nat20' : ''}`} aria-hidden="true">
          <svg className="ff-rollfx__die" viewBox="0 0 100 100" width="88" height="88">
            <polygon points={shapeFor(shown.face.sides)} />
            <text x="50" y="52" dominantBaseline="middle" textAnchor="middle">{shown.value}</text>
          </svg>
          <span className="ff-rollfx__sides">d{shown.face.sides}</span>
        </div>
      )}
      {egg && (
        <div className="ff-nat20" role="status">
          {confetti && (
            <div className="ff-nat20__confetti" aria-hidden="true">
              {Array.from({ length: CONFETTI }, (_, i) => (
                <span key={i} style={{ '--i': i, '--n': CONFETTI } as CSSProperties}>{i % 3 ? '✦' : '20'}</span>
              ))}
            </div>
          )}
          <span className="ff-nat20__dragon" aria-hidden="true">🐉</span>
          <div className="ff-nat20__text">
            <strong>{t('dice.nat20.title')}</strong>
            <span>{t(`dice.nat20.line${egg.line}` as MessageKey)}</span>
          </div>
          <button type="button" className="ff-nat20__close" onClick={() => setEgg(null)} aria-label={t('dice.nat20.dismiss')} title={t('dice.nat20.dismiss')}>✕</button>
        </div>
      )}
    </>
  )
}

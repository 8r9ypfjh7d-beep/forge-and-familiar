// Full-screen natural 20 / natural 1 moment: a god-power burst for a 20, a comic crash for a 1.
// Short, closes itself, and any tap, the ✕ or Escape closes it early. Reduce motion keeps a still card with the same words.
import { useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/locales/en'
import type { CritKind } from '../fx'
import './crit.css'

const CRIT_MS: Record<CritKind, number> = { nat20: 4600, nat1: 4200 }
const LEAVE_MS = 280
const SPARKS = 30
const RAYS = 3
const RAIN = 26

export interface Crit {
  key: number
  kind: CritKind
  line: number
}

const D20 = '50,3 92,27 92,73 50,97 8,73 8,27'
/** Inner facet lines of the d20 outline, for the gem look. */
const FACETS = 'M50 3 L28 40 L72 40 Z M28 40 L50 78 L72 40 M8 27 L28 40 L8 73 L50 78 L92 73 L72 40 L92 27 M50 78 L50 97'

const vars = (v: Record<string, string | number>) => v as CSSProperties

function Die({ kind }: { kind: CritKind }) {
  const face = kind === 'nat20' ? '20' : '1'
  const body = (
    <>
      <polygon points={D20} />
      <path d={FACETS} />
      <text x="50" y="54" dominantBaseline="middle" textAnchor="middle">{face}</text>
    </>
  )
  if (kind === 'nat20') {
    return (
      <svg className="ff-crit__die" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="ff-crit-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff7c2" />
            <stop offset="0.45" stopColor="#ffd34d" />
            <stop offset="1" stopColor="#b8780a" />
          </linearGradient>
        </defs>
        {body}
      </svg>
    )
  }
  // The 1 cracks in two: the same die drawn twice, each half clipped and pushed apart by CSS.
  return (
    <div className="ff-crit__die ff-crit__die--split" aria-hidden="true">
      <svg className="ff-crit__half ff-crit__half--a" viewBox="0 0 100 100">{body}</svg>
      <svg className="ff-crit__half ff-crit__half--b" viewBox="0 0 100 100">{body}</svg>
    </div>
  )
}

export function CritFx({ crit, still, onDone }: { crit: Crit; still: boolean; onDone: () => void }) {
  const { t } = useI18n()
  const [leaving, setLeaving] = useState(false)
  const { kind } = crit

  useEffect(() => {
    const auto = window.setTimeout(() => setLeaving(true), CRIT_MS[kind])
    if (!still && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(kind === 'nat20' ? [40, 60, 40, 60, 160] : [400]) } catch { /* not allowed here */ }
    }
    return () => clearTimeout(auto)
  }, [crit.key, kind, still])

  useEffect(() => {
    if (!leaving) return
    const id = window.setTimeout(onDone, still ? 0 : LEAVE_MS)
    return () => clearTimeout(id)
  }, [leaving, still, onDone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLeaving(true) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const close = () => setLeaving(true)
  return (
    <div
      className={`ff-crit ff-crit--${kind}${still ? ' is-still' : ''}${leaving ? ' is-leaving' : ''}`}
      role="status"
      onClick={close}
      data-testid="crit-fx"
    >
      <div className="ff-crit__stage">
        {!still && kind === 'nat20' && (
          <div aria-hidden="true">
            <div className="ff-crit__rays" />
            {Array.from({ length: RAYS }, (_, i) => <span key={i} className="ff-crit__ring" style={vars({ '--i': i })} />)}
            <div className="ff-crit__sparks">
              {Array.from({ length: SPARKS }, (_, i) => (
                <span key={i} style={vars({ '--a': `${(i * 360) / SPARKS + ((i * 37) % 11)}deg`, '--d': `${30 + ((i * 53) % 25)}vmax`, '--i': i })} />
              ))}
            </div>
            <svg className="ff-crit__bolt ff-crit__bolt--a" viewBox="0 0 40 100"><path d="M24 0 L6 52 L20 52 L10 100 L36 38 L22 38 L32 0 Z" /></svg>
            <svg className="ff-crit__bolt ff-crit__bolt--b" viewBox="0 0 40 100"><path d="M24 0 L6 52 L20 52 L10 100 L36 38 L22 38 L32 0 Z" /></svg>
            <div className="ff-crit__flash" />
          </div>
        )}
        {!still && kind === 'nat1' && (
          <div aria-hidden="true">
            <div className="ff-crit__cloud">🌧️</div>
            <div className="ff-crit__rain">
              {Array.from({ length: RAIN }, (_, i) => (
                <span key={i} style={vars({ '--x': `${(i * 397) % 100}%`, '--i': i, '--s': `${0.55 + ((i * 7) % 5) / 10}s` })} />
              ))}
            </div>
            <div className="ff-crit__vignette" />
          </div>
        )}
        <div className="ff-crit__core">
          <Die kind={kind} />
          <strong className="ff-crit__title">{t(`dice.${kind}.title` as MessageKey)}</strong>
          <span className="ff-crit__kicker">{t(`dice.${kind}.kicker` as MessageKey)}</span>
          <span className="ff-crit__line">{t(`dice.${kind}.line${crit.line}` as MessageKey)}</span>
        </div>
        <span className="ff-crit__hint" aria-hidden="true">{t('dice.crit.tap')}</span>
      </div>
      <button type="button" className="ff-crit__close" onClick={e => { e.stopPropagation(); close() }} aria-label={t('dice.nat20.dismiss')} title={t('dice.nat20.dismiss')}>✕</button>
    </div>
  )
}

// Full-screen Super Saiyan power-up: the hero trembles, the clothes fly off in every direction, a flash,
// golden hair and a roaring aura, and a censor bar slams down where it is needed. Built like the nat 20
// moment (src/dice/ui/CritFx.tsx): it stays until any tap, the ✕ or Escape closes it, and reduce
// motion keeps a still final frame with the same words.
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import './strip.fx.css'

const LEAVE_MS = 280
const SPARKS = 24
const MOTES = 18

/** What flies off. No socks: they stay on (see line 12). */
const CLOTHES = ['👕', '👖', '🩲', '👢', '👢', '🧥', '🎩', '🧤', '🧣']

export interface Strip {
  key: number
  name: string
  level: number
  line: number
}

const vars = (v: Record<string, string | number>) => v as CSSProperties

/** A cartoon hero, front on. The clothes are their own groups so CSS can throw them away. */
function Hero() {
  return (
    <svg className="ff-strip__hero" viewBox="0 0 100 150" aria-hidden="true">
      <g className="ff-strip__body">
        <path d="M38 52 Q50 48 62 52 L66 92 Q50 96 34 92 Z" />
        <path d="M38 54 L24 84 L29 87 L42 62 Z" />
        <path d="M62 54 L76 84 L71 87 L58 62 Z" />
        <path d="M36 90 L40 140 L48 140 L50 98 L52 140 L60 140 L64 90 Z" />
        <circle cx="50" cy="36" r="14" />
      </g>
      <g className="ff-strip__face">
        <circle cx="45" cy="35" r="1.8" />
        <circle cx="55" cy="35" r="1.8" />
        <path d="M44 42 Q50 47 56 42" />
      </g>
      <path className="ff-strip__hair ff-strip__hair--plain" d="M36 32 Q37 18 50 18 Q63 18 64 32 Q58 26 50 27 Q42 26 36 32 Z" />
      <path className="ff-strip__hair ff-strip__hair--gold" d="M35 34 L28 14 L40 22 L42 4 L50 18 L58 2 L60 22 L72 12 L65 34 Q58 25 50 26 Q42 25 35 34 Z" />
      <g className="ff-strip__cloth ff-strip__cloth--shirt">
        <path d="M37 52 Q50 47 63 52 L67 92 Q50 97 33 92 Z" />
        <path d="M37 53 L28 70 L35 73 L41 61 Z" />
        <path d="M63 53 L72 70 L65 73 L59 61 Z" />
      </g>
      <g className="ff-strip__cloth ff-strip__cloth--pants">
        <path d="M35 89 L39 132 L48 132 L50 99 L52 132 L61 132 L65 89 Z" />
      </g>
      <g className="ff-strip__cloth ff-strip__cloth--boots">
        <path d="M38 130 L49 130 L49 141 L34 141 Q34 135 38 130 Z" />
        <path d="M51 130 L62 130 Q66 135 66 141 L51 141 Z" />
      </g>
    </svg>
  )
}

export function StripFx({ strip, still, onDone }: { strip: Strip; still: boolean; onDone: () => void }) {
  const { t } = useI18n()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!still && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([30, 40, 30, 40, 30, 40, 300]) } catch { /* not allowed here */ }
    }
  }, [strip.key, still])

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
  // Portalled to <body>: the sheet card's glass blur would otherwise trap a fixed overlay inside the card.
  return createPortal(
    <div className={`ff-strip${still ? ' is-still' : ''}${leaving ? ' is-leaving' : ''}`} role="status" onClick={close} data-testid="strip-fx">
      <div className="ff-strip__stage">
        {!still && (
          <div aria-hidden="true">
            <div className="ff-strip__rays" />
            <div className="ff-strip__clothes">
              {CLOTHES.map((c, i) => (
                <span key={i} style={vars({ '--a': `${-160 + (i * 140) / (CLOTHES.length - 1)}deg`, '--d': `${38 + ((i * 29) % 18)}vmax`, '--r': `${(i % 2 ? 1 : -1) * (360 + i * 90)}deg`, '--i': i })}>{c}</span>
              ))}
            </div>
            <div className="ff-strip__sparks">
              {Array.from({ length: SPARKS }, (_, i) => (
                <span key={i} style={vars({ '--a': `${(i * 360) / SPARKS + ((i * 41) % 13)}deg`, '--d': `${26 + ((i * 47) % 22)}vmax`, '--i': i })} />
              ))}
            </div>
            <svg className="ff-strip__bolt ff-strip__bolt--a" viewBox="0 0 40 100"><path d="M24 0 L6 52 L20 52 L10 100 L36 38 L22 38 L32 0 Z" /></svg>
            <svg className="ff-strip__bolt ff-strip__bolt--b" viewBox="0 0 40 100"><path d="M24 0 L6 52 L20 52 L10 100 L36 38 L22 38 L32 0 Z" /></svg>
            <div className="ff-strip__flash" />
          </div>
        )}
        <div className="ff-strip__core">
          <div className="ff-strip__figure">
            <div className="ff-strip__aura" aria-hidden="true" />
            {!still && (
              <div className="ff-strip__motes" aria-hidden="true">
                {Array.from({ length: MOTES }, (_, i) => (
                  <span key={i} style={vars({ '--x': `${8 + ((i * 53) % 84)}%`, '--i': i, '--s': `${0.9 + ((i * 7) % 6) / 10}s` })} />
                ))}
              </div>
            )}
            <Hero />
            <span className="ff-strip__censor">{t('powerup.fx.censored')}</span>
          </div>
          <strong className="ff-strip__title">{t('powerup.fx.title')}</strong>
          <span className="ff-strip__kicker">{t('powerup.fx.kicker', { name: `\u2068${strip.name}\u2069`, level: strip.level.toLocaleString() })}</span>
          <span className="ff-strip__line">{t(`powerup.line${strip.line}` as MessageKey)}</span>
        </div>
        <span className="ff-strip__hint" aria-hidden="true">{t('dice.crit.tap')}</span>
      </div>
      <button type="button" className="ff-strip__close" onClick={e => { e.stopPropagation(); close() }} aria-label={t('dice.nat20.dismiss')} title={t('dice.nat20.dismiss')}>✕</button>
    </div>,
    document.body,
  )
}

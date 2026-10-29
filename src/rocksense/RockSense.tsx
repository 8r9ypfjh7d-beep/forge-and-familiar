// The "Sense rock" button on a dwarf's character card and its full-screen moment: the screen quakes,
// pebbles fall, the stone wakes up and shares one deeply useless fact. Built like the nat 20 moment (dice/ui/CritFx):
// short, closes itself, any tap, the ✕ or Escape closes it early, and reduce motion keeps a still card with the same words.
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useI18n, type MessageKey } from '../i18n'
import type { Character } from '../model/character'
import { motionReduced } from '../dice/ui/RollFx'
import { canSenseRock, pickFact, pickMoisture, senseOneMoreRock } from './rocksense'
import './rock.css'

const ROCK_MS = 8000
const LEAVE_MS = 320
const PEBBLES = 22
const DUST = 9
const RINGS = 3

interface Sensing {
  key: number
  fact: number
  moisture: number
  count: number
}

const vars = (v: Record<string, string | number>) => v as CSSProperties

/** A lumpy boulder with moss, cracks, a sleepy face that wakes up, and one drop of moisture. */
function Boulder() {
  return (
    <svg className="ff-rock__boulder" viewBox="0 0 120 100" aria-hidden="true">
      <defs>
        <radialGradient id="ff-rock-stone" cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#b9b2a6" />
          <stop offset="0.55" stopColor="#857d71" />
          <stop offset="1" stopColor="#4d473f" />
        </radialGradient>
      </defs>
      <path className="ff-rock__body" d="M14 78 Q6 60 16 44 Q22 24 44 18 Q60 10 78 18 Q100 24 108 46 Q116 66 104 80 Q92 94 60 94 Q26 94 14 78 Z" />
      <path className="ff-rock__moss" d="M40 20 Q52 12 66 15 Q76 17 80 22 Q70 20 62 24 Q52 20 40 20 Z" />
      <path className="ff-rock__crack" d="M88 30 L82 42 L90 50 L84 62 M24 58 L32 64 L28 74" />
      <g className="ff-rock__face">
        <ellipse className="ff-rock__eye" cx="46" cy="56" rx="5" ry="6" />
        <ellipse className="ff-rock__eye" cx="72" cy="56" rx="5" ry="6" />
        <path className="ff-rock__mouth" d="M52 74 Q59 78 66 74" />
      </g>
      <path className="ff-rock__drop" d="M96 52 Q100 60 96 63 Q92 60 96 52 Z" />
    </svg>
  )
}

function RockFx({ sensing, still, onDone }: { sensing: Sensing; still: boolean; onDone: () => void }) {
  const { t } = useI18n()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const auto = window.setTimeout(() => setLeaving(true), ROCK_MS)
    if (!still && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([90, 40, 90, 40, 220]) } catch { /* not allowed here */ }
    }
    return () => clearTimeout(auto)
  }, [sensing.key, still])

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
    <div className={`ff-rock${still ? ' is-still' : ''}${leaving ? ' is-leaving' : ''}`} role="status" onClick={close} data-testid="rock-fx">
      <div className="ff-rock__stage">
        {!still && (
          <div aria-hidden="true">
            {Array.from({ length: RINGS }, (_, i) => <span key={i} className="ff-rock__ring" style={vars({ '--i': i })} />)}
            <div className="ff-rock__pebbles">
              {Array.from({ length: PEBBLES }, (_, i) => (
                <span key={i} style={vars({ '--x': `${(i * 389) % 100}%`, '--i': i, '--r': `${(i * 67) % 360}deg`, '--z': 0.5 + ((i * 7) % 6) / 6 })} />
              ))}
            </div>
            <div className="ff-rock__dust">
              {Array.from({ length: DUST }, (_, i) => <span key={i} style={vars({ '--x': `${6 + i * 11}%`, '--i': i })} />)}
            </div>
          </div>
        )}
        <div className="ff-rock__core">
          <Boulder />
          <strong className="ff-rock__title">{t('rock.title')}</strong>
          <span className="ff-rock__kicker">{t('rock.kicker')}</span>
          <span className="ff-rock__fact">{t(`rock.fact${sensing.fact}` as MessageKey)}</span>
          <dl className="ff-rock__report">
            <div><dt>{t('rock.age')}</dt><dd>{t('rock.ageValue')}</dd></div>
            <div><dt>{t('rock.moisture')}</dt><dd>{t(`rock.moist${sensing.moisture}` as MessageKey)}</dd></div>
            <div><dt>{t('rock.usefulness')}</dt><dd dir="ltr">0%</dd></div>
          </dl>
          <span className="ff-rock__count">{t('rock.count', { count: sensing.count })}</span>
        </div>
        <span className="ff-rock__hint" aria-hidden="true">{t('dice.crit.tap')}</span>
      </div>
      <button type="button" className="ff-rock__close" onClick={e => { e.stopPropagation(); close() }} aria-label={t('dice.nat20.dismiss')} title={t('dice.nat20.dismiss')}>✕</button>
    </div>
  )
}

/** Shows nothing unless the character can sense rocks (see canSenseRock). */
export function RockSenseButton({ character }: { character: Character }) {
  const { t } = useI18n()
  const [sensing, setSensing] = useState<Sensing | null>(null)
  const [lastFact, setLastFact] = useState<number | undefined>()
  const done = useCallback(() => setSensing(null), [])
  if (!canSenseRock(character)) return null

  const sense = () => {
    const fact = pickFact(lastFact)
    setLastFact(fact)
    setSensing({ key: Date.now(), fact, moisture: pickMoisture(), count: senseOneMoreRock(character.id) })
  }
  return (
    <>
      <button type="button" className="btn cs-rock" onClick={sense} title={t('rock.buttonTitle')}>
        <span aria-hidden="true">🪨</span> {t('rock.button')}
      </button>
      {sensing && typeof document !== 'undefined' && createPortal(
        <RockFx key={sensing.key} sensing={sensing} still={motionReduced()} onDone={done} />,
        document.body,
      )}
    </>
  )
}

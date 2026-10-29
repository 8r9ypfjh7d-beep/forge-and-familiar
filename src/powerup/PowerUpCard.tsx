// The sheet card for Tamir's characters: strip to power up, get dressed to end it.
import { useCallback, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import type { Apply } from '../sheet/types'
import { pickLine } from '../dice/fx'
import { motionReduced } from '../dice/ui/RollFx'
import { bumpStripCount, getDressed, isPoweredUp, powerLevel, powerUp, stripCount, STRIP_LINES } from './powerup'
import { StripFx, type Strip } from './StripFx'
import './powerup.css'

export function PowerUpCard({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const on = isPoweredUp(character)
  const [times, setTimes] = useState(() => stripCount(character.id))
  const [strip, setStrip] = useState<Strip | null>(null)
  const lastLine = useRef(0)

  const go = () => {
    const n = bumpStripCount(character.id)
    setTimes(n)
    lastLine.current = pickLine(Math.random, STRIP_LINES, lastLine.current)
    setStrip({ key: Date.now(), name: character.name, level: powerLevel(n), line: lastLine.current })
    if (!on) apply(t('powerup.log.strip'), c => powerUp(c, t('powerup.effectName'), t('powerup.effectDesc')))
  }
  const done = useCallback(() => setStrip(null), [])

  return (
    <section className={`card powerup${on ? ' is-on' : ''}`} aria-labelledby="powerup-title">
      <div className="powerup-head">
        <span className="powerup-icon" aria-hidden="true">{on ? '🔥' : '👕'}</span>
        <div className="powerup-text">
          <h2 id="powerup-title">{t('powerup.title')}</h2>
          <p className="hint">{on ? t('powerup.on') : t('powerup.hint')}</p>
        </div>
        <div className="powerup-actions">
          <button type="button" className="btn primary" onClick={go}>{t(on ? 'powerup.again' : 'powerup.strip')}</button>
          {on && <button type="button" className="btn" onClick={() => apply(t('powerup.log.dress'), getDressed)}>{t('powerup.dress')}</button>}
        </div>
      </div>
      {on && <p className="powerup-buffs">{t('powerup.buffs')}</p>}
      {times > 0 && <p className="hint powerup-count">{t('powerup.count', { n: times })}</p>}
      {strip && <StripFx key={strip.key} strip={strip} still={motionReduced()} onDone={done} />}
    </section>
  )
}

import { useI18n, type MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import { setExhaustion } from '../engine'
import type { Apply } from '../types'

const EFFECTS = [0, 1, 2, 3, 4, 5, 6].map(i => `sheet.exhaustion.${i}` as MessageKey)

export function Exhaustion({ character, apply }: { character: Character; apply: Apply }) {
  const level = character.state.exhaustion
  const { t } = useI18n()
  return (
    <section className="card" aria-labelledby="ex-title">
      <h2 id="ex-title">{t('sheet.exhaustion')}</h2>
      <div className="segmented" role="radiogroup" aria-label={t('sheet.exhaustion.level')}>
        {EFFECTS.map((_, i) => (
          <button key={i} type="button" role="radio" aria-checked={level === i} className={level === i ? 'on' : ''}
            onClick={() => apply(t('sheet.exhaustion.set', { level: i }), c => setExhaustion(c, i))}>{i}</button>
        ))}
      </div>
      <p className="hint">{level ? t('sheet.exhaustion.summary', { level, effects: EFFECTS.slice(1, level + 1).map(k => t(k)).join('; ') }) : t(EFFECTS[0])}</p>
    </section>
  )
}

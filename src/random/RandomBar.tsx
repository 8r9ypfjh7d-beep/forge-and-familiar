import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { randomHookKey } from './generate'
import { randomName } from './names'
import './random.css'

/** "Random character" strip at the top of a new character's builder. */
export function RandomCharacter({ onRoll }: { onRoll: () => void }) {
  const { t } = useI18n()
  return (
    <div className="random-bar">
      <button className="glass-btn" onClick={onRoll}>🎲 {t('random.character')}</button>
      <span className="muted small">{t('random.characterHint')}</span>
    </div>
  )
}

/** Dice button next to the name field. */
export function RandomName({ raceId, onName }: { raceId: string; onName: (name: string) => void }) {
  const { t } = useI18n()
  return (
    <button type="button" className="glass-btn small random-name" title={t('random.name')} aria-label={t('random.name')} onClick={() => onName(randomName(raceId))}>
      🎲
    </button>
  )
}

/** A backstory hook on the Details step; it becomes the new character's story notes. */
export function BackstoryHook({ hookKey, setHookKey }: { hookKey?: string; setHookKey: (k?: string) => void }) {
  const { t } = useI18n()
  return (
    <div className="field random-hook">
      <label>{t('random.hook')}</label>
      {hookKey && <p className="random-hook-text" dir="auto">{t(hookKey as MessageKey)}</p>}
      <div className="row">
        <button type="button" className="glass-btn small" onClick={() => setHookKey(randomHookKey())}>🎲 {t(hookKey ? 'random.hookAgain' : 'random.hookRoll')}</button>
        {hookKey && <button type="button" className="glass-btn small" onClick={() => setHookKey(undefined)}>{t('common.remove')}</button>}
      </div>
      <p className="muted small">{t('random.hookHint')}</p>
    </div>
  )
}

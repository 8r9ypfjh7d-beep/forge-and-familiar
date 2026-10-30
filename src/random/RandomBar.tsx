import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { randomHookKey } from './generate'
import { randomName } from './names'
import './random.css'

/**
 * "Random character" strip at the top of a new character's builder. With `ask`, it first asks in an in-app
 * glass dialog whether to replace the player's picks.
 */
export function RandomCharacter({ onRoll, ask, busy }: { onRoll: () => void; ask: boolean; busy?: boolean }) {
  const { t } = useI18n()
  const [asking, setAsking] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (asking && !d.open) d.showModal?.()
    if (!asking && d.open) d.close()
  }, [asking])
  const roll = () => { setAsking(false); onRoll() }
  return (
    <div className="random-bar">
      <button className="glass-btn" disabled={busy} aria-busy={busy} onClick={() => (ask ? setAsking(true) : onRoll())}>
        🎲 {t(busy ? 'random.rolling' : 'random.character')}
      </button>
      <span className="muted small">{t('random.characterHint')}</span>
      <dialog ref={ref} className="random-dialog glass-sheet glass-dialog" aria-labelledby="random-dialog-title" onCancel={e => { e.preventDefault(); setAsking(false) }}>
        {asking && (
          <>
            <h2 id="random-dialog-title">{t('random.replace')}</h2>
            <p className="muted">{t('random.replaceHint')}</p>
            <div className="random-dialog-actions">
              <button type="button" className="glass-btn prominent" onClick={roll}>🎲 {t('random.replaceYes')}</button>
              <button type="button" className="glass-btn" onClick={() => setAsking(false)}>{t('random.replaceNo')}</button>
            </div>
          </>
        )}
      </dialog>
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

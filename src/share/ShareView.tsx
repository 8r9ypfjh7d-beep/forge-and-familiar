import { useEffect, useState } from 'react'
import type { Character } from '../model/character'
import { useI18n } from '../i18n'
import { PrintPages } from '../print'
import { decodeCharacter, type Decoded } from './link'
import './share.css'

/**
 * The page a share link opens instead of the app: the character's sheet, read only, with no account,
 * storage or sync. Nothing here is saved on the viewer's device.
 */
export function ShareView({ code }: { code: string }) {
  const { t } = useI18n()
  const [result, setResult] = useState<Decoded | null>(null)
  const [withPlayState, setWithPlayState] = useState(true)

  useEffect(() => {
    decodeCharacter(code).then(setResult)
  }, [code])

  const character: Character | undefined = result?.ok ? result.character : undefined
  useEffect(() => {
    if (!character) return
    const title = document.title
    document.title = `${character.name} · Forge & Familiar`
    return () => { document.title = title }
  }, [character])

  const openApp = () => location.replace(`${location.pathname}${location.search}`)

  return (
    <div className="share-page">
      <header className="glass share-bar">
        <div>
          <p className="glass-eyebrow">{t('share.readOnly')}</p>
          <h1 className="glass-title">{character ? character.name : 'Forge & Familiar'}</h1>
        </div>
        <div className="share-actions">
          {character && (
            <label className="share-toggle small">
              <input type="checkbox" checked={withPlayState} onChange={e => setWithPlayState(e.target.checked)} />
              {t('share.playState')}
            </label>
          )}
          {character && <button type="button" className="glass-btn" onClick={() => window.print()}>{t('list.print')}</button>}
          <button type="button" className="glass-btn prominent" onClick={openApp}>{t('share.openApp')}</button>
        </div>
      </header>
      {result === null && <p className="muted">{t('share.loading')}</p>}
      {result && !result.ok && (
        <div className="glass share-error" role="alert">
          <p>{t(result.error === 'unknown' ? 'share.error.unknown' : 'share.error.broken')}</p>
        </div>
      )}
      {character && <PrintPages character={character} withPlayState={withPlayState} />}
    </div>
  )
}

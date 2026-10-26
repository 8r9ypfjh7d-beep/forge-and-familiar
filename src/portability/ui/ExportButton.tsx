import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { exportToFile } from '../actions'
import './portability.css'

/** "Export" button that downloads the character (with its snapshots) as a file ImportButton accepts. */
export function ExportButton({ character, className = 'btn small' }: { character: Character; className?: string }) {
  const [error, setError] = useState(false)
  const { t } = useI18n()

  const run = async () => {
    setError(false)
    try {
      await exportToFile(character)
    } catch {
      setError(true)
    }
  }

  return (
    <span className="ff-import">
      <button type="button" className={className} onClick={run} aria-label={`${t('list.export')}: ${character.name}`} title={t('list.exportHint')}>
        ⤓ {t('list.export')}
      </button>
      {error && <span role="alert" className="bad small">{t('levels.error')}</span>}
    </span>
  )
}

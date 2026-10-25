import { useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { importFromFile } from '../actions'
import './portability.css'

/** "Import" button that reads a character file and saves it for this player. */
export function ImportButton({ ownerId, onImported }: { ownerId: string; onImported: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { t } = useI18n()

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const c = await importFromFile(file, ownerId)
      onImported(c.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('levels.importError'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <span className="ff-import">
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={e => pick(e.target.files?.[0])}
      />
      <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? t('levels.importing') : t('levels.import')}
      </button>
      {error && <span role="alert" className="bad small">{error}</span>}
    </span>
  )
}

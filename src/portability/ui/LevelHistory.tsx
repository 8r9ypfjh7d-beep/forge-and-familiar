import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { getCharacter, onCharactersChanged } from '../../storage'
import { exportToFile, rollBack } from '../actions'
import { takeSnapshot, totalLevel, type Snapshot } from '../snapshots'
import { addSnapshots, deleteSnapshot, listSnapshots } from '../store'
import './portability.css'

/** Save level snapshots, roll back to one, and export the character to a file. */
export function LevelHistory({ characterId, onBack, onOpenSheet }: {
  characterId: string
  onBack: () => void
  onOpenSheet: (id: string) => void
}) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [snaps, setSnaps] = useState<Snapshot[]>([])
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const { t, classLine, date: when } = useI18n()

  const load = useCallback(async () => {
    setCharacter((await getCharacter(characterId)) ?? null)
    setSnaps(await listSnapshots(characterId))
  }, [characterId])

  useEffect(() => {
    load()
    return onCharactersChanged(id => { if (!id || id === characterId) load() })
  }, [characterId, load])

  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work()
      setMessage({ text: done })
    } catch (e) {
      const full = e instanceof DOMException && e.name === 'QuotaExceededError'
      setMessage({ bad: true, text: full ? t('levels.storageFull') : e instanceof Error ? e.message : t('levels.error') })
    }
    await load()
  }

  if (character === undefined) return <p className="muted">{t('common.loading')}</p>
  if (character === null) {
    return (
      <section className="glass empty">
        <p>{t('common.notFound')}</p>
        <button type="button" className="glass-btn" onClick={onBack}>{t('common.back')}</button>
      </section>
    )
  }

  const save = () => run(async () => {
    await addSnapshots([takeSnapshot(character, label)])
    setLabel('')
  }, t('levels.saved'))

  return (
    <section className="ff-levels">
      <div className="row spread">
        <div className="row">
          <button type="button" className="glass-btn icon" onClick={onBack} aria-label={t('common.backToCharacters')}>{t('common.backArrow')}</button>
          <div>
            <h2>{t('levels.title', { name: character.name })}</h2>
            <p className="muted small">{t('levels.now', { level: totalLevel(character), classes: classLine(character.classes) })}</p>
          </div>
        </div>
        <div className="row">
          <button type="button" className="glass-btn" onClick={() => onOpenSheet(character.id)}>{t('common.openSheet')}</button>
          <button type="button" className="glass-btn" onClick={() => run(() => exportToFile(character), t('levels.downloaded'))}>
            {t('levels.export')}
          </button>
        </div>
      </div>

      <form className="glass row" onSubmit={e => { e.preventDefault(); save() }}>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={t('levels.levelN', { level: totalLevel(character) })}
          aria-label={t('levels.snapshotName')}
          maxLength={60}
        />
        <button className="glass-btn prominent">{t('levels.save')}</button>
        <span className="muted small">{t('levels.saveHint')}</span>
      </form>

      {message && <p role="status" className={`small ${message.bad ? 'bad' : 'good'}`}>{message.text}</p>}

      {snaps.length === 0 ? (
        <div className="glass empty"><p>{t('levels.empty')}</p></div>
      ) : (
        <ol className="plain ff-snaps">
          {snaps.map(s => (
            <li key={s.id} className="glass">
              <div>
                <h3>{s.label}</h3>
                <p className="muted small">{t('levels.line', { level: s.level, classes: classLine(s.character.classes), when: when(s.takenAt) })}</p>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="glass-btn small"
                  onClick={() => confirm(t('levels.confirmRollBack', { name: character.name, label: s.label }))
                    && run(() => rollBack(s), t('levels.rolledBack', { label: s.label }))}
                >
                  {t('levels.rollBack')}
                </button>
                <button
                  type="button"
                  className="glass-btn small"
                  onClick={() => confirm(t('levels.confirmDelete', { label: s.label })) && run(() => deleteSnapshot(characterId, s.id), t('levels.deleted'))}
                >
                  {t('common.delete')}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small">{t('levels.footnote')}</p>
    </section>
  )
}

import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { setNotes } from '../engine'
import type { Apply } from '../types'

/** Free-text notes. Saved (and added to the history) when the box loses focus, not on every key. */
export function Notes({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const [text, setText] = useState(character.notes)
  const [editing, setEditing] = useState(false)
  const [seen, setSeen] = useState(character.notes)
  // Pick up notes changed elsewhere (builder, another tab) unless the player is typing.
  if (seen !== character.notes && !editing) { setSeen(character.notes); setText(character.notes) }
  const save = () => {
    setEditing(false)
    if (text !== character.notes) apply(t('sheet.story.notesSaved'), c => setNotes(c, text))
  }
  return (
    <section className="card story-notes" aria-labelledby="notes-title">
      <h2 id="notes-title"><label htmlFor="story-notes-box">{t('sheet.story.notes')}</label></h2>
      <textarea id="story-notes-box" value={text} rows={6} placeholder={t('sheet.story.notesPlaceholder')}
        onFocus={() => setEditing(true)} onChange={e => setText(e.target.value)} onBlur={save} />
    </section>
  )
}

import { useState, type ReactNode } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { derive, getBackground } from '../../rules'
import { setNotes } from '../engine'
import type { Apply } from '../types'

/**
 * Story mode's top card: hit points and rests, with who the character is as one small line
 * (race, background, alignment, languages) and their traits and features folded away.
 */
export function Identity({ character, vitals }: { character: Character; vitals: ReactNode }) {
  const { t, term, raceName } = useI18n()
  const d = derive(character)
  const bg = getBackground(character)
  const facts = [
    raceName(character.raceId, character.subraceId),
    bg && term('background', bg.id, bg.name),
    character.alignment && term('alignment', character.alignment, character.alignment),
    d.languages.length > 0 && d.languages.map(x => term('language', x, x)).join(', '),
  ].filter(Boolean)
  const tags = [
    ...(bg?.feature ? [term('feature', bg.feature, bg.feature)] : []),
    ...d.traits.map(x => term('trait', x, x)),
    ...d.features.map(f => term('feature', f.name, f.name)),
    ...d.feats.map(x => term('feat', x, x)),
  ]
  return (
    <section className="card story-top" aria-label={t('sheet.story.identity')}>
      <div className="story-vitals">{vitals}</div>
      <div className="story-who">
        <p className="story-facts">{facts.join(' · ')}</p>
        {tags.length > 0 && (
          <details className="story-more">
            <summary>{t('sheet.story.traitsFeatures')}</summary>
            <ul className="story-tags">{[...new Set(tags)].map(x => <li key={x}>{x}</li>)}</ul>
          </details>
        )}
      </div>
    </section>
  )
}

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

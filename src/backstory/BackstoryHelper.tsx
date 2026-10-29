import { useState } from 'react'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { getBackground } from '../rules'
import { setNotes } from '../sheet/engine'
import type { Apply } from '../sheet/types'
import { PHRASES } from './phrases'
import { backstoryText, draftBackstory, withBackstory } from './draft'
import './backstory.css'

const newSeed = () => Math.floor(Math.random() * 2 ** 31)

/** "Draft a backstory" inside the Notes card: shows a draft, rerolls it, and adds it below the notes. */
export function BackstoryHelper({ character, apply }: { character: Character; apply: Apply }) {
  const { t, locale, raceName, className, term } = useI18n()
  const [seed, setSeed] = useState<number | null>(null)
  if (seed === null) {
    return (
      <button type="button" className="btn backstory-open" onClick={() => setSeed(newSeed())}>
        {t('backstory.open')}
      </button>
    )
  }
  const bg = getBackground(character)
  const draft = draftBackstory(character, {
    race: raceName(character.raceId, character.subraceId, character.rulesEdition),
    cls: className(character.classes[0]?.classId ?? ''),
    bg: bg ? term('background', bg.id, bg.name) : t('backstory.unknownBg'),
  }, locale, seed)
  const text = backstoryText(draft, locale)
  const l = PHRASES[locale].labels
  const add = () => {
    apply(t('backstory.added'), c => setNotes(c, withBackstory(c.notes, text)))
    setSeed(null)
  }
  return (
    <div className="backstory" role="group" aria-labelledby="backstory-title">
      <h3 id="backstory-title" className="glass-eyebrow">{t('backstory.title')}</h3>
      <div className="backstory-draft" aria-live="polite">
        {draft.story.map((para, i) => <p key={i}>{para}</p>)}
        <dl>
          <dt>{l.personality}</dt><dd>{draft.personality}</dd>
          <dt>{l.ideal}</dt><dd>{draft.ideal}</dd>
          <dt>{l.bond}</dt><dd>{draft.bond}</dd>
          <dt>{l.flaw}</dt><dd>{draft.flaw}</dd>
          <dt>{l.hook}</dt><dd>{draft.hook}</dd>
        </dl>
      </div>
      <p className="hint">{t('backstory.hint')}</p>
      <div className="backstory-actions">
        <button type="button" className="btn primary" onClick={add}>{t('backstory.add')}</button>
        <button type="button" className="btn" onClick={() => setSeed(s => (s ?? 0) + 1)}>{t('backstory.another')}</button>
        <button type="button" className="btn ghost" onClick={() => setSeed(null)}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}

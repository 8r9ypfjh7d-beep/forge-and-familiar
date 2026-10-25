import { useState } from 'react'
import { ShowMath } from '../../explain/ShowMath'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { derive, formatMod, getBackground, type SkillId } from '../../rules'
import { setNotes } from '../engine'
import type { Apply } from '../types'

/** Skills that come up most when talking, sneaking and looking around. */
const SOCIAL_SKILLS: SkillId[] = ['insight', 'persuasion', 'deception', 'intimidation', 'performance', 'perception', 'investigation', 'stealth']

/** Who the character is: race, background and its feature, alignment, languages, tools, traits and features. */
export function Identity({ character }: { character: Character }) {
  const { t, term, raceName } = useI18n()
  const d = derive(character)
  const bg = getBackground(character)
  const list = (kind: string, xs: string[]) => xs.map(x => term(kind, x, x)).join(', ') || t('common.none')
  return (
    <section className="card story-identity" aria-labelledby="identity-title">
      <h2 id="identity-title">{t('sheet.story.identity')}</h2>
      <dl className="story-facts">
        <div><dt>{t('sheet.story.race')}</dt><dd>{raceName(character.raceId, character.subraceId)}</dd></div>
        {bg && <div><dt>{t('builder.background')}</dt><dd>{term('background', bg.id, bg.name)}</dd></div>}
        {character.alignment && <div><dt>{t('builder.alignment')}</dt><dd>{term('alignment', character.alignment, character.alignment)}</dd></div>}
        <div><dt>{t('builder.languagesTitle')}</dt><dd>{list('language', d.languages)}</dd></div>
        {d.tools.length > 0 && <div><dt>{t('builder.toolsTitle')}</dt><dd>{list('tool', d.tools)}</dd></div>}
      </dl>
      {bg?.feature && (
        <p className="story-feature"><strong>{t('sheet.story.bgFeature')}</strong> {term('feature', bg.feature, bg.feature)}</p>
      )}
      {(d.traits.length > 0 || d.features.length > 0 || d.feats.length > 0) && (
        <details className="story-more">
          <summary>{t('sheet.story.traitsFeatures')}</summary>
          <ul className="story-tags">
            {d.traits.map(x => <li key={`t-${x}`}>{term('trait', x, x)}</li>)}
            {d.features.map(f => <li key={`f-${f.className}-${f.level}-${f.name}`}>{term('feature', f.name, f.name)}</li>)}
            {d.feats.map(x => <li key={`ft-${x}`}>{term('feat', x, x)}</li>)}
          </ul>
        </details>
      )}
    </section>
  )
}

/** The skills a scene usually calls for, with passive perception up front. */
export function SocialSkills({ character }: { character: Character }) {
  const { t, skill } = useI18n()
  const d = derive(character)
  return (
    <section className="card story-skills" aria-labelledby="social-title">
      <div className="card-head">
        <h2 id="social-title">{t('sheet.story.skills')}</h2>
        <span className="hint">{t('stat.passivePerception')} <ShowMath character={character} stat="passivePerception">{d.passivePerception}</ShowMath></span>
      </div>
      <ul className="story-skill-list">
        {SOCIAL_SKILLS.map(s => (
          <li key={s} className={d.skills[s].proficient ? 'prof' : ''}>
            <span>{skill(s)}</span>
            <span dir="ltr"><ShowMath character={character} stat={`skill:${s}`}>{formatMod(d.skills[s].bonus)}</ShowMath></span>
          </li>
        ))}
      </ul>
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

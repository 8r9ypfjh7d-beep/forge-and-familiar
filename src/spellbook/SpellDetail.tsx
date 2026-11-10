// One spell's details, shared by the Spells tab rows and the Library page.
import { BOOK_TITLES, type Spell } from '../content'
import { useI18n } from '../i18n'
import { Markdown } from '../rulesqa/Markdown'
import './spellbook.css'

/** A spell's casting line and full text (Hebrew summary where we have one). Also used by the Library page. */
export function SpellDetail({ spell: s }: { spell: Spell }) {
  const { t, locale, dir, spellMeasure } = useI18n()
  const he = locale === 'he' && !!s.descriptionHe
  const comps = [s.components.v && 'V', s.components.s && 'S', s.components.m && 'M'].filter(Boolean).join(', ')
  return (
    <div className="sb-detail" lang="en" dir="ltr">
      <dl lang={locale} dir={dir}>
        <div><dt>{t('spells.castingTime')}</dt><dd>{spellMeasure(s.castingTime)}</dd></div>
        <div><dt>{t('spells.range')}</dt><dd>{spellMeasure(s.range)}</dd></div>
        <div><dt>{t('spells.components')}</dt><dd><bdi lang="en">{comps}{s.components.material ? ` (${s.components.material})` : ''}</bdi></dd></div>
        <div><dt>{t('spells.duration')}</dt><dd>{s.concentration ? `${t('spells.concentration')}, ` : ''}{spellMeasure(s.duration)}</dd></div>
      </dl>
      {he
        ? <p className="sb-summary" lang="he" dir="rtl">{s.descriptionHe}</p>
        : <Markdown text={s.description} />}
      {s.book && <p className="hint sb-book-note" lang={locale} dir={dir}>{t('spells.bookNote', { book: BOOK_TITLES[s.book] ?? s.book })}</p>}
      {s.higherLevels && <><h4>{t('spells.higher')}</h4><Markdown text={s.higherLevels} /></>}
    </div>
  )
}

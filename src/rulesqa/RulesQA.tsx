import { useEffect, useMemo, useState } from 'react'
import { AskFamiliar } from '../familiar/ui/AskFamiliar'
import { clearRulesQuestion, onRulesQuestion, pendingRulesQuestion } from './handoff'
import { useI18n } from '../i18n'
import { Markdown } from './Markdown'
import { SearchField } from './SearchField'
import { loadRules } from './load'
import { answer, breadcrumb, excerpt, type RulesIndex } from './search'
import type { Answer, Passage } from './types'
import { exactHit, hitKey, isHebrew, isQuestion, LIB_KINDS, searchAll, searchKind, type LibKind, type LibMode } from './library'
import { KIND_LABEL, LibraryList, srdAttribution, useAlias, useLibrary, useLibraryEdition } from './LibraryView'
import './rulesqa.css'

const EXAMPLES = [
  'When do I get an opportunity attack?',
  'What happens when I drop to 0 HP?',
  'Can I cast two spells in one turn?',
  'How does grappling work?',
  'What does a long rest restore?',
  'Can I dual wield?',
]

/** Most rows a list shows; typing narrows it. */
const MAX_ROWS = 60

/**
 * The Library: one search over spells, items, monsters (DM only), conditions and feats by name, plus the rules Q&A
 * (a plain-words question answered with a quote from the SRD 5.1 and its section).
 */
export function RulesQA({ isDm = false }: { isDm?: boolean }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<LibMode>('all')
  const [edition, setEdition] = useLibraryEdition()
  const library = useLibrary(edition, isDm)
  const alias = useAlias()
  const kinds = isDm ? LIB_KINDS : LIB_KINDS.filter(k => k !== 'monsters')
  const [rules, setRules] = useState<{ index: RulesIndex; source: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [asked, setAsked] = useState('')
  const [result, setResult] = useState<Answer | null>(null)
  const [open, setOpen] = useState<Passage | null>(null)
  const [full, setFull] = useState(false)

  useEffect(() => { loadRules().then(setRules) }, [])
  // A question handed over from the Familiar (offline): asked as soon as the rules are loaded.
  const [handed, setHanded] = useState(pendingRulesQuestion)
  useEffect(() => onRulesQuestion(() => setHanded(pendingRulesQuestion())), [])
  useEffect(() => {
    if (!rules || !handed) return
    clearRulesQuestion()
    setHanded('')
    ask(handed)
  }, [rules, handed]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (q: string) => {
    const question = q.trim()
    if (!isQuestion(question) || !rules) return
    if (mode !== 'all' && mode !== 'rules') setMode('all')
    setDraft(question)
    setAsked(question)
    setResult(answer(rules.index, question))
    setOpen(null)
    setFull(false)
  }

  const edit = (text: string) => {
    setDraft(text)
    // Clearing the field brings the examples back.
    if (!text.trim()) { setResult(null); setAsked('') }
  }

  const lib = library && library !== 'error' ? library : null
  const hits = useMemo(() => {
    if (!lib || mode === 'rules') return []
    return mode === 'all' ? searchAll(lib, draft, alias, kinds) : searchKind(lib, mode, draft, alias)
  }, [lib, mode, draft, alias, kinds.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const exact = asked && mode === 'all' ? exactHit(hits, asked, alias) : undefined
  const hebrew = isHebrew(asked)
  const rulesShown = (mode === 'all' || mode === 'rules') && !hebrew

  const shown = open ?? result?.best?.passage ?? null
  const quote = shown && rules ? (open ? excerpt(rules.index, open, asked) : result!.excerpt) : ''
  const chips: LibMode[] = ['all', 'rules', ...kinds]

  return (
    <section className="ff-rulesqa">
      <h2 className="glass-title">{t('rulesqa.title')}</h2>
      <p className="intro">{t('rulesqa.intro')}</p>

      <form className="ask" onSubmit={e => { e.preventDefault(); ask(draft) }}>
        <SearchField
          dir="auto"
          value={draft}
          onChange={e => edit(e.target.value)}
          placeholder={t(mode === 'all' || mode === 'rules' ? 'rulesqa.placeholder' : 'library.find')}
          aria-label={t('rulesqa.question')}
          autoFocus
        />
        {(mode === 'all' || mode === 'rules') && <button className="glass-btn prominent" disabled={!rules || !isQuestion(draft)}>{t('rulesqa.ask')}</button>}
      </form>

      <div className="lib-modes">
        <div className="lib-chips" role="group" aria-label={t('library.show')}>
          {chips.map(m => (
            <button key={m} type="button" className={`glass-chip${mode === m ? ' on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {t(m === 'all' ? 'library.all' : m === 'rules' ? 'library.rules' : KIND_LABEL[m as LibKind])}
            </button>
          ))}
        </div>
        {mode !== 'rules' && (
          <div className="glass-segmented lib-edition" role="group" aria-label={t('library.edition')}>
            {(['2014', '2024'] as const).map(e => <button key={e} type="button" aria-pressed={edition === e} onClick={() => setEdition(e)}>{e}</button>)}
          </div>
        )}
      </div>

      {library === 'error' && mode !== 'rules' && <p className="muted small">{t('library.error')}</p>}

      {exact && <LibraryList hits={[exact]} alias={alias} showKind openKey={hitKey(exact)} />}

      {mode === 'all' && hits.length > 0 && (!exact || hits.length > 1) && (
        <div className="related lib-matches">
          <h3 className="glass-eyebrow">{t('library.inLibrary')}</h3>
          <LibraryList hits={(exact ? hits.filter(h => h !== exact) : hits).slice(0, 8)} alias={alias} showKind />
        </div>
      )}

      {mode !== 'all' && mode !== 'rules' && (
        library === null ? <p className="muted small">{t('library.loading')}</p>
          : hits.length === 0 ? <p className="muted small">{t('library.none')}</p>
            : <>
              <LibraryList key={mode} hits={hits.slice(0, MAX_ROWS)} alias={alias} />
              {hits.length > MAX_ROWS && <p className="muted small lib-more">{t('library.more', { n: hits.length })}</p>}
            </>
      )}

      {(mode === 'all' || mode === 'rules') && !result && !draft.trim() && (
        <div className="examples" lang="en" dir="ltr" aria-label={t('rulesqa.examples')}>
          {EXAMPLES.map(q => <button key={q} className="glass-chip" onClick={() => ask(q)} disabled={!rules}>{q}</button>)}
        </div>
      )}

      {result && hebrew && (mode === 'all' || mode === 'rules') && (
        <div className="glass thick answer">
          <p>{t('rulesqa.hebrew')}</p>
          <AskFamiliar prompt={asked} />
        </div>
      )}

      {rulesShown && result && !shown && (
        <div className="glass thick answer">
          <p><strong>{t('rulesqa.notCovered')}</strong> {t('rulesqa.notCoveredHint')}</p>
          {/flank/i.test(asked) && <p className="muted small">{t('rulesqa.flanking')}</p>}
        </div>
      )}

      {rulesShown && result && shown && (
        <article className="glass thick answer" aria-live="polite">
          {result.weak && !open && (
            <p className="hedge small">{t('rulesqa.weak')}</p>
          )}
          <p className="crumb glass-eyebrow" lang="en" dir="ltr">{breadcrumb(shown)}</p>
          <blockquote lang="en" dir="ltr"><Markdown text={quote} /></blockquote>
          <div className="actions">
            <button className="glass-btn small" onClick={() => setFull(f => !f)} aria-expanded={full}>
              {full ? t('rulesqa.hideFull') : t('rulesqa.readFull')}
            </button>
            {open && <button className="link small" onClick={() => { setOpen(null); setFull(false) }}>{t('rulesqa.backToBest')}</button>}
            <AskFamiliar prompt={asked} label={t('rulesqa.askFamiliar')} />
          </div>
          {full && <div className="full" lang="en" dir="ltr"><Markdown text={shown.text} /></div>}
        </article>
      )}

      {rulesShown && result && result.related.length > 0 && (
        <div className="related">
          <h3 className="glass-eyebrow">{t('rulesqa.related')}</h3>
          <ul className="glass glass-list" lang="en" dir="ltr">
            {[result.best!, ...result.related].filter(h => h.passage !== shown).map(h => (
              <li key={h.passage.id}>
                <button className="related-row" onClick={() => { setOpen(h.passage); setFull(false) }}>
                  <span>{breadcrumb(h.passage)}</span>
                  <svg className="chevron" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="source" lang="en" dir="ltr">
        {(mode === 'all' || mode === 'rules') && rules?.source}
        {mode !== 'rules' && <>{(mode === 'all' && rules) ? ' ' : ''}{srdAttribution(edition)}</>}
      </p>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { Markdown } from './Markdown'
import { SearchField } from './SearchField'
import { loadRules } from './load'
import { answer, breadcrumb, excerpt, type RulesIndex } from './search'
import type { Answer, Passage } from './types'
import './rulesqa.css'

const EXAMPLES = [
  'When do I get an opportunity attack?',
  'What happens when I drop to 0 HP?',
  'Can I cast two spells in one turn?',
  'How does grappling work?',
  'What does a long rest restore?',
  'Can I dual wield?',
]

/** Ask a rules question in plain words; the answer is quoted from the SRD 5.1 with its section. */
export function RulesQA() {
  const { t } = useI18n()
  const [rules, setRules] = useState<{ index: RulesIndex; source: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [asked, setAsked] = useState('')
  const [result, setResult] = useState<Answer | null>(null)
  const [open, setOpen] = useState<Passage | null>(null)
  const [full, setFull] = useState(false)

  useEffect(() => { loadRules().then(setRules) }, [])

  const ask = (q: string) => {
    const question = q.trim()
    if (!question || !rules) return
    setDraft(question)
    setAsked(question)
    setResult(answer(rules.index, question))
    setOpen(null)
    setFull(false)
  }

  const shown = open ?? result?.best?.passage ?? null
  const quote = shown && rules ? (open ? excerpt(rules.index, open, asked) : result!.excerpt) : ''

  return (
    <section className="ff-rulesqa">
      <h2 className="glass-title">{t('rulesqa.title')}</h2>
      <p className="intro">{t('rulesqa.intro')}</p>
      {t('rulesqa.englishOnly') && <p className="intro small">{t('rulesqa.englishOnly')}</p>}

      <form className="ask" onSubmit={e => { e.preventDefault(); ask(draft) }}>
        <SearchField
          dir="auto"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t('rulesqa.placeholder')}
          aria-label={t('rulesqa.question')}
          autoFocus
        />
        <button className="glass-btn prominent" disabled={!rules || !draft.trim()}>{t('rulesqa.ask')}</button>
      </form>

      {!result && (
        <div className="examples" lang="en" dir="ltr" aria-label={t('rulesqa.examples')}>
          {EXAMPLES.map(q => <button key={q} className="glass-chip" onClick={() => ask(q)} disabled={!rules}>{q}</button>)}
        </div>
      )}

      {result && !shown && (
        <div className="glass thick answer">
          <p><strong>{t('rulesqa.notCovered')}</strong> {t('rulesqa.notCoveredHint')}</p>
          {/flank/i.test(asked) && <p className="muted small">{t('rulesqa.flanking')}</p>}
        </div>
      )}

      {result && shown && (
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
          </div>
          {full && <div className="full" lang="en" dir="ltr"><Markdown text={shown.text} /></div>}
        </article>
      )}

      {result && result.related.length > 0 && (
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

      {rules && <p className="source" lang="en" dir="ltr">{rules.source}</p>}
    </section>
  )
}

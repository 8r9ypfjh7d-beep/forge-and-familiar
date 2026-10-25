import { useEffect, useState } from 'react'
import { Markdown } from './Markdown'
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
      <h2>Rules Q&amp;A</h2>
      <p className="muted">Ask in your own words. Answers are quoted straight from the SRD 5.1 rules text, with the section they come from.</p>

      <form className="ask row" onSubmit={e => { e.preventDefault(); ask(draft) }}>
        <input
          type="search"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="e.g. Can I move after I attack?"
          aria-label="Rules question"
          autoFocus
        />
        <button className="btn primary" disabled={!rules || !draft.trim()}>Ask</button>
      </form>

      {!result && (
        <div className="examples row" aria-label="Example questions">
          {EXAMPLES.map(q => <button key={q} className="chip" onClick={() => ask(q)} disabled={!rules}>{q}</button>)}
        </div>
      )}

      {result && !shown && (
        <div className="panel answer">
          <p><strong>The SRD doesn't cover that.</strong> Try different words, or the name of the action, condition or rule.</p>
          {/flank/i.test(asked) && <p className="muted small">Flanking is an optional rule from the Dungeon Master's Guide and isn't part of the SRD.</p>}
        </div>
      )}

      {result && shown && (
        <article className="panel answer" aria-live="polite">
          {result.weak && !open && (
            <p className="hedge small">No section answers this directly. This is the closest match, so check it fits.</p>
          )}
          <p className="crumb small muted">{breadcrumb(shown)}</p>
          <blockquote><Markdown text={quote} /></blockquote>
          <div className="row">
            <button className="btn small" onClick={() => setFull(f => !f)} aria-expanded={full}>
              {full ? 'Hide full section' : 'Read the full section'}
            </button>
            {open && <button className="btn ghost small" onClick={() => { setOpen(null); setFull(false) }}>Back to best answer</button>}
          </div>
          {full && <div className="full"><Markdown text={shown.text} /></div>}
        </article>
      )}

      {result && result.related.length > 0 && (
        <div className="related">
          <h3>Also relevant</h3>
          <ul className="plain">
            {[result.best!, ...result.related].filter(h => h.passage !== shown).map(h => (
              <li key={h.passage.id}>
                <button className="link" onClick={() => { setOpen(h.passage); setFull(false) }}>{breadcrumb(h.passage)}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rules && <p className="source muted small">{rules.source}</p>}
    </section>
  )
}

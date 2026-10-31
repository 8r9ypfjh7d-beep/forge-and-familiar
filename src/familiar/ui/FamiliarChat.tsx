// The conversation itself: header, messages (streaming in), starter chips, history, composer and attribution.
// Used by the floating sheet (FamiliarFab) and the full-screen #/familiar page.
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CodeForm } from '../../accounts'
import { ConfirmDialog } from '../../builder/ConfirmDialog'
import { listSources } from '../../content'
import { useI18n, type MessageKey } from '../../i18n'
import type { FamiliarErrorKind } from '../types'
import { ChatMarkdown } from './ChatMarkdown'
import type { FamiliarChatState } from './useFamiliarChat'
import { bubbles, canRetry, errorMessageKey, resetText, whenText, type Bubble } from './view'
import type { ToolUse } from '../types'

export interface FamiliarChatProps {
  chat: FamiliarChatState
  /** Starter chips for the screen (i18n keys). */
  chips: string[]
  /** Why sending cannot work right now (checked before trying). */
  blocked: FamiliarErrorKind | null
  /** "About Vex", "DM screen": what the answers will know about. */
  subject?: string
  variant: 'sheet' | 'page'
  onClose?: () => void
  /** Moves focus into the composer when the panel opens. */
  autoFocus?: boolean
}

export function FamiliarChat({ chat, chips, blocked, subject, variant, onClose, autoFocus }: FamiliarChatProps) {
  const { t, locale } = useI18n()
  const [draft, setDraft] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const shown = chat.thread ? bubbles(chat.thread.contents, chat.thread.tools) : []
  const empty = !shown.length && !chat.pending

  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])
  // Keep the newest words in view while they stream in.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && !showHistory) el.scrollTop = el.scrollHeight
  }, [shown.length, chat.pending?.text, chat.pending?.tools.length, chat.error, showHistory])

  const send = (text: string) => {
    if (blocked || chat.busy || !text.trim()) return
    setDraft('')
    setShowHistory(false)
    // A failed question goes back into the box so nothing typed is lost.
    void chat.send(text).then(ok => { if (!ok) setDraft(d => d || text) })
  }
  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(draft) }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft) }
  }
  // The box grows with the question, up to a few lines.
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.blockSize = 'auto'
    el.style.blockSize = `${Math.min(el.scrollHeight, 140)}px`
  }, [draft])

  return (
    <div className={`fam-chat fam-v-${variant}`}>
      <header className="fam-head">
        <span className="fam-mark" aria-hidden="true"><Sparkle /></span>
        <div className="fam-titles">
          <h2 className="fam-title">{t('familiar.name')}</h2>
          {subject && <p className="fam-subject" dir="auto">{subject}</p>}
        </div>
        <div className="fam-head-actions">
          <button type="button" className={`glass-btn small fam-tool ${showHistory ? 'on' : ''}`} aria-pressed={showHistory} onClick={() => setShowHistory(h => !h)}>
            {t('familiar.history')}
          </button>
          <button type="button" className="glass-btn small fam-tool" onClick={() => { chat.startNew(); setShowHistory(false); setDraft(''); input.current?.focus() }} disabled={empty && !chat.error}>
            {t('familiar.newChat')}
          </button>
          {onClose && (
            <button type="button" className="glass-btn small icon fam-close" onClick={onClose} aria-label={t('familiar.close')} title={t('familiar.close')}>✕</button>
          )}
        </div>
      </header>

      <div ref={scroller} className="fam-body" aria-busy={chat.busy}>
        {showHistory ? (
          <History chat={chat} locale={locale} onPicked={() => setShowHistory(false)} onDelete={setDeleting} />
        ) : (
          <>
            {empty && (
              <div className="fam-intro">
                <p className="fam-intro-text">{t('familiar.intro')}</p>
              </div>
            )}
            <ol className="fam-messages" aria-live="polite" aria-label={t('familiar.messages')}>
              {shown.map(b => <Message key={b.index} bubble={b} />)}
              {chat.pending && (
                <>
                  <li className="fam-msg user"><div className="fam-bubble" dir="auto">{chat.pending.question}</div></li>
                  <li className="fam-msg model" aria-live="off">
                    {chat.pending.tools.length > 0 && <ToolChips tools={chat.pending.tools} />}
                    {chat.pending.text
                      ? <div className="fam-answer" dir="auto"><ChatMarkdown text={chat.pending.text} /></div>
                      : <p className="fam-thinking" role="status"><span className="fam-shimmer">{t(chat.pending.tools.length ? 'familiar.reading' : 'familiar.thinking')}</span></p>}
                  </li>
                </>
              )}
            </ol>
            {chat.error && (
              <div className={`fam-error ${chat.error.kind}`} role="alert">
                <p>{errorText(t, chat.error.kind, chat.error.resetAt, locale)}</p>
                <div className="fam-error-actions">
                  {canRetry(chat.error.kind) && (
                    <button type="button" className="glass-btn small prominent" onClick={() => { const q = chat.error!.question; setDraft(''); send(q) }}>{t('familiar.retry')}</button>
                  )}
                  {chat.error.kind === 'tooLarge' && <button type="button" className="glass-btn small prominent" onClick={() => chat.startNew()}>{t('familiar.newChat')}</button>}
                  <button type="button" className="glass-btn small" onClick={chat.dismissError}>{t('familiar.dismiss')}</button>
                </div>
              </div>
            )}
            {empty && !blocked && chips.length > 0 && (
              <div className="fam-chips" role="group" aria-label={t('familiar.suggestions')}>
                {chips.map(k => {
                  const text = t(k as MessageKey)
                  return <button key={k} type="button" className="glass-chip fam-chip" onClick={() => send(text)} disabled={chat.busy}>{text}</button>
                })}
              </div>
            )}
          </>
        )}
      </div>

      {blocked && (
        <div className={`fam-blocked ${blocked}`} role="status">
          <p>{t(errorMessageKey(blocked))}{blocked === 'notConfigured' && <> {t('familiar.notConfiguredHint')}</>}</p>
          {blocked === 'signIn' && <CodeForm autoFocus={false} />}
        </div>
      )}

      <form className="fam-composer" onSubmit={onSubmit}>
        <label className="fam-sr" htmlFor={`fam-input-${variant}`}>{t('familiar.ask')}</label>
        <textarea
          id={`fam-input-${variant}`}
          ref={input}
          className="fam-input"
          rows={1}
          dir="auto"
          value={draft}
          placeholder={t('familiar.placeholder')}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          disabled={!!blocked}
          maxLength={4000}
        />
        {chat.busy ? (
          <button type="button" className="glass-btn fam-send" onClick={chat.stop}>{t('familiar.stop')}</button>
        ) : (
          <button type="submit" className="glass-btn prominent fam-send" disabled={!!blocked || !draft.trim()}>{t('familiar.send')}</button>
        )}
      </form>

      <Attribution />

      <ConfirmDialog
        open={!!deleting}
        title={t('familiar.confirmDelete', { title: chat.threads.find(x => x.id === deleting)?.title || t('familiar.untitled') })}
        yes={t('common.delete')}
        onYes={() => deleting && chat.remove(deleting)}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function Message({ bubble }: { bubble: Bubble }) {
  if (bubble.role === 'user') return <li className="fam-msg user"><div className="fam-bubble" dir="auto">{bubble.text}</div></li>
  return (
    <li className="fam-msg model">
      {bubble.tools.length > 0 && <ToolChips tools={bubble.tools} />}
      <div className="fam-answer" dir="auto"><ChatMarkdown text={bubble.text} /></div>
    </li>
  )
}

/** "Looked up: Fireball · Grappled": what the answer read, so the reader can check it. */
function ToolChips({ tools }: { tools: ToolUse[] }) {
  const { t } = useI18n()
  const seen = new Set<string>()
  const unique = tools.filter(u => { const k = `${u.name}:${u.label}`; if (seen.has(k)) return false; seen.add(k); return true })
  return (
    <div className="fam-tools" aria-label={t('familiar.lookedUp')}>
      <span className="fam-tools-label">{t('familiar.lookedUp')}</span>
      {unique.map((u, i) => (
        <span key={i} className={`fam-tool-chip ${u.ok ? '' : 'failed'}`} title={u.ok ? undefined : t('familiar.toolFailed')} dir="auto">{u.label}</span>
      ))}
    </div>
  )
}

function History({ chat, locale, onPicked, onDelete }: { chat: FamiliarChatState; locale: string; onPicked: () => void; onDelete: (id: string) => void }) {
  const { t } = useI18n()
  if (!chat.threads.length) return <p className="fam-history-empty muted">{t('familiar.historyEmpty')}</p>
  return (
    <>
      <p className="fam-history-note muted small">{t('familiar.historyNote')}</p>
      <ul className="fam-history glass-list">
        {chat.threads.map(th => (
          <li key={th.id} className={chat.thread?.id === th.id ? 'on' : ''}>
            <button type="button" className="fam-history-open" onClick={() => { chat.open(th.id); onPicked() }}>
              <span className="fam-history-title" dir="auto">{th.title || t('familiar.untitled')}</span>
              <span className="fam-history-meta">{t(CONTEXT_LABEL[th.context.kind])} · {whenText(th.updatedAt, locale)}</span>
            </button>
            <button type="button" className="glass-btn small icon fam-history-delete" onClick={() => onDelete(th.id)} aria-label={`${t('common.delete')}: ${th.title}`}>✕</button>
          </li>
        ))}
      </ul>
    </>
  )
}

const CONTEXT_LABEL: Record<string, MessageKey> = {
  general: 'familiar.context.general', character: 'familiar.context.character', builder: 'familiar.context.builder', dm: 'familiar.context.dm',
}

function errorText(t: ReturnType<typeof useI18n>['t'], kind: FamiliarErrorKind, resetAt: string | undefined, locale: string) {
  if (kind === 'limit') {
    const time = resetText(resetAt, locale)
    return time ? t('familiar.error.limit', { time }) : t('familiar.error.limitSoon')
  }
  return t(errorMessageKey(kind))
}

/** SRD credit (CC-BY-4.0 asks for it wherever its text is shown) and the honest caveat. */
function Attribution() {
  const { t } = useI18n()
  const srd = listSources().filter(s => s.license.startsWith('CC-BY'))
  return (
    <footer className="fam-foot">
      <p>{t('familiar.caveat')}</p>
      <details>
        <summary>{t('familiar.credits')}</summary>
        {srd.map(s => <p key={s.id} lang="en" dir="ltr">{s.attribution}</p>)}
        <p>{t('familiar.creditsBooks')}</p>
        <p>{t('familiar.creditsGemini')}</p>
      </details>
    </footer>
  )
}

export function Sparkle({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
      <path d="M12 2.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5z" />
      <path d="M18.5 14.5c.25 1.8 1.2 2.75 3 3-1.8.25-2.75 1.2-3 3-.25-1.8-1.2-2.75-3-3 1.8-.25 2.75-1.2 3-3z" opacity=".75" />
      <path d="M5.5 15.5c.2 1.3.9 2 2.2 2.2-1.3.2-2 .9-2.2 2.2-.2-1.3-.9-2-2.2-2.2 1.3-.2 2-.9 2.2-2.2z" opacity=".6" />
    </svg>
  )
}

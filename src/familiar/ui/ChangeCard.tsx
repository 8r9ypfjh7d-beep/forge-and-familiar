// Apply cards: a change the Familiar suggested. Nothing changes until the user taps Apply; Undo takes exactly that change back.
import { useState } from 'react'
import { useI18n } from '../../i18n'
import { proposalFits, type Proposal } from '../changes'
import { changeTitle } from './changeText'
import { useFamiliarScreenValue } from './screen'

/** Undo for cards tapped since the page loaded (a reload keeps "Applied" but not the undo). */
const undoers = new Map<string, () => void>()

export function ChangeCards({ proposals, applied, onApplied }: {
  proposals: Proposal[]
  /** What the user already did with each card (saved on the thread). */
  applied?: Record<string, 'applied' | 'undone'>
  onApplied?: (id: string, state: 'applied' | 'undone') => void
}) {
  const { t } = useI18n()
  if (!proposals.length) return null
  return (
    <ul className="fam-changes" aria-label={t('familiar.change.cards')}>
      {proposals.map(p => <ChangeCard key={p.id} proposal={p} state={applied?.[p.id]} onApplied={onApplied} />)}
    </ul>
  )
}

function ChangeCard({ proposal: p, state, onApplied }: { proposal: Proposal; state?: 'applied' | 'undone'; onApplied?: (id: string, state: 'applied' | 'undone') => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const screen = useFamiliarScreenValue()
  const [note, setNote] = useState<'already' | 'failed' | null>(null)
  const fits = proposalFits(p, screen.context as { kind: string; characterId?: string }) && typeof screen.data?.applyChange === 'function'
  const title = changeTitle(p, i18n, screen)
  const canUndo = state === 'applied' && undoers.has(p.id)

  const apply = () => {
    const out = screen.data?.applyChange?.(p)
    if (!out) return
    if (!out.ok) { setNote(out.why === 'already' ? 'already' : 'failed'); return }
    setNote(null)
    undoers.set(p.id, out.undo)
    onApplied?.(p.id, 'applied')
  }
  const undo = () => {
    const fn = undoers.get(p.id)
    if (!fn) return
    undoers.delete(p.id)
    fn()
    onApplied?.(p.id, 'undone')
  }

  return (
    <li className={`fam-change ${state ?? ''}`}>
      <p className="fam-change-kicker">{t('familiar.change.kicker')}</p>
      <p className="fam-change-title" dir="auto">{title}</p>
      {p.change.kind === 'add_note' && <blockquote className="fam-change-note" dir="auto">{p.change.text}</blockquote>}
      {p.reason && <p className="fam-change-reason" dir="auto">{p.reason}</p>}
      {p.warnings.length > 0 && state !== 'applied' && (
        <ul className="fam-change-warns">
          {p.warnings.map(w => <li key={w}>{t(`familiar.change.warn.${w}`)}</li>)}
        </ul>
      )}
      <div className="fam-change-actions">
        {state === 'applied' ? (
          <>
            <span className="fam-change-done" role="status">✓ {t('familiar.change.applied')}</span>
            {canUndo && <button type="button" className="glass-btn small" onClick={undo}>{t('familiar.change.undo')}</button>}
          </>
        ) : fits ? (
          <>
            {state === 'undone' && <span className="fam-change-undone" role="status">{t('familiar.change.undone')}</span>}
            <button type="button" className="glass-btn small prominent" onClick={apply}>{t(state === 'undone' ? 'familiar.change.applyAgain' : 'familiar.change.apply')}</button>
          </>
        ) : (
          <span className="fam-change-where">
            {state === 'undone' && <>{t('familiar.change.undone')} · </>}
            {p.target === 'builder' ? t('familiar.change.openBuilder') : t('familiar.change.openSheet', { name: p.characterName || '…' })}
          </span>
        )}
      </div>
      {state === 'applied' && !canUndo && <p className="fam-change-hint">{t('familiar.change.undoOnSheet')}</p>}
      {note && <p className="fam-change-hint" role="status">{t(note === 'already' ? 'familiar.change.already' : 'familiar.change.failed')}</p>}
    </li>
  )
}

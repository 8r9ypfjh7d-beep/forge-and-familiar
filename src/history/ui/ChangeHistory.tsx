import { useCallback, useEffect, useState } from 'react'
import { useI18n, type MessageKey } from '../../i18n'
import { canRestore, changesIn, restoreEntry, summarize } from '../revisions'
import { listRevisions, onHistoryChanged } from '../store'
import type { FieldChange, Revision, RevisionSource } from '../types'
import './history.css'

/** Passed to onRestore so the editor records the save as a restore, not a plain edit. */
export interface RestoreMeta {
  source: Extract<RevisionSource, 'restore'>
  restoredFrom: number
  note: string
}

const when = (iso: string, locale: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

const show = (v: unknown) => {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v.every(x => typeof x !== 'object')) return v.length ? v.join(', ') : '—'
  const s = JSON.stringify(v)
  return s.length > 120 ? `${s.slice(0, 117)}…` : s
}

const sourceLabel: Record<RevisionSource, MessageKey> = { edit: 'hist.source.edit', import: 'hist.source.import', restore: 'hist.source.restore' }

/**
 * Version list for one homebrew entry: who changed what and when, a field-by-field diff,
 * and (for the pack author) restoring an old version.
 */
export function ChangeHistory({ entryId, userId, packAuthorId, onRestore }: {
  entryId: string
  /** The player looking at it. */
  userId: string
  /** Only the pack author may restore. */
  packAuthorId: string
  /** Save the old entry through the homebrew store, recording it with `meta`. */
  onRestore?: <T>(entry: T, meta: RestoreMeta) => Promise<void>
}) {
  const { t, locale } = useI18n()
  const [revs, setRevs] = useState<Revision[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)

  const load = useCallback(() => { listRevisions(entryId).then(setRevs) }, [entryId])
  useEffect(() => {
    load()
    return onHistoryChanged(ids => { if (ids.length === 0 || ids.includes(entryId)) load() })
  }, [entryId, load])

  if (revs === null) return <p className="muted small">{t('hist.loading')}</p>
  if (revs.length === 0) return <p className="muted small">{t('hist.empty')}</p>

  const mayRestore = !!onRestore && canRestore(userId, packAuthorId)
  const latest = revs[0].rev

  const restore = async (r: Revision) => {
    if (!onRestore) return
    try {
      await onRestore(restoreEntry(r), { source: 'restore', restoredFrom: r.rev, note: t('hist.restoredNote', { rev: r.rev }) })
      setMessage({ text: t('hist.restored', { rev: r.rev }) })
    } catch (e) {
      const full = e instanceof DOMException && e.name === 'QuotaExceededError'
      setMessage({ bad: true, text: full ? t('hist.full') : e instanceof Error ? e.message : t('hist.failed') })
    }
  }

  return (
    <section className="ff-history" aria-label={t('hist.aria')}>
      {message && <p className={`small ${message.bad ? 'bad' : 'good'}`} role="status">{message.text}</p>}
      <ol className="plain">
        {revs.map(r => {
          const changes = changesIn(revs, r)
          const expanded = open === r.id
          return (
            <li key={r.id} className="panel">
              <div className="ff-history-row">
                <button type="button" className="ff-history-toggle" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.id)}>
                  <span className="strong">v{r.rev}</span>
                  {r.rev === latest && <span className="chip on">{t('hist.current')}</span>}
                  <span>{r.note ?? summarize(changes)}</span>
                </button>
                {mayRestore && r.rev !== latest && (
                  <button type="button" className="btn small" onClick={() => restore(r)}>{t('hist.restore')}</button>
                )}
              </div>
              <p className="muted small">
                {t('hist.by', {
                  what: r.restoredFrom ? t('hist.restoredFrom', { rev: r.restoredFrom }) : t(sourceLabel[r.source]),
                  name: r.authorName ?? t('hist.unknown'),
                  when: when(r.at, locale),
                })}
              </p>
              {expanded && <Diff changes={changes} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Diff({ changes }: { changes: FieldChange[] }) {
  const { t } = useI18n()
  if (changes.length === 0) return <p className="muted small">{t('hist.same')}</p>
  return (
    <table className="ff-diff small">
      <thead><tr><th>{t('hist.field')}</th><th>{t('hist.before')}</th><th>{t('hist.after')}</th></tr></thead>
      <tbody>
        {changes.map(c => (
          <tr key={c.path || '(entry)'}>
            <th scope="row">{c.path || '(entry)'}</th>
            <td className="was">{c.type === 'added' ? '—' : show(c.before)}</td>
            <td className="now">{c.type === 'removed' ? '—' : show(c.after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

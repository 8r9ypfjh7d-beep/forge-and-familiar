import { useCallback, useEffect, useState } from 'react'
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

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const show = (v: unknown) => {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v.every(x => typeof x !== 'object')) return v.length ? v.join(', ') : '—'
  const s = JSON.stringify(v)
  return s.length > 120 ? `${s.slice(0, 117)}…` : s
}

const sourceLabel: Record<RevisionSource, string> = { edit: 'Edited', import: 'Imported', restore: 'Restored' }

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
  const [revs, setRevs] = useState<Revision[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)

  const load = useCallback(() => { listRevisions(entryId).then(setRevs) }, [entryId])
  useEffect(() => {
    load()
    return onHistoryChanged(ids => { if (ids.length === 0 || ids.includes(entryId)) load() })
  }, [entryId, load])

  if (revs === null) return <p className="muted small">Loading history…</p>
  if (revs.length === 0) return <p className="muted small">No history yet. Versions are saved each time this entry changes.</p>

  const mayRestore = !!onRestore && canRestore(userId, packAuthorId)
  const latest = revs[0].rev

  const restore = async (r: Revision) => {
    if (!onRestore) return
    try {
      await onRestore(restoreEntry(r), { source: 'restore', restoredFrom: r.rev, note: `Restored version ${r.rev}` })
      setMessage({ text: `Version ${r.rev} restored.` })
    } catch (e) {
      const full = e instanceof DOMException && e.name === 'QuotaExceededError'
      setMessage({ bad: true, text: full ? 'Storage is full. Delete unused packs and try again.' : e instanceof Error ? e.message : 'Could not restore.' })
    }
  }

  return (
    <section className="ff-history" aria-label="Change history">
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
                  {r.rev === latest && <span className="chip on">current</span>}
                  <span>{r.note ?? summarize(changes)}</span>
                </button>
                {mayRestore && r.rev !== latest && (
                  <button type="button" className="btn small" onClick={() => restore(r)}>Restore</button>
                )}
              </div>
              <p className="muted small">
                {r.restoredFrom ? `Restored from v${r.restoredFrom}` : sourceLabel[r.source]} by {r.authorName ?? 'unknown player'} · {when(r.at)}
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
  if (changes.length === 0) return <p className="muted small">Same as the version before.</p>
  return (
    <table className="ff-diff small">
      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
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

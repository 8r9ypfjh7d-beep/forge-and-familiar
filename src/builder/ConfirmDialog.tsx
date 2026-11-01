import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { typedMatches } from './typedMatches'

/** In-app glass yes/no dialog, used instead of the browser's confirm box. Shown while `open`. */
export function ConfirmDialog({ open, title, body, yes, onYes, onClose }: { open: boolean; title: string; body?: string; yes: string; onYes: () => void; onClose: () => void }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="confirm-dialog glass-sheet glass-dialog" aria-label={title} onCancel={e => { e.preventDefault(); onClose() }}>
      {open && (
        <>
          <p className="confirm-dialog-title">{title}</p>
          {body && <p className="muted small confirm-dialog-body">{body}</p>}
          <div className="confirm-dialog-actions">
            <button type="button" className="glass-btn prominent" onClick={() => { onClose(); onYes() }}>{yes}</button>
            <button type="button" className="glass-btn" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </>
      )}
    </dialog>
  )
}

/**
 * In-app glass dialog with one text field, used instead of the browser's prompt box. `onSubmit` gets the trimmed
 * text; when it returns an error message the dialog stays open and shows it.
 */
export function PromptDialog({ open, title, yes, placeholder, onSubmit, onClose }: {
  open: boolean; title: string; yes: string; placeholder?: string
  onSubmit: (value: string) => string | void | Promise<string | void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Each opening starts empty.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) { setValue(''); setError('') }
  }
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = value.trim()
    if (!v || busy) return
    setBusy(true)
    const problem = await onSubmit(v)
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  return (
    <dialog ref={ref} className="confirm-dialog glass-sheet glass-dialog" aria-label={title} onCancel={e => { e.preventDefault(); onClose() }}>
      {open && (
        <form onSubmit={submit}>
          <label className="confirm-dialog-title" htmlFor="prompt-dialog-field">{title}</label>
          <input id="prompt-dialog-field" className="glass-field prompt-dialog-field" autoFocus value={value} placeholder={placeholder}
            onChange={e => { setValue(e.target.value); setError('') }} />
          {error && <p className="prompt-dialog-error small" role="alert">{error}</p>}
          <div className="confirm-dialog-actions">
            <button type="submit" className="glass-btn prominent" disabled={!value.trim() || busy}>{yes}</button>
            <button type="button" className="glass-btn" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </dialog>
  )
}

/**
 * In-app dialog for a step that can't be undone: lists what is lost and only enables the danger button once
 * the user types `phrase` (case and outer spaces ignored).
 */
export function TypedConfirmDialog({ open, title, body, phrase, yes, onYes, onClose }: {
  open: boolean; title: string; body: string; phrase: string; yes: string
  onYes: () => void; onClose: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setValue('')
  }
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  const ok = typedMatches(value, phrase)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ok) return
    onClose()
    onYes()
  }
  return (
    <dialog ref={ref} className="confirm-dialog glass-sheet glass-dialog" aria-label={title} onCancel={e => { e.preventDefault(); onClose() }}>
      {open && (
        <form onSubmit={submit}>
          <p className="confirm-dialog-title">{title}</p>
          <p className="confirm-dialog-body small">{body}</p>
          <label className="small" htmlFor="typed-confirm-field">{t('common.typeToConfirm', { phrase })}</label>
          <input id="typed-confirm-field" className="glass-field prompt-dialog-field" autoFocus autoComplete="off" value={value}
            onChange={e => setValue(e.target.value)} />
          <div className="confirm-dialog-actions">
            <button type="submit" className="glass-btn prominent" disabled={!ok}>{yes}</button>
            <button type="button" className="glass-btn" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </dialog>
  )
}


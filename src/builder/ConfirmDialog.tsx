import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'

/** In-app glass yes/no dialog, used instead of the browser's confirm box. Shown while `open`. */
export function ConfirmDialog({ open, title, yes, onYes, onClose }: { open: boolean; title: string; yes: string; onYes: () => void; onClose: () => void }) {
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

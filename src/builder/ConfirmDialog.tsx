import { useEffect, useRef } from 'react'
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

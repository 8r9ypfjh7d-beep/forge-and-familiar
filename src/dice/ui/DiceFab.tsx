// Floating dice button: sits in the corner of every screen and opens a small dice window.
import { useEffect, useId, useRef } from 'react'
import { useI18n } from '../../i18n'
import { DiceTray } from './DiceTray'
import './dice.css'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The character on screen, if any. Free rolls are tagged with them; the history still shows every roll. */
  character?: { id: string; name: string }
}

export function DiceFab({ open, onOpenChange, character }: Props) {
  const { t } = useI18n()
  const panelId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLElement>('.ff-dice__die')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onOpenChange(false)
      button.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <div className="ff-dice-fab">
      {open && (
        <div ref={panel} id={panelId} className="ff-dice-fab__panel" role="dialog" aria-label={t('dice.roller')}>
          <div className="ff-dice-fab__head">
            <h2>{t('dice.roller')}</h2>
            <button type="button" className="ff-dice__ghost" onClick={() => { onOpenChange(false); button.current?.focus() }} aria-label={t('dice.close')}>✕</button>
          </div>
          <DiceTray character={character} showAll />
        </div>
      )}
      <button
        ref={button}
        type="button"
        className={`ff-dice-fab__button ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t(open ? 'dice.close' : 'dice.open')}
        title={t(open ? 'dice.close' : 'dice.open')}
        onClick={() => onOpenChange(!open)}
      >
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 2 7.5 9.5h9zM3 7l4.5 2.5L3 17M21 7l-4.5 2.5L21 17M7.5 9.5 12 22l4.5-12.5M3 17l9 5 9-5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

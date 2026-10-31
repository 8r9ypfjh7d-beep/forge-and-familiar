// "Ask the Familiar" entry point for the sheet and the builder. Hidden until the Familiar panel is mounted.
import { useI18n } from '../../i18n/useI18n'
import { askFamiliar } from '../screen'
import { useFamiliarAvailable } from './screen'

export function AskFamiliar({ prompt, label, compact, className = '' }: {
  /** A question to put in the panel's input. */
  prompt?: string
  /** Accessible name (and the visible text unless `compact`). Default "Ask the Familiar". */
  label?: string
  /** Only the sparkle, as a small capsule next to help text. */
  compact?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const available = useFamiliarAvailable()
  if (!available) return null
  const name = label ?? t('familiar.ask')
  return (
    <button
      type="button"
      className={`glass-btn small ask-familiar${compact ? ' icon' : ''} ${className}`.trim()}
      aria-label={name}
      title={name}
      onClick={() => askFamiliar(prompt ? { prompt } : {})}
    >
      <span aria-hidden="true">✦</span>{compact ? null : <> {t('familiar.ask')}</>}
    </button>
  )
}

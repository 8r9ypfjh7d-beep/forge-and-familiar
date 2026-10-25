import { useI18n } from '../../i18n'

interface PipsProps {
  total: number
  /** How many pips are spent (drawn empty). */
  used: number
  onChange: (used: number) => void
  label: string
  tone?: 'slot' | 'success' | 'failure'
}

/** A row of toggles. Clicking pip n makes n pips available, clicking the last available one spends it. */
export function Pips({ total, used, onChange, label, tone = 'slot' }: PipsProps) {
  const available = total - used
  const { t } = useI18n()
  return (
    <div className={`pips pips-${tone}`} role="group" aria-label={label}>
      {Array.from({ length: total }, (_, i) => {
        const filled = i < available
        return (
          <button
            key={i}
            type="button"
            className={filled ? 'pip filled' : 'pip'}
            aria-pressed={filled}
            aria-label={t(filled ? 'sheet.pip.available' : 'sheet.pip.used', { label, n: i + 1 })}
            onClick={() => onChange(filled && i === available - 1 ? used + 1 : total - (i + 1))}
          />
        )
      })}
    </div>
  )
}

interface MarksProps {
  count: number
  onChange: (count: number) => void
  label: string
  tone: 'success' | 'failure'
}

/** Death save marks: filled from the left, clicking toggles up to that mark. */
export function Marks({ count, onChange, label, tone }: MarksProps) {
  return (
    <div className={`pips pips-${tone}`} role="group" aria-label={label}>
      {[0, 1, 2].map(i => (
        <button
          key={i}
          type="button"
          className={i < count ? 'pip filled' : 'pip'}
          aria-pressed={i < count}
          aria-label={`${label} ${i + 1}`}
          onClick={() => onChange(i < count && i === count - 1 ? i : i + 1)}
        />
      ))}
    </div>
  )
}

export function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  const { t } = useI18n()
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={t('sheet.stepper.use', { label })}>−</button>
      <span className="stepper-value"><strong>{value}</strong> / {max}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={t('sheet.stepper.regain', { label })}>+</button>
    </div>
  )
}

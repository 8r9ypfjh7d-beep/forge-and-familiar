import { useI18n } from '../i18n'
import { optionPickSlots, optionsFor, toggleClassOption, type ClassOption } from '../rules'
import type { StepProps } from './steps'
import { Why } from './Why'
import { optionKey, optionName, type WhyId } from './why'

/**
 * Picks from the option lists a class learns many of by level (`ClassDef.optionPicks`: Artificer Infusions, 2024 magic item plans).
 * Lists every registered option of the kind, official then homebrew, grouped by the class level that unlocks it.
 * Going over or under the count only warns: the table decides.
 */
export function InfusionPicker({ draft, update }: StepProps) {
  const { t, term, className } = useI18n()
  const slots = optionPickSlots(draft)
  if (slots.length === 0) return null
  return (
    <>
      {slots.map(slot => {
        const options = optionsFor(draft, slot)
        const ids = new Set(slot.picked.map(x => x.option.id))
        const levels = [...new Set(options.map(o => o.minLevel ?? 0))].sort((a, b) => a - b)
        const name = (o: ClassOption) => optionName(o, term)
        const about = (o: ClassOption) => { const key = optionKey(o); return o.text || (key ? t(key) : t('why.homebrew')) }
        return (
          <div className="field" key={`${slot.classId}.${slot.kind}`}>
            <label>
              {t('builder.options.title', { feature: term('feature', slot.name, slot.name), className: className(slot.classId), picked: ids.size, count: slot.count })}
              {' '}<Why id={`options.${slot.kind}` as WhyId} />
            </label>
            {levels.map(level => (
              <div key={level}>
                {level > 0 && <p className="muted small">{t('builder.options.fromLevel', { level })}</p>}
                <div className="row">
                  {options.filter(o => (o.minLevel ?? 0) === level).map(o => (
                    <button key={o.id} type="button" className={`glass-chip ${ids.has(o.id) ? 'on' : ''}`} title={about(o)}
                      onClick={() => update({ classOptions: toggleClassOption(draft, slot, o.id) })}>
                      {name(o)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {slot.picked.length > 0 && (
              <ul className="why-list">
                {slot.picked.map(({ option: o }) => (
                  <li key={o.id}><strong>{name(o)}</strong>{o.source && <span className="muted"> · {o.source}</span>}<span className="why-list-text">{about(o)}</span></li>
                ))}
              </ul>
            )}
            {ids.size !== slot.count && (
              <p className="muted small">⚠ {t(ids.size < slot.count ? 'builder.options.under' : 'builder.options.over', { count: slot.count })}</p>
            )}
          </div>
        )
      })}
    </>
  )
}

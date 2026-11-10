import { LOCALES, isLocale } from './translate'
import { useI18n } from './useI18n'
import './i18n.css'

/** Language select for the top bar and welcome screen. */
export function LanguagePicker({ onChange }: { onChange?: () => void } = {}) {
  const { locale, setLocale, t } = useI18n()
  return (
    <select
      className="ff-lang"
      value={locale}
      aria-label={t('app.language')}
      onChange={e => { if (isLocale(e.target.value)) { setLocale(e.target.value); onChange?.() } }}
    >
      {Object.values(LOCALES).map(l => <option key={l.code} value={l.code} lang={l.code}>{l.name}</option>)}
    </select>
  )
}

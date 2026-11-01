// A short "how this sheet works" card for players who are new to the app or to D&D. Shown until dismissed, once per device.
import { useState } from 'react'
import { useI18n } from '../../i18n'

const KEY = 'ff.sheetTips.v1'

function seen(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function FirstTips() {
  const { t } = useI18n()
  const [hidden, setHidden] = useState(seen)
  if (hidden) return null
  const close = () => {
    try { localStorage.setItem(KEY, '1') } catch { /* storage blocked: hide for this visit only */ }
    setHidden(true)
  }
  return (
    <section className="card first-tips" aria-labelledby="first-tips-title">
      <h2 id="first-tips-title">{t('sheet.tips.title')}</h2>
      <ul>
        <li>{t('sheet.tips.roll')}</li>
        <li>{t('sheet.tips.explain')}</li>
        <li>{t('sheet.tips.damage')}</li>
        <li>{t('sheet.tips.rest')}</li>
        <li>{t('sheet.tips.modes')}</li>
      </ul>
      <button type="button" className="btn small" onClick={close}>{t('sheet.tips.dismiss')}</button>
    </section>
  )
}

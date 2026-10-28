// Topbar button that opens the accessibility panel. Changes apply at once and are saved on this device.
import { useRef } from 'react'
import { useI18n, type MessageKey } from '../../i18n'
import { DEFAULT_SETTINGS, TEXT_SIZES, updateSettings, type A11ySettings } from '../settings'
import { useA11ySettings } from './hooks'

type Toggle = Exclude<keyof A11ySettings, 'textSize'>
interface Option { key: Toggle; icon: string }

/** Labels are `a11y.<key>` and hints `a11y.<key>Hint` in the locale files. */
const GROUPS: { id: 'seeing' | 'using'; options: Option[] }[] = [
  {
    id: 'seeing',
    options: [
      { key: 'highContrast', icon: '◑' },
      { key: 'easyRead', icon: '≡' },
      { key: 'reduceMotion', icon: '◌' },
      { key: 'reduceTransparency', icon: '▢' },
    ],
  },
  {
    id: 'using',
    options: [
      { key: 'strongFocus', icon: '◎' },
      { key: 'largeTargets', icon: '▣' },
      { key: 'shortcuts', icon: '⌨' },
    ],
  },
]

const SHORTCUTS: [string, MessageKey][] = [
  ['C', 'a11y.key.characters'], ['B', 'a11y.key.builder'], ['D', 'a11y.key.dice'], ['P', 'a11y.key.party'], ['A', 'a11y.key.panel'], ['Esc', 'a11y.key.close'],
]

export function AccessibilityButton({ dialogRef }: { dialogRef?: React.RefObject<HTMLDialogElement | null> }) {
  const own = useRef<HTMLDialogElement>(null)
  const ref = dialogRef ?? own
  const active = useA11yActiveCount()
  const { t } = useI18n()
  return (
    <>
      <button type="button" className={`chip a11y-chip ${active ? 'on' : ''}`} aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15"><circle cx="10" cy="4" r="2" fill="currentColor"/><path d="M3.5 7.5 10 9l6.5-1.5M10 9v4l-3 5M10 13l3 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        {t('a11y.button')}{active ? <span className="a11y-count" aria-label={t('a11y.activeCount', { count: active })}>{active}</span> : null}
      </button>
      <AccessibilityDialog ref={ref} />
    </>
  )
}

/** How many settings differ from the defaults, for a badge on whatever opens the panel. */
export function useA11yActiveCount() {
  const s = useA11ySettings()
  return Object.keys(DEFAULT_SETTINGS).filter(k => s[k as keyof A11ySettings] !== DEFAULT_SETTINGS[k as keyof A11ySettings]).length
}

/** The settings panel on its own, for menus that open it with their own button. */
export function AccessibilityDialog({ ref }: { ref: React.RefObject<HTMLDialogElement | null> }) {
  const s = useA11ySettings()
  const { t } = useI18n()
  const close = () => ref.current?.close()
  return (
    <dialog ref={ref} className="a11y-dialog glass-sheet glass-dialog" aria-labelledby="a11y-title" onClick={e => { if (e.target === ref.current) close() }}>
      <header className="a11y-head">
        <div>
          <h2 id="a11y-title">{t('a11y.button')}</h2>
          <p>{t('a11y.lead')}</p>
        </div>
        <button type="button" className="a11y-close" onClick={close} aria-label={t('a11y.close')}>
          <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </header>

      <section className="a11y-section" aria-labelledby="a11y-size-title">
        <h3 id="a11y-size-title">{t('a11y.textSize')}</h3>
        <div className="a11y-sizes" role="radiogroup" aria-label={t('a11y.textSize')}>
          {TEXT_SIZES.map(size => (
            <button key={size} type="button" role="radio" aria-checked={s.textSize === size}
              className={s.textSize === size ? 'on' : ''} onClick={() => updateSettings({ textSize: size })}
              aria-label={t('a11y.sizeAria', { size: t(`a11y.size.${size}`), percent: size })}>
              <span className="a11y-glyph" style={{ fontSize: `${0.8 + (size - 100) / 100}rem` }} aria-hidden="true">A</span>
              <span className="a11y-size-name">{t(`a11y.size.${size}`)}</span>
            </button>
          ))}
        </div>
        <p className="a11y-sample" aria-hidden="true">
          <strong>Brannoc Ashvale</strong> · {t('a11y.sampleClass')} · <span className="a11y-sample-hp" dir="ltr">49 / 56 HP</span>
        </p>
      </section>

      {GROUPS.map(g => (
        <section key={g.id} className="a11y-section" aria-labelledby={`a11y-${g.id}`}>
          <h3 id={`a11y-${g.id}`}>{t(`a11y.group.${g.id}`)}</h3>
          <div className="a11y-options">
            {g.options.map(o => (
              <button key={o.key} type="button" role="switch" aria-checked={s[o.key]} className={`a11y-option ${s[o.key] ? 'on' : ''}`}
                onClick={() => updateSettings({ [o.key]: !s[o.key] })}>
                <span className="a11y-icon" aria-hidden="true">{o.icon}</span>
                <span className="a11y-text">
                  <span className="a11y-label">{t(`a11y.${o.key}`)}</span>
                  <span className="a11y-hint">{t(`a11y.${o.key}Hint`)}</span>
                </span>
                <span className="a11y-switch" aria-hidden="true"><span /></span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {s.shortcuts && (
        <p className="a11y-keys">
          {SHORTCUTS.map(([k, what]) => <span key={k}><kbd>{k}</kbd> {t(what)}</span>)}
          <span><kbd>←</kbd><kbd>→</kbd> {t('a11y.key.move')}</span>
        </p>
      )}

      <footer className="a11y-foot">
        <button type="button" className="btn ghost" onClick={() => updateSettings(DEFAULT_SETTINGS)} disabled={s === DEFAULT_SETTINGS || sameAsDefault(s)}>{t('a11y.reset')}</button>
        <button type="button" className="btn primary" onClick={close}>{t('a11y.done')}</button>
      </footer>
    </dialog>
  )
}

const sameAsDefault = (s: A11ySettings) => (Object.keys(DEFAULT_SETTINGS) as (keyof A11ySettings)[]).every(k => s[k] === DEFAULT_SETTINGS[k])

// Topbar button that opens the accessibility panel. Changes apply at once and are saved on this device.
import { useRef } from 'react'
import { DEFAULT_SETTINGS, TEXT_SIZES, updateSettings, type A11ySettings, type TextSize } from '../settings'
import { useA11ySettings } from './hooks'

type Toggle = Exclude<keyof A11ySettings, 'textSize'>
interface Option { key: Toggle; label: string; hint: string; icon: string }

const GROUPS: { title: string; options: Option[] }[] = [
  {
    title: 'Seeing',
    options: [
      { key: 'highContrast', label: 'High contrast', hint: 'Black and white with strong edges.', icon: '◑' },
      { key: 'easyRead', label: 'Easy-read text', hint: 'Plain headings and roomier lines.', icon: '≡' },
      { key: 'reduceMotion', label: 'Reduce motion', hint: 'No sliding or animated bars.', icon: '◌' },
    ],
  },
  {
    title: 'Using',
    options: [
      { key: 'strongFocus', label: 'Bold focus ring', hint: 'Shows where the keyboard is.', icon: '◎' },
      { key: 'largeTargets', label: 'Bigger buttons', hint: 'Easier to tap, at least 44px.', icon: '▣' },
      { key: 'shortcuts', label: 'Shortcut keys', hint: 'C, B, D, P and A jump between screens.', icon: '⌨' },
    ],
  },
]

const SHORTCUTS: [string, string][] = [
  ['C', 'Characters'], ['B', 'Builder'], ['D', 'Dice'], ['P', 'Party'], ['A', 'This panel'], ['Esc', 'Close'],
]

export function AccessibilityButton({ dialogRef }: { dialogRef?: React.RefObject<HTMLDialogElement | null> }) {
  const own = useRef<HTMLDialogElement>(null)
  const ref = dialogRef ?? own
  const s = useA11ySettings()
  const active = Object.keys(DEFAULT_SETTINGS).filter(k => s[k as keyof A11ySettings] !== DEFAULT_SETTINGS[k as keyof A11ySettings]).length
  return (
    <>
      <button type="button" className={`chip a11y-chip ${active ? 'on' : ''}`} aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15"><circle cx="10" cy="4" r="2" fill="currentColor"/><path d="M3.5 7.5 10 9l6.5-1.5M10 9v4l-3 5M10 13l3 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Accessibility{active ? <span className="a11y-count" aria-label={`${active} on`}>{active}</span> : null}
      </button>
      <AccessibilityDialog ref={ref} />
    </>
  )
}

function AccessibilityDialog({ ref }: { ref: React.RefObject<HTMLDialogElement | null> }) {
  const s = useA11ySettings()
  const close = () => ref.current?.close()
  return (
    <dialog ref={ref} className="a11y-dialog" aria-labelledby="a11y-title" onClick={e => { if (e.target === ref.current) close() }}>
      <header className="a11y-head">
        <div>
          <h2 id="a11y-title">Accessibility</h2>
          <p>Saved on this device for every player.</p>
        </div>
        <button type="button" className="a11y-close" onClick={close} aria-label="Close">
          <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </header>

      <section className="a11y-section" aria-labelledby="a11y-size-title">
        <h3 id="a11y-size-title">Text size</h3>
        <div className="a11y-sizes" role="radiogroup" aria-label="Text size">
          {TEXT_SIZES.map(size => (
            <button key={size} type="button" role="radio" aria-checked={s.textSize === size}
              className={s.textSize === size ? 'on' : ''} onClick={() => updateSettings({ textSize: size })}
              aria-label={`${SIZE_LABEL[size]} text, ${size} percent`}>
              <span className="a11y-glyph" style={{ fontSize: `${0.8 + (size - 100) / 100}rem` }} aria-hidden="true">A</span>
              <span className="a11y-size-name">{SIZE_LABEL[size]}</span>
            </button>
          ))}
        </div>
        <p className="a11y-sample" aria-hidden="true">
          <strong>Brannoc Ashvale</strong> · Fighter 5 · <span className="a11y-sample-hp">49 / 56 HP</span>
        </p>
      </section>

      {GROUPS.map(g => (
        <section key={g.title} className="a11y-section" aria-labelledby={`a11y-${g.title}`}>
          <h3 id={`a11y-${g.title}`}>{g.title}</h3>
          <div className="a11y-options">
            {g.options.map(o => (
              <button key={o.key} type="button" role="switch" aria-checked={s[o.key]} className={`a11y-option ${s[o.key] ? 'on' : ''}`}
                onClick={() => updateSettings({ [o.key]: !s[o.key] })}>
                <span className="a11y-icon" aria-hidden="true">{o.icon}</span>
                <span className="a11y-text">
                  <span className="a11y-label">{o.label}</span>
                  <span className="a11y-hint">{o.hint}</span>
                </span>
                <span className="a11y-switch" aria-hidden="true"><span /></span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {s.shortcuts && (
        <p className="a11y-keys">
          {SHORTCUTS.map(([k, what]) => <span key={k}><kbd>{k}</kbd> {what}</span>)}
          <span><kbd>←</kbd><kbd>→</kbd> Move in a group</span>
        </p>
      )}

      <footer className="a11y-foot">
        <button type="button" className="btn ghost" onClick={() => updateSettings(DEFAULT_SETTINGS)} disabled={s === DEFAULT_SETTINGS || sameAsDefault(s)}>Reset</button>
        <button type="button" className="btn primary" onClick={close}>Done</button>
      </footer>
    </dialog>
  )
}

const SIZE_LABEL: Record<TextSize, string> = { 100: 'Default', 115: 'Large', 130: 'Larger', 150: 'Largest' }
const sameAsDefault = (s: A11ySettings) => (Object.keys(DEFAULT_SETTINGS) as (keyof A11ySettings)[]).every(k => s[k] === DEFAULT_SETTINGS[k])

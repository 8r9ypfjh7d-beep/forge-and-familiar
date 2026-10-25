import { useEffect, useRef, useState } from 'react'
import { DEFAULT_THEME_ID, suggestedThemeId, themeById, THEMES, type Theme } from './themes'
import './themes.css'

/** A "Theme" button that opens a swatch list. The class's suggested theme is listed first. */
export function ThemePicker({ value, classId, onChange }: {
  value: string | undefined
  classId: string | undefined
  onChange: (id: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const suggested = suggestedThemeId(classId)
  const current = themeById(value)?.id ?? DEFAULT_THEME_ID
  const ordered = [...THEMES].sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested))

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open])

  const pick = (id: string, name: string) => {
    setOpen(false)
    if (id !== current) onChange(id, name)
  }

  return (
    <div className="ff-theme-picker" ref={box}>
      <button type="button" className="btn ghost small ff-theme-toggle" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>
        <span className="ff-theme-dot" aria-hidden="true" /> Theme
      </button>
      {open && (
        <div className="ff-theme-menu" role="group" aria-label="Character theme">
          <Option current={current} id={DEFAULT_THEME_ID} name="App default" blurb="Follows your light or dark setting" onPick={pick} />
          {ordered.map(t => (
            <Option key={t.id} current={current} id={t.id} name={t.name} blurb={t.blurb} theme={t} suggested={t.id === suggested} onPick={pick} />
          ))}
        </div>
      )}
    </div>
  )
}

function Option({ current, id, name, blurb, theme, suggested, onPick }: {
  current: string
  id: string
  name: string
  blurb: string
  theme?: Theme
  suggested?: boolean
  onPick: (id: string, name: string) => void
}) {
  const k = theme?.tokens
  return (
    <button type="button" className="ff-theme-option" aria-pressed={current === id} onClick={() => onPick(id, name)}>
      <span
        className={`ff-theme-swatch ${k ? '' : 'auto'}`}
        aria-hidden="true"
        style={k && { background: k.bg, borderColor: k.line, boxShadow: `inset -14px 0 0 ${k.accent}, inset -22px 0 0 ${k.panel}` }}
      />
      <span className="ff-theme-text">
        <span className="ff-theme-name">{name}{suggested && <span className="ff-theme-tag">Suits your class</span>}</span>
        <span className="ff-theme-blurb">{blurb}</span>
      </span>
    </button>
  )
}

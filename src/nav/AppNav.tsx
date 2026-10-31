// The app's top bar: tabs for everyday screens, a More menu for reference screens,
// and a player menu (who's playing, language, accessibility) at the end.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useA11yActiveCount } from '../a11y/ui'
import { LanguagePicker, useI18n } from '../i18n'
import { inbox, useRequests } from '../requests'
import { NavIcon } from './icons'
import { navItems, navKeyFor, type NavContext, type NavKey } from './items'
import './nav.css'

export function AppNav({ viewKind, onGo, playerName, isDm, partyDm, admin, dmTools, dmBadge, onAccessibility, children }: NavContext & {
  viewKind: string
  onGo: (key: NavKey) => void
  playerName: string
  /** Shown next to the player's name, e.g. the DM badge. */
  dmBadge?: ReactNode
  onAccessibility: () => void
  /** Extra controls for the player menu, e.g. the player switcher. */
  children?: ReactNode
}) {
  const { t } = useI18n()
  const { main, more } = navItems({ isDm, partyDm, admin, dmTools })
  const current = navKeyFor(viewKind)
  const requests = useRequests()
  const waiting = isDm && requests ? inbox(requests).length : 0
  const a11yOn = useA11yActiveCount()
  const inMore = more.find(i => i.key === current)

  const tab = (key: NavKey, label: string, short: string, badge = 0) => (
    <button key={key} type="button" className={`nav-tab ${current === key ? 'on' : ''}`}
      aria-current={current === key ? 'page' : undefined} onClick={() => onGo(key)}
      aria-label={badge > 0 ? `${label} (${badge})` : label}>
      <span className="nav-icon"><NavIcon name={key} />{badge > 0 && <span className="nav-badge">{badge}</span>}</span>
      <span className="nav-label">{label}</span>
      {short !== label && <span className="nav-label short" aria-hidden="true">{short}</span>}
    </button>
  )

  return (
    <header className="topbar nav glass-chrome">
      <nav className="nav-tabs" aria-label={t('nav.main')}>
        {main.map(i => tab(i.key, t(i.label), t(i.short ?? i.label), i.key === 'dm' ? waiting : 0))}
        <Menu
          className={`nav-tab ${inMore ? 'on' : ''}`}
          label={<><span className="nav-icon"><NavIcon name={inMore?.key ?? 'more'} /></span><span className="nav-label">{inMore ? t(inMore.label) : t('nav.more')}</span></>}
          title={t('nav.more')}
          menu
        >
          {close => more.map(i => (
            <button key={i.key} type="button" role="menuitem" className={`nav-item ${current === i.key ? 'on' : ''}`}
              aria-current={current === i.key ? 'page' : undefined} onClick={() => { close(); onGo(i.key) }}>
              <NavIcon name={i.key} />{t(i.label)}
            </button>
          ))}
        </Menu>
      </nav>
      <Menu
        className="nav-player"
        end
        label={<><span className="nav-avatar" aria-hidden="true">{playerName.slice(0, 1).toUpperCase()}</span><span className="nav-name">{playerName}</span>{dmBadge}</>}
        title={t('nav.playerMenu')}
      >
        {close => (
          <div className="nav-settings">
            {children}
            <label className="nav-field">
              <span className="muted small">{t('app.language')}</span>
              <LanguagePicker />
            </label>
            <button type="button" className="nav-item" onClick={() => { close(); onAccessibility() }}>
              <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="4" r="2" fill="currentColor"/><path d="M3.5 7.5 10 9l6.5-1.5M10 9v4l-3 5M10 13l3 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t('nav.accessibility')}
              {a11yOn > 0 && <span className="nav-badge inline">{a11yOn}</span>}
            </button>
          </div>
        )}
      </Menu>
    </header>
  )
}

/** A button with a drop-down panel that closes on outside click, Escape, or by the panel itself. */
function Menu({ className, label, title, end, menu, children }: {
  className: string
  label: ReactNode
  title: string
  end?: boolean
  /** A list of choices (role=menu) rather than a panel of controls. */
  menu?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="nav-menu" ref={box}>
      <button ref={button} type="button" className={className} aria-haspopup={menu ? 'menu' : undefined} aria-expanded={open} aria-controls={id}
        title={title} onClick={() => setOpen(o => !o)}>
        {label}
      </button>
      <div id={id} className={`nav-panel panel glass-sheet ${end ? 'end' : ''}`} role={menu ? 'menu' : undefined} aria-label={title} hidden={!open}>
        {open && children(() => setOpen(false))}
      </div>
    </div>
  )
}

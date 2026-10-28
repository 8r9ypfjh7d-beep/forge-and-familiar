// Accessibility preferences: saved per device, applied as data attributes on <html> that a11y.css reads.

export const TEXT_SIZES = [100, 115, 130, 150] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export interface A11ySettings {
  /** Black-on-white (or white-on-black) palette with solid borders. */
  highContrast: boolean
  /** Root font size in percent; every rem-based size scales with it. */
  textSize: TextSize
  /** Plain sans-serif headings, no all-caps labels, wider line spacing. */
  easyRead: boolean
  /** Turn off transitions and animations, even if the OS setting is off. */
  reduceMotion: boolean
  /** Solid surfaces instead of see-through glass, even if the OS setting is off. */
  reduceTransparency: boolean
  /** Thick, high-contrast focus ring on every focusable control. */
  strongFocus: boolean
  /** At least 44px tall buttons and inputs. */
  largeTargets: boolean
  /** Single-key shortcuts (c, b, d, p, a). Off for people who type by voice or switch. */
  shortcuts: boolean
}

export const DEFAULT_SETTINGS: A11ySettings = {
  highContrast: false,
  textSize: 100,
  easyRead: false,
  reduceMotion: false,
  reduceTransparency: false,
  strongFocus: false,
  largeTargets: false,
  shortcuts: true,
}

const KEY = 'ff.a11y.v1'

/** Keeps known fields with the right type; anything else falls back to the default. */
export function sanitize(raw: unknown): A11ySettings {
  const out = { ...DEFAULT_SETTINGS }
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof A11ySettings)[]) {
    if (k === 'textSize') {
      if (TEXT_SIZES.includes(r.textSize as TextSize)) out.textSize = r.textSize as TextSize
    } else if (typeof r[k] === 'boolean') {
      out[k] = r[k] as boolean
    }
  }
  return out
}

/** The attributes set on <html>. Absent means off, so the default page is untouched. */
export function toAttributes(s: A11ySettings): Record<string, string | null> {
  return {
    'data-contrast': s.highContrast ? 'high' : null,
    'data-easy-read': s.easyRead ? '' : null,
    'data-motion': s.reduceMotion ? 'reduce' : null,
    'data-transparency': s.reduceTransparency ? 'reduce' : null,
    'data-focus': s.strongFocus ? 'strong' : null,
    'data-targets': s.largeTargets ? 'large' : null,
  }
}

export function applyToDocument(s: A11ySettings, root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(toAttributes(s))) {
    if (value === null) root.removeAttribute(name)
    else root.setAttribute(name, value)
  }
  root.style.fontSize = s.textSize === 100 ? '' : `${s.textSize}%`
}

export function loadSettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(KEY)
    return sanitize(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let current: A11ySettings = typeof localStorage === 'undefined' ? { ...DEFAULT_SETTINGS } : loadSettings()
const listeners = new Set<() => void>()

export const getSettings = () => current
export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function updateSettings(patch: Partial<A11ySettings>) {
  current = sanitize({ ...current, ...patch })
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* private mode: keep in memory */ }
  if (typeof document !== 'undefined') applyToDocument(current)
  listeners.forEach(fn => fn())
}

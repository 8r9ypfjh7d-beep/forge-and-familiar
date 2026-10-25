// The chosen language: saved per device, mirrored onto <html lang dir>, observable for React.
import { isLocale, LOCALES, translate, term, type Locale, type Vars } from './translate'
import type { MessageKey } from './locales/en'

const KEY = 'ff.locale.v1'
const listeners = new Set<() => void>()

function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  const nav = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
  for (const tag of nav) {
    const base = tag?.slice(0, 2).toLowerCase()
    if (base === 'iw') return 'he'
    if (isLocale(base)) return base
  }
  return 'en'
}

let current: Locale = initial()

function applyToDocument() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = current
  document.documentElement.dir = LOCALES[current].dir
}
applyToDocument()

export const getLocale = () => current

export function setLocale(locale: Locale) {
  if (locale === current) return
  current = locale
  try {
    localStorage.setItem(KEY, locale)
  } catch {
    // Not saved; the choice still applies until reload.
  }
  applyToDocument()
  listeners.forEach(l => l())
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Translate with the current language, for code outside React components. */
export const t = (key: MessageKey, vars?: Vars) => translate(current, key, vars)
export const tTerm = (kind: string, id: string, fallback: string) => term(current, kind, id, fallback)

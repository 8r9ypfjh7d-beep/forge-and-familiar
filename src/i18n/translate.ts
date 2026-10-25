// Pure lookup: message keys, {var} interpolation, plurals and SRD term names. No React, no storage.
import { en, type MessageKey } from './locales/en'
import { he } from './locales/he'

export type Locale = 'en' | 'he'
export type Vars = Record<string, string | number>
export type Translate = (key: MessageKey, vars?: Vars) => string

type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
/** Partial message table: missing keys fall back to English. Plural variants are `key_one`, `key_two`... */
export type Messages = Partial<Record<MessageKey | `${MessageKey}_${PluralForm}`, string>>
/** SRD names keyed `kind.id` (race.elf, skill.stealth...). Missing terms keep the English name. */
export type Terms = Record<string, string>

export interface LocaleInfo {
  code: Locale
  /** Name in its own language, for the picker. */
  name: string
  dir: 'ltr' | 'rtl'
  messages: Messages
  terms: Terms
}

export const LOCALES: Record<Locale, LocaleInfo> = {
  en: { code: 'en', name: 'English', dir: 'ltr', messages: en, terms: {} },
  he: { code: 'he', name: 'עברית', dir: 'rtl', messages: he.messages, terms: he.terms },
}

export const isLocale = (s: unknown): s is Locale => typeof s === 'string' && s in LOCALES

const plurals = new Map<Locale, Intl.PluralRules>()
const pluralOf = (locale: Locale, n: number) => {
  if (!plurals.has(locale)) plurals.set(locale, new Intl.PluralRules(locale))
  return plurals.get(locale)!.select(n)
}

/**
 * Looks up `key` for `locale`. With a numeric `count` var, `key_one` / `key_two` / `key_other`
 * variants are tried first (Hebrew has a dual form). Unknown `{vars}` are left as written.
 */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const table = LOCALES[locale].messages as Record<string, string | undefined>
  const fallback = en as Record<string, string | undefined>
  let text: string | undefined
  if (typeof vars?.count === 'number') {
    const form = `${key}_${pluralOf(locale, vars.count)}`
    text = table[form] ?? table[`${key}_other`] ?? fallback[`${key}_${pluralOf('en', vars.count)}`] ?? fallback[`${key}_other`]
  }
  text ??= table[key] ?? fallback[key] ?? key
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text
}

/** SRD name for `kind.id` in `locale`, or `fallback` (the English data name). */
export function term(locale: Locale, kind: string, id: string, fallback: string): string {
  return LOCALES[locale].terms[`${kind}.${id}`] ?? fallback
}

// A saved map's name in the current language. Maps store the name they were made with, so a template map made
// in English still reads "Tavern"; names that match a template (or "Untitled map") in any language are re-translated.
import { LOCALES, isLocaleLoaded, translate, type Locale, type MessageKey } from '../i18n'
import { TEMPLATE_IDS } from './templates'

const KEYS: MessageKey[] = [...TEMPLATE_IDS.map(id => `maps.tpl.${id}` as MessageKey), 'maps.untitled']
let known: Map<string, MessageKey> | null = null
let knownFor = ''

/** The message key a stored map name came from, if it is a stock name in any language. */
export function stockNameKey(name: string): MessageKey | undefined {
  // Rebuilt when another language's tables arrive (Hebrew loads on demand).
  const locales = (Object.keys(LOCALES) as Locale[]).filter(isLocaleLoaded)
  if (!known || knownFor !== locales.join()) {
    known = new Map()
    knownFor = locales.join()
    for (const locale of locales) for (const key of KEYS) known.set(translate(locale, key).trim().toLowerCase(), key)
  }
  return known.get(name.trim().toLowerCase())
}

/** The map's name to show: stock names follow the current language, the DM's own names stay as typed. */
export function mapName(name: string | undefined, t: (key: MessageKey) => string): string {
  if (!name?.trim()) return t('maps.untitled')
  const key = stockNameKey(name)
  return key ? t(key) : name
}

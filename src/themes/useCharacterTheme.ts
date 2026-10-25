import { useEffect } from 'react'
import { themeById, themeVars } from './themes'

/**
 * Paints the whole page in a character's theme while the calling screen is mounted,
 * and puts the app's own look back when it unmounts or the theme is cleared.
 */
export function useCharacterTheme(themeId: string | undefined) {
  useEffect(() => {
    const theme = themeById(themeId)
    if (!theme) return
    const root = document.documentElement
    const vars = themeVars(theme)
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    root.style.setProperty('color-scheme', theme.scheme)
    root.dataset.ffTheme = theme.id
    document.body.style.backgroundImage = theme.backdrop
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k)
      root.style.removeProperty('color-scheme')
      delete root.dataset.ffTheme
      document.body.style.backgroundImage = ''
    }
  }, [themeId])
}

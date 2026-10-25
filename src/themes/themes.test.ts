import { describe, expect, it } from 'vitest'
import { CLASSES } from '../rules'
import { contrast, suggestedThemeId, themeById, THEMES, themeVars } from './themes'

describe('themes', () => {
  it('have unique ids', () => {
    expect(new Set(THEMES.map(t => t.id)).size).toBe(THEMES.length)
  })

  it('suggest an existing theme for every class', () => {
    for (const c of CLASSES) expect(themeById(suggestedThemeId(c.id)), c.id).toBeDefined()
  })

  it('fall back to nothing for unknown ids', () => {
    expect(themeById('nope')).toBeUndefined()
    expect(themeById(undefined)).toBeUndefined()
    expect(suggestedThemeId('artificer')).toBeUndefined()
  })

  it('map onto the app tokens', () => {
    const vars = themeVars(THEMES[0])
    expect(vars['--bg']).toBe(THEMES[0].tokens.bg)
    expect(vars['--accent']).toBe(THEMES[0].tokens.accent)
  })

  describe.each(THEMES)('$name stays readable', t => {
    const k = t.tokens
    it('body and muted text', () => {
      expect(contrast(k.ink, k.panel)).toBeGreaterThanOrEqual(7)
      expect(contrast(k.ink, k.bg)).toBeGreaterThanOrEqual(7)
      expect(contrast(k.muted, k.panel)).toBeGreaterThanOrEqual(4.5)
    })
    it('white text on filled buttons', () => {
      for (const fill of [k.accent, k.good, k.bad]) expect(contrast('#ffffff', fill), fill).toBeGreaterThanOrEqual(4.5)
    })
    it('accent, good, bad and temp against the panel', () => {
      for (const c of [k.accent, k.good, k.bad, k.temp]) expect(contrast(c, k.panel), c).toBeGreaterThanOrEqual(3)
    })
  })
})

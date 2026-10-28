/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { edgeLevel, scrollLevels, EDGE_RANGE } from './scrollGlass'
import { toAttributes, DEFAULT_SETTINGS } from '../a11y/settings'

describe('dynamic opacity', () => {
  it('is clear when nothing is under the edge and solid after the range', () => {
    expect(edgeLevel(0)).toBe(0)
    expect(edgeLevel(-30)).toBe(0)
    expect(edgeLevel(EDGE_RANGE / 2)).toBe(0.5)
    expect(edgeLevel(EDGE_RANGE * 3)).toBe(1)
    expect(edgeLevel(Number.NaN)).toBe(0)
  })

  it('reads the top from scroll and the bottom from what is left below', () => {
    expect(scrollLevels(0, 800, 2000)).toEqual({ top: 0, bottom: 1 })
    expect(scrollLevels(1200, 800, 2000)).toEqual({ top: 1, bottom: 0 })
    expect(scrollLevels(0, 800, 600)).toEqual({ top: 0, bottom: 0 })
  })
})

describe('glass fallbacks', () => {
  // ?raw imports of CSS come back empty under Vitest, so read the file itself.
  const css = readFileSync(new URL('./glass.css', import.meta.url), 'utf8')

  it('turns glass solid for reduce transparency, high contrast and the OS setting', () => {
    expect(css).toMatch(/:root\[data-transparency="reduce"\], :root\[data-contrast="high"\]/)
    expect(css).toMatch(/prefers-reduced-transparency: reduce/)
    expect(css).toMatch(/--glass-blur: none/)
  })

  it('maps the reduce transparency switch to its attribute', () => {
    expect(toAttributes({ ...DEFAULT_SETTINGS, reduceTransparency: true })['data-transparency']).toBe('reduce')
  })

  it('uses logical properties only, so RTL needs no overrides', () => {
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
  })
})

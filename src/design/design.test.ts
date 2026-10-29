/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
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

  it('keeps the shared primitives, dialogs and banner on logical properties too', () => {
    for (const file of ['../index.css', '../a11y/a11y.css', '../pwa/pwa.css', '../requests/requests.css']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(text, file).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
    }
  })

  it('gives dialogs a scrim whose blur turns off with the other fallbacks', () => {
    expect(css).toMatch(/\.glass-dialog::backdrop \{[^}]*var\(--glass-scrim\)/)
    expect(css.match(/--glass-scrim-blur: none/g)?.length).toBe(2)
  })
})

describe('every screen follows the standard', () => {
  const src = new URL('../', import.meta.url)
  const sheets = (readdirSync(src, { recursive: true }) as string[])
    .filter(f => f.endsWith('.css'))
    .map(f => ({ file: f, text: readFileSync(new URL(f, src), 'utf8') }))
  // Palettes live in index.css (colours), a11y.css (high contrast) and glass.css (glass); print is paper; crit and rock are effects.
  const PALETTES = /(^|\/)(index|a11y|glass|print|crit|rock)\.css$/

  it('finds the screen CSS', () => {
    expect(sheets.length).toBeGreaterThan(20)
  })

  it('uses logical properties everywhere, so Hebrew needs no overrides', () => {
    for (const { file, text } of sheets) expect(text, file).not.toMatch(/(margin|padding|border)-(left|right)|[^-]\b(left|right):/)
  })

  it('reads blur from the glass tokens, so the fallbacks can turn it off', () => {
    for (const { file, text } of sheets.filter(s => !s.file.endsWith('glass.css'))) expect(text, file).not.toMatch(/backdrop-filter:\s*blur/)
  })

  it('takes colours from tokens instead of hard-coding them', () => {
    for (const { file, text } of sheets.filter(s => !PALETTES.test(s.file))) expect(text, file).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it('keeps the selected segment visible when glass turns solid', () => {
    const css = sheets.find(s => s.file.endsWith('glass.css'))!.text
    expect(css.match(/--glass-raised: inset 0 0 0 2px var\(--accent\)/g)?.length).toBe(2)
    for (const { file, text } of sheets) {
      for (const rule of text.match(/[^{}]*(\.on|is-on|="true"\][^{]*)\s*\{[^}]*background: var\(--glass-thick\)[^}]*\}/g) ?? []) {
        expect(rule, file).toMatch(/var\(--glass-raised\)/)
      }
    }
  })
})


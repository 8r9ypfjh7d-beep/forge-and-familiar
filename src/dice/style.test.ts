/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// ?raw imports of CSS come back empty under Vitest, so read the files themselves.
const read = (f: string) => readFileSync(new URL(`./ui/${f}`, import.meta.url), 'utf8')

describe('dice styles', () => {
  it.each(['dice.css', 'crit.css'])('%s uses logical properties only, so RTL needs no overrides', f => {
    expect(read(f)).not.toMatch(/(margin|padding|border)-(left|right|top|bottom)\b|[{;\s](left|right|top|bottom):/)
  })

  it('reads the glass tokens instead of hard-coded surfaces', () => {
    const css = read('dice.css')
    expect(css).toMatch(/\.ff-dice-fab__panel \{[^}]*var\(--glass-thick\)[^}]*var\(--glass-blur-strong\)/)
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })

  it('draws edges in high contrast', () => {
    expect(read('dice.css')).toMatch(/:root\[data-contrast="high"\] \.ff-dice-fab__button/)
  })
})

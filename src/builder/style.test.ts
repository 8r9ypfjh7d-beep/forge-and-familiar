/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Builder, edit character, "why?" tips and level history follow src/design/DESIGN.md.
const files = ['./builder.css', './why.css', '../portability/ui/portability.css']

describe('builder styles', () => {
  for (const f of files) {
    const css = readFileSync(new URL(f, import.meta.url), 'utf8')
    it(`${f} uses logical properties only, so Hebrew needs no overrides`, () => {
      expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right|top|bottom):|(^|[\s;{])(width|height):/m)
    })
    it(`${f} paints surfaces with glass tokens, not hard-coded colours`, () => {
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(\s*255/i)
    })
  }
})

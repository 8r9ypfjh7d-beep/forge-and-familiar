/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// ?raw imports of CSS come back empty under Vitest, so read the file itself.
const css = readFileSync(new URL('./combat.css', import.meta.url), 'utf8')

describe('combat tracker styles', () => {
  it('uses logical properties only, so RTL needs no overrides', () => {
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
  })

  it('takes surfaces from glass tokens, not hard-coded whites', () => {
    expect(css).not.toMatch(/#fff\b|rgba?\(\s*255/i)
  })
})

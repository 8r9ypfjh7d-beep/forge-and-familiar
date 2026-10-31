/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// ?raw imports of CSS come back empty under Vitest, so read the file itself.
const css = readFileSync(new URL('./npc.css', import.meta.url), 'utf8')

describe('NPC sheet styles', () => {
  it('uses logical properties only, so RTL needs no overrides', () => {
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
  })

  it('takes surfaces from glass tokens, not hard-coded colours or blur', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|blur\(/i)
  })
})

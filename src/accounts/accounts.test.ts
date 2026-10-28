/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { normalizeActivationCode } from './codes'
import { ROSTER } from './roster'
import { activateErrorKey } from './session'

describe('activation codes', () => {
  it('normalizes case, spaces and dashes', () => {
    expect(normalizeActivationCode(' roy-7pbj 2msu ')).toBe('ROY7PBJ2MSU')
  })

  it('explains each way a code can fail', () => {
    expect(activateErrorKey('wrong')).toBe('account.badCode')
    expect(activateErrorKey('limited')).toBe('account.tooManyTries')
    expect(activateErrorKey('offline')).toBe('account.needsConnection')
  })

  it('keeps the group roster well formed, with no code hashes in the site', () => {
    expect(new Set(ROSTER.map(a => a.id)).size).toBe(ROSTER.length)
    expect(ROSTER.filter(a => a.role === 'dm').map(a => a.name)).toEqual(['Noa'])
    expect(JSON.stringify(ROSTER)).not.toMatch(/[0-9a-f]{32}/)
  })
})

describe('welcome and sync card styles', () => {
  // ?raw imports of CSS come back empty under Vitest, so read the file itself.
  const css = readFileSync(new URL('./accounts.css', import.meta.url), 'utf8')

  it('use logical properties only, so RTL needs no overrides', () => {
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
  })

  it('use glass tokens, not hard-coded surfaces', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i)
  })
})

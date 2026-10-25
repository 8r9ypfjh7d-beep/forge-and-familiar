import { describe, expect, it } from 'vitest'
import {
  addMember, CODE_ALPHABET, CODE_LENGTH, formatCode, isValidCode, makeInviteCode, normalizeCode, removeMember, setMemberCharacter,
} from './code'
import type { Party } from './types'

const party: Party = {
  id: 'p1', name: 'The Lost Mine', code: 'ABC234', dmId: 'dm',
  members: [{ userId: 'dm', joinedAt: '2026-01-01T00:00:00Z' }],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

describe('invite codes', () => {
  it('makes 6-character codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = makeInviteCode()
      expect(code).toHaveLength(CODE_LENGTH)
      expect(isValidCode(code)).toBe(true)
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/)
  })

  it('skips biased bytes', () => {
    const bytes = [255, 254, 253, 252, 251, 250, 0, 1, 2, 3, 4, 5]
    let i = 0
    const code = makeInviteCode(n => Uint8Array.from({ length: n }, () => bytes[i++ % bytes.length]))
    expect(code).toBe('ABCDEF')
  })

  it('accepts codes typed loosely', () => {
    expect(normalizeCode(' abc-234 ')).toBe('ABC234')
    expect(isValidCode(normalizeCode('abc 234'))).toBe(true)
    expect(isValidCode('ABC23')).toBe(false)
    expect(isValidCode('ABC0O1')).toBe(false)
    expect(formatCode('ABC234')).toBe('ABC-234')
  })
})

describe('membership', () => {
  it('adds a player with a character once', () => {
    const p = addMember(party, 'ana', 'c1')
    expect(p.members).toHaveLength(2)
    expect(addMember(p, 'ana').members).toHaveLength(2)
    expect(addMember(p, 'ana', 'c2').members.find(m => m.userId === 'ana')?.characterId).toBe('c2')
  })

  it('switches or clears the character', () => {
    const p = setMemberCharacter(addMember(party, 'ana', 'c1'), 'ana', undefined)
    expect(p.members.find(m => m.userId === 'ana')?.characterId).toBeUndefined()
  })

  it('hands the DM role on when the DM leaves', () => {
    const p = removeMember(addMember(party, 'ana', 'c1'), 'dm')
    expect(p?.dmId).toBe('ana')
    expect(p?.members.map(m => m.userId)).toEqual(['ana'])
  })

  it('deletes the party when the last player leaves', () => {
    expect(removeMember(party, 'dm')).toBeNull()
  })
})

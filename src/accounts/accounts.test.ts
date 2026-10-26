import { describe, expect, it } from 'vitest'
import { findInRoster, hashActivationCode, normalizeActivationCode } from './codes'
import { ROSTER, type RosterEntry } from './roster'

const TEST_ROSTER: RosterEntry[] = [
  { id: 'acct-test', name: 'Test', role: 'player', hash: '' },
  { id: 'acct-dm', name: 'Dee', role: 'dm', hash: '' },
]

describe('activation codes', () => {
  it('normalizes case, spaces and dashes', () => {
    expect(normalizeActivationCode(' roy-7pbj 2msu ')).toBe('ROY7PBJ2MSU')
  })

  it('hashes the normalized code with SHA-256', async () => {
    // sha256("ABC")
    expect(await hashActivationCode('a-b c')).toBe('b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78')
  })

  it('finds the account a code belongs to, typed loosely', async () => {
    const roster = await Promise.all(TEST_ROSTER.map(async (a, i) => ({ ...a, hash: await hashActivationCode(['TEST-AAAA-BBBB', 'DEE-CCCC-DDDD'][i]) })))
    expect(await findInRoster('test aaaa bbbb', roster)).toEqual({ id: 'acct-test', name: 'Test', role: 'player' })
    expect((await findInRoster('dee-cccc-dddd', roster))?.role).toBe('dm')
    expect(await findInRoster('TEST-AAAA-BBBC', roster)).toBeUndefined()
  })

  it('keeps the group roster well formed', () => {
    expect(new Set(ROSTER.map(a => a.id)).size).toBe(ROSTER.length)
    expect(new Set(ROSTER.map(a => a.hash)).size).toBe(ROSTER.length)
    for (const a of ROSTER) expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(ROSTER.filter(a => a.role === 'dm').map(a => a.name)).toEqual(['Noa'])
  })
})

import { describe, expect, it } from 'vitest'
import { isAdmin } from '../accounts/roster'
import { buildBackup, describeKey, keyRows, parseBackup, people, restorePlan } from './logic'

describe('admin', () => {
  it('makes only Ziv the admin, by account id', () => {
    expect(isAdmin('acct-ziv')).toBe(true)
    expect(isAdmin('acct-noa')).toBe(false)
    expect(isAdmin('some-local-profile')).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })

  it('names saved keys and their owner', () => {
    expect(describeKey('ff.characters.v1')).toEqual({ kind: 'characters' })
    expect(describeKey('ff.dm.v1.acct-noa')).toEqual({ kind: 'dm', ownerId: 'acct-noa' })
    expect(describeKey('ff.rolls.secret.v1.p1')).toEqual({ kind: 'secretRolls', ownerId: 'p1' })
    expect(describeKey('ff.rolls.v1.acct-roy')).toEqual({ kind: 'rolls', ownerId: 'acct-roy' })
    expect(describeKey('ff.locale.v1')).toEqual({ kind: 'other' })
  })

  it('lists only app keys, with list sizes', () => {
    const rows = keyRows([
      { key: 'other.site', value: 'x' },
      { key: 'ff.requests.v1', value: '[{},{}]' },
      { key: 'ff.locale.v1', value: '"he"' },
    ])
    expect(rows.map(r => r.key)).toEqual(['ff.locale.v1', 'ff.requests.v1'])
    expect(rows[1]).toMatchObject({ items: 2, kind: 'requests', bytes: 7 })
    expect(rows[0].items).toBeUndefined()
  })

  it('round-trips a backup and rejects other files', () => {
    const b = buildBackup([{ key: 'ff.characters.v1', value: '[]' }, { key: 'x', value: '1' }], '2026-10-27T00:00:00Z')
    expect(Object.keys(b.data)).toEqual(['ff.characters.v1'])
    expect(parseBackup(JSON.stringify(b))).toEqual(b)
    expect(parseBackup('{"format":"forge-and-familiar/character"}')).toBeNull()
    expect(parseBackup('not json')).toBeNull()
    const sneaky = { ...b, data: { 'ff.ok': 'v', evil: 'v', 'ff.num': 3 } }
    expect(parseBackup(JSON.stringify(sneaky))?.data).toEqual({ 'ff.ok': 'v' })
  })

  it('restores everything but the signed-in account', () => {
    const b = buildBackup([{ key: 'ff.characters.v1', value: '[1]' }, { key: 'ff.account.v1', value: 'roy' }], 'now')
    const plan = restorePlan(['ff.characters.v1', 'ff.account.v1', 'ff.dm.v1.a', 'other'], b)
    expect(plan.set).toEqual([{ key: 'ff.characters.v1', value: '[1]' }])
    expect(plan.remove).toEqual(['ff.dm.v1.a'])
  })

  it('lists roster accounts, device profiles and unknown owners', () => {
    const list = people(
      [{ id: 'acct-a', name: 'A', role: 'player', admin: true }, { id: 'acct-d', name: 'D', role: 'dm' }],
      [{ id: 'acct-a', displayName: 'A' }, { id: 'local-1', displayName: 'Guest' }],
      [{ ownerId: 'acct-a' }, { ownerId: 'acct-a' }, { ownerId: 'local-1' }, { ownerId: 'gone' }],
    )
    expect(list.map(p => [p.id, p.account, p.local, p.characters])).toEqual([
      ['acct-a', true, true, 2], ['acct-d', true, false, 0], ['local-1', false, true, 1], ['gone', false, false, 1],
    ])
  })
})

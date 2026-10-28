/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { isAdmin } from '../accounts/roster'
import { buildBackup, cloudPeople, describeKey, deviceOnly, hasUnsentEdits, keyRows, parseBackup, people, restorePlan } from './logic'

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

  it('keeps the server sign-in out of backups and in place on restore', () => {
    const b = buildBackup([{ key: 'ff.supabase.auth', value: 'token' }, { key: 'ff.cloud.v1', value: 'link' }], 'now')
    expect(Object.keys(b.data)).toEqual(['ff.cloud.v1'])
    expect(parseBackup(JSON.stringify({ ...b, data: { 'ff.supabase.auth': 'stolen' } }))?.data).toEqual({})
    const plan = restorePlan(['ff.supabase.auth', 'ff.cloud.v1', 'ff.x'], { ...b, data: {} })
    expect(plan.remove).toEqual(['ff.x'])
    expect(describeKey('ff.dm.pending.v1.acct-noa')).toEqual({ kind: 'dmPending', ownerId: 'acct-noa' })
  })

  it('lists server accounts with devices, characters and DM screen', () => {
    const list = cloudPeople(
      [{ id: 'acct-a', name: 'A', role: 'player', is_admin: true }, { id: 'acct-d', name: 'D', role: 'dm', is_admin: false }],
      [
        { user_id: 'u1', account_id: 'acct-a', linked_at: '2026-10-01' },
        { user_id: 'u2', account_id: 'acct-a', linked_at: '2026-10-05' },
        { user_id: 'u3', account_id: 'acct-d', linked_at: '2026-10-02' },
      ],
      [
        { owner_id: 'acct-a', updated_at: '2026-10-03', deleted: false },
        { owner_id: 'acct-a', updated_at: '2026-10-09', deleted: false },
        { owner_id: 'acct-a', updated_at: '2026-10-20', deleted: true },
      ],
      [{ account_id: 'acct-d', updated_at: '2026-10-04' }],
    )
    expect(list[0]).toMatchObject({ characters: 2, lastSaved: '2026-10-09', dmSavedAt: undefined, admin: true })
    expect(list[0].devices.map(d => d.userId)).toEqual(['u2', 'u1'])
    expect(list[1]).toMatchObject({ characters: 0, dmSavedAt: '2026-10-04', role: 'dm' })
  })

  it('finds characters the server does not have', () => {
    const local = [{ id: 'c1' }, { id: 'c2' }] as Parameters<typeof deviceOnly>[0]
    expect(deviceOnly(local, [{ id: 'c1' }]).map(c => c.id)).toEqual(['c2'])
  })

  it('offers to send edits only when this device saved a different, newer copy', () => {
    const server = { data: { id: 'c', name: 'A', updatedAt: '2026-10-01' } as Parameters<typeof hasUnsentEdits>[0] & object, updated_at: '2026-10-02' }
    expect(hasUnsentEdits(undefined, server)).toBe(false)
    expect(hasUnsentEdits({ ...server.data, updatedAt: '2026-10-01' }, server)).toBe(false)
    expect(hasUnsentEdits({ ...server.data, updatedAt: '2026-10-03' }, server)).toBe(false)
    expect(hasUnsentEdits({ ...server.data, name: 'B', updatedAt: '2026-10-03' }, server)).toBe(true)
  })
})

describe('admin styles', () => {
  const css = readFileSync(new URL('./admin.css', import.meta.url), 'utf8')

  it('follows the glass standard: tokens, logical properties, solid fallbacks', () => {
    expect(css).not.toMatch(/(margin|padding|border)-(left|right)|\b(left|right):/)
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i)
    expect(css).toMatch(/:root\[data-contrast="high"\]/)
    // The selected tab's ring in solid modes comes from the shared segmented control (--glass-raised), not a copy here.
    expect(css).not.toMatch(/admin-tabs > button\.on \{ box-shadow/)
  })
})

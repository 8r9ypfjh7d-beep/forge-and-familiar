import { describe, expect, it } from 'vitest'
import { ROSTER } from '../accounts/roster'
import MIGRATION from '../../supabase/migrations/20261027090000_foundation.sql?raw'
import { readCloudConfig } from './config'

describe('cloud config', () => {
  it('needs both the URL and the anon key', () => {
    expect(readCloudConfig({})).toBeNull()
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(readCloudConfig({ VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_ANON_KEY: 'k ' }))
      .toEqual({ url: 'https://x.supabase.co', anonKey: 'k' })
  })
})

describe('database roster', () => {
  it('seeds every account with the same id, role, admin flag and code hash as the app', () => {
    for (const a of ROSTER) {
      expect(MIGRATION).toContain(`('${a.id}', '${a.name}', '${a.role}', ${a.admin ? 'true' : 'false'}, '${a.hash}')`)
    }
  })
})

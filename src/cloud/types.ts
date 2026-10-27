// Row shapes of the tables in supabase/migrations. data holds the app's own saved object.
import type { Character } from '../model/character'
import type { DmState } from '../dm/types'
import type { AccountRole } from '../accounts/types'

export interface AccountRow {
  id: string
  name: string
  role: AccountRole
  is_admin: boolean
}

export interface CharacterRow {
  id: string
  owner_id: string
  data: Character
  /** Bumped by the writer: update ... where rev = base, set rev = base + 1. */
  rev: number
  deleted: boolean
  /** Set by the database on every write. */
  updated_at: string
}

export interface DmStateRow {
  account_id: string
  data: DmState
  updated_at: string
}

/** off: no cloud settings in this build. unlinked: cloud on, this device not signed in yet. */
export type CloudStatus = 'off' | 'unlinked' | 'linked'

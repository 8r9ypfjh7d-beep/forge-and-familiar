// The group's accounts. Codes are checked by the server (claim_account), so no code or hash
// ships in the site. To add a friend, see ACCOUNTS.md.
import type { Account } from './types'

export interface RosterEntry extends Account {
  /** Sees and manages everything on the device (the admin page). Independent of role. */
  admin?: boolean
}

export const ROSTER: RosterEntry[] = [
  { id: 'acct-roy', name: 'Roy', role: 'player' },
  { id: 'acct-tamir', name: 'Tamir', role: 'player' },
  { id: 'acct-maayan', name: 'Maayan', role: 'player' },
  { id: 'acct-ziv', name: 'Ziv', role: 'player', admin: true },
  { id: 'acct-noa', name: 'Noa', role: 'dm' },
]

export const rosterName = (id: string) => ROSTER.find(a => a.id === id)?.name

/** Admin is looked up by id, so a device signed in before this flag existed gets it too. */
export const isAdmin = (id: string | undefined) => !!id && !!ROSTER.find(a => a.id === id)?.admin

// The group's activation codes, stored only as SHA-256 hashes of the normalized code,
// so the codes themselves are not in the published site. To add a friend, hash a new
// code (see ACCOUNTS.md) and add a line here.
import type { Account } from './types'

export interface RosterEntry extends Account {
  hash: string
  /** Sees and manages everything on the device (the admin page). Independent of role. */
  admin?: boolean
}

export const ROSTER: RosterEntry[] = [
  { id: 'acct-roy', name: 'Roy', role: 'player', hash: '8196f54313b277689fe88385834829d11c2a50636cda13114ff05480d41ec527' },
  { id: 'acct-tamir', name: 'Tamir', role: 'player', hash: 'c573c7a3402fb5406e910054f9b3b1ddfac0d12baf7f1d7db4ad74a9167c5cd1' },
  { id: 'acct-maayan', name: 'Maayan', role: 'player', hash: '419ff4c59e4a8106536af507d328e0f4e3280b2cdb8b76e6c40542df561ecea0' },
  { id: 'acct-ziv', name: 'Ziv', role: 'player', admin: true, hash: '611d2899a385ff9f78bbc6b5c7ebee5c41a7c2418e6b42e954cef2539d0351ed' },
  { id: 'acct-noa', name: 'Noa', role: 'dm', hash: 'ae4fe1d90de28d2e358728882332e14d3d73882f36c1e76d76da2f0363bff646' },
]

export const rosterName = (id: string) => ROSTER.find(a => a.id === id)?.name

/** Admin is looked up by id, so a device signed in before this flag existed gets it too. */
export const isAdmin = (id: string | undefined) => !!id && !!ROSTER.find(a => a.id === id)?.admin

export type AccountRole = 'player' | 'dm'

/** A friend activated with a personal code. Its id is also their UserProfile id. */
export interface Account {
  id: string
  name: string
  role: AccountRole
}

/** Why a code didn't activate: wrong, too many tries, or no connection to the server. */
export type ActivateError = 'wrong' | 'limited' | 'offline'

/** The signed-in account on this device, with when it was activated. */
export interface Session extends Account {
  activatedAt: string
}

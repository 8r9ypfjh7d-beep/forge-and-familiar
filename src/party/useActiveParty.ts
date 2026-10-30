// Which party the open player is playing in right now, for App: the DM pages follow its DM.
import { useCallback, useEffect, useState } from 'react'
import { activeParty, isPartyDm, lastPartyId, pickedThisVisit, rememberParty } from './active'
import { listParties, onPartiesChanged } from './store'
import type { Party } from './types'

/** The player's parties (null while loading) and the one in play. */
export function useActiveParty(userId: string) {
  // Keyed by player, so switching profiles never shows the last player's parties or pick.
  const [loaded, setLoaded] = useState<{ userId: string; parties: Party[] } | null>(null)
  const [, setPickCount] = useState(0)

  useEffect(() => {
    let live = true
    const load = () => {
      listParties(userId).then(parties => {
        if (!live) return
        // One party: it's the one in play, no need to ask.
        if (parties.length === 1 && !pickedThisVisit(userId)) rememberParty(userId, parties[0].id)
        setLoaded({ userId, parties })
      })
    }
    load()
    const off = onPartiesChanged(load)
    return () => { live = false; off() }
  }, [userId])

  const choose = useCallback((partyId: string | null) => {
    rememberParty(userId, partyId)
    setPickCount(n => n + 1)
  }, [userId])

  const parties = loaded?.userId === userId ? loaded.parties : null
  const party = parties ? activeParty(parties, lastPartyId(userId)) : undefined
  return { parties, party, isDm: isPartyDm(party, userId), choose }
}

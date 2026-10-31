// Applies the DM's live-combat hits to the characters this player brings, on the device that has them.
import { useEffect } from 'react'
import type { Party } from '../../party/types'
import { getCharacter, saveCharacter } from '../../storage'
import { takeHits } from '../hits'
import { watchLiveCombat } from '../live'

export function useLiveHits(userId: string | undefined, parties: Party[] | null) {
  const mine = (parties ?? []).flatMap(p => {
    const m = p.members.find(x => x.userId === userId && x.characterId)
    return m && p.dmId !== userId ? [`${p.id}|${m.characterId}`] : []
  })
  const key = mine.join(',')
  useEffect(() => {
    if (!userId || !key) return
    const stops = key.split(',').map(pair => {
      const [partyId, characterId] = pair.split('|')
      return watchLiveCombat(partyId, false, live => {
        const hits = live?.encounter.hits?.filter(h => h.characterId === characterId)
        if (!hits?.length) return
        getCharacter(characterId).then(c => {
          if (!c || c.ownerId !== userId) return
          const next = takeHits(c, hits)
          if (next !== c) saveCharacter(next)
        })
      })
    })
    return () => { for (const s of stops) s() }
  }, [userId, key])
}

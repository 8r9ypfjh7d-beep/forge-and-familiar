// Adds the DM's XP awards to the characters this player brought, on the device that has them.
import { useEffect } from 'react'
import { getCharacter, saveCharacter } from '../storage'
import type { Party } from './types'
import { takeAwards } from './xp'

export function useXpAwards(userId: string | undefined, parties: Party[] | null) {
  useEffect(() => {
    if (!userId || !parties?.length) return
    const ids = new Set(parties.flatMap(p => p.members.filter(m => m.userId === userId && m.characterId).map(m => m.characterId!)))
    for (const id of ids) {
      getCharacter(id).then(c => {
        if (!c || c.ownerId !== userId) return
        const next = takeAwards(c, parties)
        if (next !== c) saveCharacter(next)
      })
    }
  }, [userId, parties])
}

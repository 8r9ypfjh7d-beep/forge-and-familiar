import { useCallback, useState } from 'react'
import { FRESH_TURN, type TurnState } from './turn'

const key = (characterId: string) => `ff-turn:${characterId}`

function load(characterId: string): TurnState {
  try {
    const raw = sessionStorage.getItem(key(characterId))
    return raw ? { ...FRESH_TURN, ...JSON.parse(raw) } : FRESH_TURN
  } catch {
    return FRESH_TURN
  }
}

/** Turn state for one character, kept for this browser tab only so a reload mid-combat keeps it. */
export function useTurn(characterId: string) {
  const [state, setState] = useState(() => ({ id: characterId, turn: load(characterId) }))
  const turn = state.id === characterId ? state.turn : load(characterId)

  const update = useCallback((change: (t: TurnState) => TurnState) => {
    setState(prev => {
      const next = change(prev.id === characterId ? prev.turn : load(characterId))
      try { sessionStorage.setItem(key(characterId), JSON.stringify(next)) } catch { /* private mode: keep in memory */ }
      return { id: characterId, turn: next }
    })
  }, [characterId])

  return { turn, update }
}

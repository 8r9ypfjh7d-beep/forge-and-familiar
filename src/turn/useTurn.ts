import { useCallback, useSyncExternalStore } from 'react'
import { FRESH_TURN, type TurnState } from './turn'

// One shared store, so every card that reads a character's turn (this checklist, src/reactions) sees the same state.
const key = (characterId: string) => `ff-turn:${characterId}`
const cache = new Map<string, TurnState>()
const listeners = new Set<() => void>()

function read(characterId: string): TurnState {
  let turn = cache.get(characterId)
  if (!turn) {
    try {
      const raw = sessionStorage.getItem(key(characterId))
      turn = raw ? { ...FRESH_TURN, ...JSON.parse(raw) } : FRESH_TURN
    } catch {
      turn = FRESH_TURN
    }
    cache.set(characterId, turn!)
  }
  return turn!
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Turn state for one character, kept for this browser tab only so a reload mid-combat keeps it. */
export function useTurn(characterId: string) {
  const turn = useSyncExternalStore(subscribe, () => read(characterId))

  const update = useCallback((change: (t: TurnState) => TurnState) => {
    const next = change(read(characterId))
    cache.set(characterId, next)
    try { sessionStorage.setItem(key(characterId), JSON.stringify(next)) } catch { /* private mode: keep in memory */ }
    listeners.forEach(l => l())
  }, [characterId])

  return { turn, update }
}

// React bindings: one RollHistory per signed-in user, shared by every component that rolls.
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { roll as rollNotation } from '../roll'
import { localHistoryStorage, RollHistory } from '../history'
import type { RollOptions, RollResult } from '../types'

interface DiceContextValue {
  history: RollHistory
  /** Adds a finished roll (from rollSave, rollAttack...) to the history and returns it. */
  record: (result: RollResult) => RollResult
  /** Rolls free notation like "2d6+3" and records it. Throws DiceNotationError on bad input. */
  roll: (notation: string, opts?: RollOptions) => RollResult
}

const DiceContext = createContext<DiceContextValue | null>(null)

export function DiceProvider({ userId, limit = 100, children }: { userId: string; limit?: number; children: ReactNode }) {
  const value = useMemo<DiceContextValue>(() => {
    const history = new RollHistory(limit, localHistoryStorage(`ff.rolls.v1.${userId}`))
    return {
      history,
      record: r => history.add(r),
      roll: (notation, opts) => history.add(rollNotation(notation, opts)),
    }
  }, [userId, limit])
  return <DiceContext.Provider value={value}>{children}</DiceContext.Provider>
}

export function useDice(): DiceContextValue {
  const ctx = useContext(DiceContext)
  if (!ctx) throw new Error('useDice must be used inside <DiceProvider>')
  return ctx
}

/** Live roll history, newest first. Pass a character id to show only that character's rolls. */
export function useRollHistory(characterId?: string): readonly RollResult[] {
  const { history } = useDice()
  const all = useSyncExternalStore(history.subscribe, history.all)
  return useMemo(() => (characterId ? all.filter(r => r.roller?.characterId === characterId) : all), [all, characterId])
}

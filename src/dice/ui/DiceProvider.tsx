// React bindings: one RollHistory per signed-in user, shared by every component that rolls.
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { roll as rollNotation, setDefaultRng } from '../roll'
import { DiceBag, localBagStorage } from '../bag'
import { localHistoryStorage, RollHistory } from '../history'
import type { RollOptions, RollResult } from '../types'
import { RollFxBus, type RecordOptions } from '../fx'
import { RollFx } from './RollFx'

interface DiceContextValue {
  history: RollHistory
  /** Every recorded roll, for the tumbling-die overlay. */
  fx: RollFxBus
  /** Adds a finished roll (from rollSave, rollAttack...) to the history and returns it. `quiet` skips the nat 1/20 takeover (DM rolls for monsters and NPCs). */
  record: (result: RollResult, opts?: RecordOptions) => RollResult
  /** Rolls free notation like "2d6+3" and records it. Throws DiceNotationError on bad input. */
  roll: (notation: string, opts?: RollOptions) => RollResult
  /** Streak-free dice (bag.ts) for this user on this device. Off by default. */
  streakFree: boolean
  setStreakFree: (on: boolean) => void
}

const streakKey = (userId: string) => `ff.dice.streakFree.v1.${userId}`

function loadStreakFree(userId: string): boolean {
  try { return globalThis.localStorage?.getItem(streakKey(userId)) === '1' } catch { return false }
}

const DiceContext = createContext<DiceContextValue | null>(null)

export function DiceProvider({ userId, limit = 100, children }: { userId: string; limit?: number; children: ReactNode }) {
  const [streak, setStreak] = useState(() => ({ userId, on: loadStreakFree(userId) }))
  const streakFree = streak.userId === userId ? streak.on : loadStreakFree(userId)
  if (streak.userId !== userId) setStreak({ userId, on: streakFree })
  // While on, every roll without its own rng deals from this user's shuffle bag; off restores crypto random.
  useEffect(() => {
    if (!streakFree) return
    const bag = new DiceBag(localBagStorage(`ff.dicebag.v1.${userId}`))
    setDefaultRng(bag.draw, true)
    return () => setDefaultRng(null)
  }, [userId, streakFree])
  const core = useMemo(() => {
    const history = new RollHistory(limit, localHistoryStorage(`ff.rolls.v1.${userId}`))
    const fx = new RollFxBus()
    const add = (r: RollResult, opts?: RecordOptions) => { fx.push(r, opts); return history.add(r) }
    return {
      history,
      fx,
      record: add,
      roll: (notation: string, opts?: RollOptions) => add(rollNotation(notation, opts)),
    }
  }, [userId, limit])
  const value = useMemo<DiceContextValue>(() => ({
    ...core,
    streakFree,
    setStreakFree: (on: boolean) => {
      try { globalThis.localStorage?.setItem(streakKey(userId), on ? '1' : '0') } catch { /* stays for this session */ }
      setStreak({ userId, on })
    },
  }), [core, streakFree, userId])
  useEffect(() => {
    const synced = (e: Event) => { if ((e as CustomEvent<string>).detail === userId) core.history.reload() }
    window.addEventListener('ff:rolls-synced', synced)
    return () => window.removeEventListener('ff:rolls-synced', synced)
  }, [userId, core])
  return (
    <DiceContext.Provider value={value}>
      {children}
      <RollFx bus={core.fx} />
    </DiceContext.Provider>
  )
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

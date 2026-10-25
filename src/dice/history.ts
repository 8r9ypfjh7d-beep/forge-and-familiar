// Roll history store. Framework-free, so the UI, tests and a future sync layer can share it.
import type { RollResult } from './types'

export interface HistoryStorage {
  load(): RollResult[] | undefined
  save(rolls: RollResult[]): void
}

/** localStorage persistence. Use one key per signed-in user so friends on a shared device keep separate logs. */
export function localHistoryStorage(key: string): HistoryStorage {
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(key)
        return raw ? (JSON.parse(raw) as RollResult[]) : undefined
      } catch {
        return undefined
      }
    },
    save(rolls) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(rolls))
      } catch {
        // Storage full or blocked: history stays in memory only.
      }
    },
  }
}

export class RollHistory {
  private rolls: RollResult[]
  private listeners = new Set<() => void>()
  private readonly limit: number
  private readonly storage?: HistoryStorage

  constructor(limit = 100, storage?: HistoryStorage) {
    this.limit = limit
    this.storage = storage
    this.rolls = storage?.load()?.slice(0, limit) ?? []
  }

  /** Newest first. Same array until the next change, so it works with useSyncExternalStore. */
  all = (): readonly RollResult[] => this.rolls

  forCharacter(characterId: string): RollResult[] {
    return this.rolls.filter(r => r.roller?.characterId === characterId)
  }

  add(result: RollResult): RollResult {
    this.rolls = [result, ...this.rolls].slice(0, this.limit)
    this.changed()
    return result
  }

  clear(): void {
    this.rolls = []
    this.changed()
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed() {
    this.storage?.save(this.rolls)
    this.listeners.forEach(fn => fn())
  }
}

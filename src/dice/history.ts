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

  /** Re-reads storage, e.g. after sync merged in rolls from another device. */
  reload(): void {
    const rolls = this.storage?.load()
    if (!rolls) return
    this.rolls = rolls.slice(0, this.limit)
    this.listeners.forEach(fn => fn())
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

/** "Greatsword attack" → "Greatsword", for rolls saved before `action` existed. */
const attackName = (r: RollResult) => r.label?.replace(/\s+attack$/, '')

/** True when two rolls belong to one action: the same `action.id`, or (older saves) an attack and the damage rolled with it. */
export function sameAction(a: RollResult, b: RollResult): boolean {
  if (a.action || b.action) return !!a.action && a.action.id === b.action?.id
  const [hit, dmg] = a.type === 'attack' ? [a, b] : [b, a]
  if (hit.type !== 'attack' || dmg.type !== 'damage') return false
  if (hit.roller?.characterId !== dmg.roller?.characterId) return false
  const name = attackName(hit)
  return !!name && !!dmg.label?.startsWith(`${name} `) && Math.abs(Date.parse(dmg.timestamp) - Date.parse(hit.timestamp)) < 2000
}

/** The action's name for a group: "Greatsword". */
export function actionName(rolls: readonly RollResult[]): string {
  const hit = rolls.find(r => r.type === 'attack')
  return rolls[0]?.action?.name ?? (hit && attackName(hit)) ?? rolls[0]?.label ?? ''
}

/**
 * Groups a newest-first list so the rolls of one action (to-hit, then damage) form one entry.
 * Each group is oldest first, so the attack comes before its damage. `same` adds a check, e.g. same party member.
 */
export function groupByAction<T>(list: readonly T[], rollOf: (item: T) => RollResult, same: (a: T, b: T) => boolean = () => true): T[][] {
  const groups: T[][] = []
  for (const item of list) {
    const last = groups[groups.length - 1]
    const prev = last?.[0]
    if (prev !== undefined && same(prev, item) && sameAction(rollOf(prev), rollOf(item))) last.unshift(item)
    else groups.push([item])
  }
  return groups
}

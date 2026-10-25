import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../model/character'
import { getCharacter, onCharactersChanged, saveCharacter } from '../storage'
import { describeChange } from '../explain/changes'
import { normalize } from './engine'

export interface LogEntry {
  id: number
  text: string
  before: Character
  /** What the action changed, e.g. "HP 31 → 23". */
  changes?: string[]
  at?: number
}

/** An undone action, kept until the next new change so it can be redone. */
interface RedoEntry {
  entry: LogEntry
  after: Character
}

const MAX_LOG = 30
const logKey = (id: string) => `ff.sheetlog.v1.${id}`

// The log lives in sessionStorage so a reload keeps "undo"; storage can be unavailable, so failures are ignored.
function loadLog(id: string): LogEntry[] {
  try { return JSON.parse(sessionStorage.getItem(logKey(id)) ?? '[]') as LogEntry[] } catch { return [] }
}
function saveLog(id: string, entries: LogEntry[]) {
  // Undo only reads play state, so drop the portrait (can be a large data URL).
  const slim = entries.map(e => ({ ...e, before: { ...e.before, portrait: undefined } }))
  try { sessionStorage.setItem(logKey(id), JSON.stringify(slim)) } catch { /* private mode or full */ }
}

/**
 * Undo and redo only touch play state (HP, slots, resources...), so an edit made
 * in the builder since the logged action is kept.
 */
const playState = (now: Character, from: Character) => normalize({ ...now, state: from.state })

/**
 * Loads a character, saves every change, and keeps a short history so the
 * last actions can be undone. Changes show at once; saves run in order behind them.
 * Edits saved elsewhere (the builder, another tab) are picked up.
 */
export function useLiveCharacter(characterId: string) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [log, setLog] = useState<LogEntry[]>([])
  const [canRedo, setCanRedo] = useState(false)
  const current = useRef<Character | null | undefined>(undefined)
  const history = useRef<LogEntry[]>([])
  const redoStack = useRef<RedoEntry[]>([])
  const pending = useRef(Promise.resolve())
  const ownSaves = useRef(0)

  const show = useCallback((c: Character | null | undefined, entries: LogEntry[], redo: RedoEntry[] = redoStack.current) => {
    if (entries !== history.current) saveLog(characterId, entries)
    current.current = c
    history.current = entries
    redoStack.current = redo
    setCharacter(c)
    setLog(entries)
    setCanRedo(redo.length > 0)
  }, [characterId])

  const persist = useCallback((c: Character) => {
    ownSaves.current++
    pending.current = pending.current
      .then(() => saveCharacter(c))
      .then(() => undefined, err => console.error('Could not save character', err))
      .finally(() => { ownSaves.current-- })
  }, [])

  useEffect(() => {
    let live = true
    const reload = () => getCharacter(characterId).then(c => {
      if (live && ownSaves.current === 0) show(c ? normalize(c) : null, history.current)
    })
    show(undefined, loadLog(characterId), [])
    reload()
    const off = onCharactersChanged(id => { if ((!id || id === characterId) && ownSaves.current === 0) reload() })
    return () => { live = false; off() }
  }, [characterId, show])

  const apply = useCallback((text: string, change: (c: Character) => Character) => {
    const prev = current.current
    if (!prev) return
    const next = change(prev)
    if (next === prev) return
    const entry = { id: Date.now() + Math.random(), text, before: prev, changes: describeChange(prev, next), at: Date.now() }
    show(next, [entry, ...history.current].slice(0, MAX_LOG), [])
    persist(next)
  }, [show, persist])

  /** Reverts the entry with this id and every change made after it. */
  const undoTo = useCallback((id: number) => {
    const entries = history.current
    const i = entries.findIndex(e => e.id === id)
    const now = current.current
    if (i < 0 || !now) return
    // Each undone entry's "after" is the next newer entry's "before" (or the current character).
    const undone = entries.slice(0, i + 1).map((entry, k) => ({ entry, after: k === 0 ? now : entries[k - 1].before }))
    const target = playState(now, entries[i].before)
    show(target, entries.slice(i + 1), [...undone.reverse(), ...redoStack.current])
    persist(target)
  }, [show, persist])

  const undo = useCallback(() => {
    if (history.current[0]) undoTo(history.current[0].id)
  }, [undoTo])

  const redo = useCallback(() => {
    const [next, ...rest] = redoStack.current
    const now = current.current
    if (!next || !now) return
    const target = playState(now, next.after)
    show(target, [{ ...next.entry, before: now }, ...history.current].slice(0, MAX_LOG), rest)
    persist(target)
  }, [show, persist])

  /** undefined while loading, null when the character does not exist. */
  return { character, apply, undo, undoTo, redo, canRedo, log }
}

// The panel's state: the open conversation, the answer streaming in, errors, and the history list on this device.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { edgeTransport, type FamiliarTransport } from '../api'
import { runTurn } from '../chat'
import type { PromptInput } from '../prompt'
import { deleteThread, getThread, listThreads, newThread, saveTurn, setApplied } from '../store'
import type { ToolData, ToolEnv } from '../tools/registry'
import { FamiliarError, type FamiliarContext, type FamiliarErrorKind, type Thread, type ToolUse } from '../types'

export interface ChatSetup {
  userId: string
  locale: string
  context: FamiliarContext
  role: 'player' | 'dm'
  edition?: '2014' | '2024'
  /** Context card text for what is on screen (character, draft, campaign). */
  card?: string
  data?: ToolData
  /** Loads what is on screen fresh at send time (the DM screen's campaign, plans and NPCs); overrides `card` and `data`. */
  prepare?: () => Promise<{ card?: string; data?: ToolData }>
  /** Tests and previews pass a fake. */
  transport?: FamiliarTransport
}

export interface Pending {
  question: string
  /** Answer text streamed so far in this round. */
  text: string
  tools: ToolUse[]
}

export interface ChatError {
  kind: FamiliarErrorKind
  resetAt?: string
  /** The question that failed, to send again. */
  question: string
}

/** The conversation open per user, so the floating sheet and the #/familiar page continue the same one. */
const lastOpen = new Map<string, string>()

export function useFamiliarChat(setup: ChatSetup) {
  const { userId } = setup
  const [thread, setThreadState] = useState<Thread | null>(() => {
    const id = lastOpen.get(userId)
    return (id && getThread(userId, id)) || null
  })
  const setThread = useCallback((next: Thread | null | ((t: Thread | null) => Thread | null)) => {
    setThreadState(prev => {
      const value = typeof next === 'function' ? next(prev) : next
      if (value) lastOpen.set(userId, value.id)
      else lastOpen.delete(userId)
      return value
    })
  }, [userId])
  const [threads, setThreads] = useState<Thread[]>(() => listThreads(userId))
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<ChatError | null>(null)
  const abort = useRef<AbortController | null>(null)
  // The latest setup, read at send time so a long turn uses what was on screen when it was asked.
  const live = useRef(setup)
  useLayoutEffect(() => { live.current = setup })

  // Another profile on this device has its own conversations.
  const seenUser = useRef(userId)
  useEffect(() => {
    if (seenUser.current === userId) return
    seenUser.current = userId
    abort.current?.abort()
    const id = lastOpen.get(userId)
    setThreadState((id && getThread(userId, id)) || null)
    setPending(null)
    setError(null)
    setThreads(listThreads(userId))
  }, [userId])
  useEffect(() => () => abort.current?.abort(), [])

  /** Resolves true when the answer arrived (false on error or stop). */
  const send = useCallback(async (raw: string): Promise<boolean> => {
    const question = raw.trim()
    if (!question || abort.current) return false
    const s = live.current
    const base = thread ?? newThread(s.context)
    const ac = new AbortController()
    abort.current = ac
    setError(null)
    setPending({ question, text: '', tools: [] })
    try {
      const fresh: { card?: string; data?: ToolData } = s.prepare ? await s.prepare().catch(() => ({})) : {}
      const card = 'card' in fresh ? fresh.card : s.card
      const data = 'data' in fresh ? fresh.data : s.data
      const env: ToolEnv = { userId: s.userId, context: s.context, locale: s.locale, edition: s.edition, data }
      const prompt: PromptInput = { context: s.context, locale: s.locale, card, role: s.role, edition: s.edition, today: new Date().toISOString().slice(0, 10) }
      const res = await runTurn(base.contents, question, prompt, env, s.transport ?? edgeTransport, {
        onText: delta => setPending(p => (p ? { ...p, text: p.text + delta } : p)),
        // Text before a tool call is "let me check"; the real answer streams after the tools.
        onTool: use => setPending(p => (p ? { ...p, text: '', tools: [...p.tools, use] } : p)),
      }, ac.signal)
      if (ac.signal.aborted) return false
      setThread(saveTurn(s.userId, base, res.contents, res.tools, question))
      setThreads(listThreads(s.userId))
      return true
    } catch (e) {
      if (ac.signal.aborted || (e as Error).name === 'AbortError') return false
      const err = e instanceof FamiliarError ? e : new FamiliarError('server', String((e as Error).message ?? e))
      setError({ kind: err.kind, resetAt: err.resetAt, question })
      return false
    } finally {
      if (abort.current === ac) abort.current = null
      setPending(null)
    }
  }, [thread, setThread])

  const stop = useCallback(() => {
    abort.current?.abort()
    abort.current = null
    setPending(null)
  }, [])

  const startNew = useCallback(() => {
    stop()
    setError(null)
    setThread(null)
  }, [stop, setThread])

  const open = useCallback((id: string) => {
    stop()
    setError(null)
    setThread(getThread(userId, id) ?? null)
  }, [stop, userId, setThread])

  const remove = useCallback((id: string) => {
    deleteThread(userId, id)
    setThreads(listThreads(userId))
    setThread(t => (t?.id === id ? null : t))
  }, [userId, setThread])

  /** An Apply card was tapped (or undone): kept on the thread so it still reads "Applied" later. */
  const markApplied = useCallback((proposalId: string, state: 'applied' | 'undone') => {
    setThread(t => (t ? setApplied(userId, t, proposalId, state) : t))
  }, [userId, setThread])

  return { thread, threads, pending, error, busy: !!pending, send, stop, startNew, open, remove, markApplied, dismissError: () => setError(null) }
}

export type FamiliarChatState = ReturnType<typeof useFamiliarChat>

// Keeps a tracker encounter and the party's live combat row (src/combat/live.ts) in step, for the DM.
// Starting combat pushes it, every tracker change is mirrored (debounced), board changes and moves go
// to both, players' moves come back through the realtime watch, and ending combat clears the row.
// A local party, no campaign or an unreachable server leaves everything local: the calls are no-ops.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BattleMapDef } from '../../maps/types'
import { endLiveCombat, mirrorEncounter, moveToken, setLiveMap, startLiveCombat, updateBoard, watchLiveCombat } from '../live'
import { EMPTY_BOARD } from '../liveLogic'
import { inCombat } from '../engine'
import type { Board, Encounter, LiveMap } from '../types'
import type { Act } from '../ui/useEncounter'
import { mergeRemoteMoves } from './board'

/** A map as the live row stores it (its fog keys are the same "x,y" strings). */
const asLive = (m: BattleMapDef | null) => m as unknown as LiveMap | null

export type LiveState = 'local' | 'off' | 'on'

export function useLiveBoard(enc: Encounter, act: Act, partyId: string | undefined, map: BattleMapDef | null) {
  const [live, setLive] = useState<LiveState>(partyId ? 'off' : 'local')
  const liveRef = useRef(live)
  const encRef = useRef(enc)
  const mapRef = useRef(map)
  useLayoutEffect(() => { liveRef.current = live; encRef.current = enc; mapRef.current = map })
  const fighting = inCombat(enc)
  const wasFighting = useRef(fighting)

  const push = useCallback(async () => {
    if (!partyId) return
    try {
      const row = await startLiveCombat(partyId, encRef.current, asLive(mapRef.current))
      if (row) setLive('on')
    } catch { setLive('off') }
  }, [partyId])

  // Start and end follow the tracker's own buttons.
  useEffect(() => {
    if (!partyId) return
    if (fighting && !wasFighting.current) push()
    if (!fighting && wasFighting.current) { endLiveCombat(partyId).catch(() => {}); setLive('off') }
    wasFighting.current = fighting
  }, [fighting, partyId, push])

  // Players' moves (and whether a row exists at all).
  useEffect(() => {
    if (!partyId) return
    return watchLiveCombat(partyId, true, row => {
      if (!row) { if (liveRef.current === 'on') setLive('off'); return }
      setLive('on')
      const local = encRef.current.board
      if (!local) return
      const merged = mergeRemoteMoves(local, row.board)
      if (merged !== local) act(e => ({ ...e, board: mergeRemoteMoves(e.board ?? EMPTY_BOARD, row.board) }))
    })
  }, [partyId, act])

  // Turn order, HP and effects: mirrored 300 ms after the last change.
  useEffect(() => {
    if (!partyId || live !== 'on') return
    const id = setTimeout(() => { mirrorEncounter(partyId, enc).catch(() => {}) }, 300)
    return () => clearTimeout(id)
  }, [enc, partyId, live])

  const changeBoard = useCallback((change: (b: Board) => Board) => {
    act(e => ({ ...e, board: change(e.board ?? EMPTY_BOARD) }))
    if (partyId && liveRef.current === 'on') updateBoard(partyId, change).catch(() => {})
  }, [act, partyId])

  const move = useCallback((tokenId: string, x: number, y: number) => {
    act(e => ({ ...e, board: { ...(e.board ?? EMPTY_BOARD), tokens: (e.board?.tokens ?? []).map(t => (t.id === tokenId ? { ...t, x, y } : t)) } }))
    if (partyId && liveRef.current === 'on') moveToken(partyId, tokenId, x, y).catch(() => {})
  }, [act, partyId])

  const changeMap = useCallback((next: BattleMapDef | null, board: Board) => {
    act(e => ({ ...e, board }))
    if (partyId && liveRef.current === 'on') {
      setLiveMap(partyId, asLive(next)).catch(() => {})
      updateBoard(partyId, () => board).catch(() => {})
    }
  }, [act, partyId])

  return { live, push, changeBoard, move, changeMap }
}

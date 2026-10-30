// Live combat in Supabase (supabase/migrations/20261030210000_party_encounters.sql): one row per
// party holds the combat in progress. The party's DM writes it from the tracker; players watch the
// public copy (party_encounters_public) and move their own token through move_token. A local party
// (no cloud) has no live row: every call here is a no-op that returns null.
import type { SupabaseClient } from '@supabase/supabase-js'
import { watchTable } from '../party/cloud'
import { cloudForParty } from '../party/store'
import { EMPTY_BOARD, type LiveCombat, type LiveEncounter, toLiveEncounter } from './liveLogic'
import type { Board, Encounter, LiveMap } from './types'

interface Row {
  party_id: string
  encounter: LiveEncounter
  map: LiveMap | null
  map_id: string | null
  board: Board
  rev: number
  started_at: string
}

const fromRow = (r: Row): LiveCombat => ({
  partyId: r.party_id, encounter: r.encounter, map: r.map, board: r.board, rev: r.rev, startedAt: r.started_at,
})

const table = (asDm: boolean) => asDm ? 'party_encounters' : 'party_encounters_public'

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

/** Maps already downloaded, by id, so token moves don't re-download a big picture. */
const mapCache = new Map<string, LiveMap>()

/** The combat in progress for this party, or null (none, local party, or offline). */
export async function pullLiveCombat(partyId: string, asDm: boolean, db?: SupabaseClient | null): Promise<LiveCombat | null> {
  db ??= await cloudForParty(partyId)
  if (!db) return null
  const { data, error } = await db.from(table(asDm))
    .select('party_id, encounter, map_id, board, rev, started_at').eq('party_id', partyId).maybeSingle()
  if (error || !data) return null
  const row = data as Omit<Row, 'map'>
  let map: LiveMap | null = null
  if (row.map_id) {
    map = mapCache.get(row.map_id) ?? null
    if (!map) {
      const { data: m } = await db.from(table(asDm)).select('map').eq('party_id', partyId).maybeSingle()
      map = (m?.map as LiveMap | null) ?? null
      if (map) mapCache.set(row.map_id, map)
    }
  }
  return fromRow({ ...row, map })
}

/**
 * Follows the party's live combat: calls `fn` now and on every change, with null once the combat
 * ends. The DM passes `asDm` to get the full row (hidden tokens, monster HP, fog contents).
 */
export function watchLiveCombat(partyId: string, asDm: boolean, fn: (live: LiveCombat | null) => void): () => void {
  let stopped = false
  let inFlight: Promise<void> | null = null
  let again = false
  const pull = () => {
    if (inFlight) { again = true; return }
    inFlight = pullLiveCombat(partyId, asDm).then(live => {
      if (!stopped) fn(live)
    }).finally(() => {
      inFlight = null
      if (again && !stopped) { again = false; pull() }
    })
  }
  pull()
  const stop = watchTable(table(asDm), `party_id=eq.${partyId}`, pull)
  return () => { stopped = true; stop() }
}

/**
 * DM: pushes the combat to the party, replacing any combat in progress. `map` is the full map
 * definition (src/maps) or null. Returns the live row, or null for a local party.
 */
export async function startLiveCombat(partyId: string, enc: Encounter, map: LiveMap | null = null): Promise<LiveCombat | null> {
  const db = await cloudForParty(partyId)
  if (!db) return null
  const board: Board = {
    ...EMPTY_BOARD, ...(map?.fog ? { fog: map.fog } : {}), ...(enc.board ?? {}), ...(map ? { mapId: map.id } : {}),
  }
  const row = {
    party_id: partyId, encounter: toLiveEncounter(enc), map, map_id: map?.id ?? null, board, rev: 1,
    started_at: new Date().toISOString(),
  }
  check((await db.from('party_encounters').upsert(row, { onConflict: 'party_id' })).error)
  if (map) mapCache.set(map.id, map)
  return fromRow(row)
}

/** DM: mirrors tracker changes (turns, HP, conditions, effects) to the party. The board is not touched. */
export async function mirrorEncounter(partyId: string, enc: Encounter): Promise<void> {
  const db = await cloudForParty(partyId)
  if (!db) return
  await db.from('party_encounters').update({ encounter: toLiveEncounter(enc) }).eq('party_id', partyId)
}

/** DM: changes the map (or removes it with null) mid-combat. */
export async function setLiveMap(partyId: string, map: LiveMap | null): Promise<void> {
  const db = await cloudForParty(partyId)
  if (!db) return
  if (map) mapCache.set(map.id, map)
  await db.from('party_encounters').update({ map, map_id: map?.id ?? null }).eq('party_id', partyId)
}

/**
 * DM: changes the board (fog, lock, hidden tokens, adding or removing tokens) by applying `change`
 * to the current board. Conditional on rev, so a player's move landing at the same moment is not
 * lost: on a clash the change is re-applied to the fresh board (up to 4 tries). Returns the board
 * written, or null for a local party or when every try clashed.
 */
export async function updateBoard(partyId: string, change: (board: Board) => Board): Promise<Board | null> {
  const db = await cloudForParty(partyId)
  if (!db) return null
  for (let i = 0; i < 4; i++) {
    const { data } = await db.from('party_encounters').select('board, rev').eq('party_id', partyId).maybeSingle()
    if (!data) return null
    const next = change(data.board as Board)
    const { data: written } = await db.from('party_encounters')
      .update({ board: next, rev: (data.rev as number) + 1 }).eq('party_id', partyId).eq('rev', data.rev).select('rev')
    if (written && written.length) return next
  }
  return null
}

export type MoveResult = { ok: true; rev: number } | { ok: false; reason: string }

/**
 * Moves a token through the server's checks: a player may move only the token of the character
 * they bring, and not while the board is locked; the DM moves anything. Everyone's view updates
 * through the realtime watch.
 */
export async function moveToken(partyId: string, tokenId: string, x: number, y: number): Promise<MoveResult> {
  const db = await cloudForParty(partyId)
  if (!db) return { ok: false, reason: 'offline' }
  const { data, error } = await db.rpc('move_token', { p_party: partyId, p_token: tokenId, p_x: x, p_y: y })
  if (error) return { ok: false, reason: error.message }
  return { ok: true, rev: data as number }
}

/** DM: ends the combat for the party; their Map tab disappears. */
export async function endLiveCombat(partyId: string): Promise<void> {
  const db = await cloudForParty(partyId)
  if (!db) return
  await db.from('party_encounters').delete().eq('party_id', partyId)
}

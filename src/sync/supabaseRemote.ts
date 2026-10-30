// RemoteStore over the Supabase tables in supabase/migrations (characters, snapshots, rolls, homebrew_packs).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CharacterRow } from '../cloud'
import type { Character } from '../model/character'
import type { Snapshot } from '../portability/snapshots'
import type { RollResult } from '../dice/types'
import type { HomebrewPack } from '../homebrew/types'
import { MissingTableError, type RemoteRow, type RemoteStore } from './types'

/**
 * Pulls re-read this much before the cursor: updated_at is the transaction's start time, so a
 * slow write can commit with a time just before a row already pulled. Re-reads are skipped by rev.
 */
const OVERLAP_MS = 10_000

interface SnapshotRow { id: string; owner_id: string; character_id: string; data: Snapshot; deleted: boolean; updated_at: string }
interface PackRow { id: string; owner_id: string; data: HomebrewPack; deleted: boolean; updated_at: string }

const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
/** Same, but a table the live database doesn't have yet (PostgREST PGRST205, Postgres 42P01) is a MissingTableError. */
const failTable = (error: { message: string; code?: string } | null) => {
  if (error && (error.code === 'PGRST205' || error.code === '42P01')) throw new MissingTableError(error.message)
  fail(error)
}
const back = (since: string) => new Date(Date.parse(since) - OVERLAP_MS).toISOString()

const toRow = (r: CharacterRow): RemoteRow<Character> =>
  ({ id: r.id, ownerId: r.owner_id, data: r.data, rev: r.rev, deleted: r.deleted, updatedAt: r.updated_at })

export function supabaseRemote(db: SupabaseClient): RemoteStore {
  const fetchCharacter = async (id: string) => {
    const { data, error } = await db.from('characters').select('*').eq('id', id).maybeSingle<CharacterRow>()
    fail(error)
    return data ? toRow(data) : undefined
  }

  return {
    async pullCharacters(ownerId, since) {
      let q = db.from('characters').select('*').eq('owner_id', ownerId)
      if (since) q = q.gt('updated_at', back(since))
      const { data, error } = await q.order('updated_at').returns<CharacterRow[]>()
      fail(error)
      return (data ?? []).map(toRow)
    },

    async pushCharacter(row, baseRev) {
      if (baseRev === 0) {
        const { error } = await db.from('characters')
          .insert({ id: row.id, owner_id: row.ownerId, data: row.data, deleted: row.deleted })
        if (!error) return { ok: true, rev: 1 }
        if (error.code !== '23505') fail(error)
      } else {
        const patch = row.data ? { data: row.data, deleted: row.deleted, rev: baseRev + 1 } : { deleted: true, rev: baseRev + 1 }
        const { data, error } = await db.from('characters').update(patch).eq('id', row.id).eq('rev', baseRev).select('rev')
        fail(error)
        if (data?.length) return { ok: true, rev: baseRev + 1 }
      }
      const server = await fetchCharacter(row.id)
      if (server) return { ok: false, server }
      if (!row.data) return { ok: true, rev: 0 }
      // Gone from the server (removed by hand): write it again as new.
      if (baseRev !== 0) return this.pushCharacter(row, 0)
      throw new Error(`Character id ${row.id} belongs to another account`)
    },

    async pullSnapshots(ownerId, since) {
      let q = db.from('snapshots').select('*').eq('owner_id', ownerId)
      if (since) q = q.gt('updated_at', back(since))
      const { data, error } = await q.order('updated_at').returns<SnapshotRow[]>()
      fail(error)
      return (data ?? []).map(r => ({ id: r.id, ownerId: r.owner_id, data: r.data, rev: 0, deleted: r.deleted, updatedAt: r.updated_at }))
    },

    async putSnapshot(row) {
      const { error } = row.deleted
        ? await db.from('snapshots').update({ deleted: true }).eq('id', row.id)
        : await db.from('snapshots').upsert({
          id: row.id, owner_id: row.ownerId, character_id: row.data.characterId, data: row.data, deleted: false,
        })
      fail(error)
    },

    async pushRolls(ownerId, rolls) {
      const rows = rolls.map(r => ({
        id: r.id, owner_id: ownerId, character_id: r.roller?.characterId ?? null, data: r, rolled_at: r.timestamp,
      }))
      const { error } = await db.from('rolls').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      fail(error)
    },

    async pullPacks(since) {
      let q = db.from('homebrew_packs').select('*')
      if (since) q = q.gt('updated_at', back(since))
      const { data, error } = await q.order('updated_at').returns<PackRow[]>()
      failTable(error)
      return (data ?? []).map(r => ({ id: r.id, ownerId: r.owner_id, data: r.data, rev: 0, deleted: r.deleted, updatedAt: r.updated_at }))
    },

    async putPack(row) {
      const { error } = await db.from('homebrew_packs')
        .upsert({ id: row.id, owner_id: row.ownerId, data: row.data, deleted: row.deleted }, { onConflict: 'owner_id,id' })
      failTable(error)
    },

    async recentRolls(ownerId, limit) {
      const { data, error } = await db.from('rolls').select('data').eq('owner_id', ownerId)
        .order('rolled_at', { ascending: false }).limit(limit).returns<{ data: RollResult }[]>()
      fail(error)
      return (data ?? []).map(r => r.data)
    },

    subscribe(ownerId, onChange) {
      const channel = db.channel(`sync-${ownerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'characters', filter: `owner_id=eq.${ownerId}` }, onChange)
        .subscribe()
      // Own and party members' packs (the server only sends rows this account may read). Its own
      // channel, so a database without the table yet doesn't break character updates.
      const packs = db.channel(`sync-packs-${ownerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'homebrew_packs' }, onChange)
        .subscribe()
      return () => { void db.removeChannel(channel); void db.removeChannel(packs) }
    },
  }
}

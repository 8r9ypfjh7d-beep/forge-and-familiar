// What the cloud keeps and how the sync layer talks to it. The Supabase adapter implements
// RemoteStore; tests use memoryRemote().
import type { Character } from '../model/character'
import type { Snapshot } from '../portability/snapshots'
import type { RollResult } from '../dice/types'
import type { HomebrewPack } from '../homebrew/types'
import type { NpcSheet } from '../npc/types'

/** One server row. `rev` goes up by one on every write; `updatedAt` is the server's clock. */
export interface RemoteRow<T> {
  id: string
  ownerId: string
  data: T
  rev: number
  deleted: boolean
  updatedAt: string
}

export type PushResult = { ok: true; rev: number } | { ok: false; server: RemoteRow<Character> }

export interface RemoteStore {
  /** The owner's characters changed after `since` (all of them when missing), deleted ones included. */
  pullCharacters(ownerId: string, since?: string): Promise<RemoteRow<Character>[]>
  /**
   * Writes only if the server row is still at `baseRev` (0 = must not exist yet), otherwise
   * returns the server's row so the caller can resolve the conflict. `data` is null for a delete.
   */
  pushCharacter(row: { id: string; ownerId: string; data: Character | null; deleted: boolean }, baseRev: number): Promise<PushResult>
  pullSnapshots(ownerId: string, since?: string): Promise<RemoteRow<Snapshot>[]>
  /** Upsert; `deleted` marks it gone on every device. */
  putSnapshot(row: { id: string; ownerId: string; data: Snapshot; deleted: boolean }): Promise<void>
  /** Insert, ignoring ids the server already has. */
  pushRolls(ownerId: string, rolls: RollResult[]): Promise<void>
  /** Newest first. */
  recentRolls(ownerId: string, limit: number): Promise<RollResult[]>
  /**
   * Homebrew packs changed after `since`: the account's own and those of everyone it shares a
   * party with (the server decides who). Pack rows are keyed by owner and pack id.
   */
  pullPacks(since?: string): Promise<RemoteRow<HomebrewPack>[]>
  /** Upsert of the owner's copy; `deleted` marks it gone on every device. */
  putPack(row: { id: string; ownerId: string; data: HomebrewPack | { id: string; updatedAt: string }; deleted: boolean }): Promise<void>
  /** The DM's NPC sheets (src/npc) changed after `since`, deleted ones included. Owner or admin only. */
  pullNpcs(ownerId: string, since?: string): Promise<RemoteRow<NpcSheet>[]>
  /** Upsert of the owner's sheet; `deleted` marks it gone on every device. */
  putNpc(row: { id: string; ownerId: string; data: NpcSheet | { id: string; updatedAt: string }; deleted: boolean }): Promise<void>
  /** Optional live updates: calls onChange when another device writes. Returns unsubscribe. */
  subscribe?(ownerId: string, onChange: () => void): () => void
}

export type SyncState = 'off' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  /** Local changes not yet on the server. */
  pending: number
  lastSyncedAt?: string
  error?: string
}

/** Thrown by a remote whose server doesn't have a table yet (a migration not applied there). */
export class MissingTableError extends Error {}

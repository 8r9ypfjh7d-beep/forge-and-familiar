// Secret rolls of a cloud party through Supabase (supabase/migrations/20261028090000_party_shared.sql).
// The server lets only the party's DM read results, so a roll reaches the DM's phone, not the table.
import { watchTable } from '../party/cloud'
import { cloudForParty } from '../party/store'
import { addSecret, clearSecretRolls, replaceSecretRolls, sendSecretRoll, SECRET_LIMIT, type SecretRoll } from './secret'
import type { RollResult } from './types'

/** Logs the roll here and, for a cloud party, sends it to the DM. */
export async function shareSecretRoll(partyId: string, entry: SecretRoll): Promise<void> {
  sendSecretRoll(partyId, entry)
  const db = await cloudForParty(partyId)
  if (!db) return
  const { roll } = entry
  await db.from('secret_rolls').insert({
    id: roll.id, party_id: partyId, from_id: entry.fromUserId, label: roll.label ?? null, roll, rolled_at: roll.timestamp,
  })
}

/** DM: clears the log here and on the server. */
export async function clearSharedSecretRolls(partyId: string): Promise<void> {
  clearSecretRolls(partyId)
  const db = await cloudForParty(partyId)
  if (db) await db.from('secret_rolls').delete().eq('party_id', partyId)
}

/** DM: replaces this device's log with the server's, newest first. */
export async function refreshSecretRolls(partyId: string): Promise<void> {
  const db = await cloudForParty(partyId)
  if (!db) return
  const { data, error } = await db.from('secret_rolls').select('from_id, roll').eq('party_id', partyId)
    .order('rolled_at', { ascending: false }).limit(SECRET_LIMIT)
  if (error || !data) return
  const list = (data as { from_id: string; roll: RollResult }[])
    .reduceRight<SecretRoll[]>((acc, r) => addSecret(acc, { roll: r.roll, fromUserId: r.from_id }), [])
  replaceSecretRolls(partyId, list)
}

/** DM: keeps the log live while the party page is open. */
export function watchSecretRolls(partyId: string): () => void {
  const pull = () => { void refreshSecretRolls(partyId) }
  pull()
  return watchTable('secret_rolls', `party_id=eq.${partyId}`, pull)
}

// Live data for the DM's Rolls tab: players' rolls from this device, other tabs and the server.
import { useCallback, useEffect, useState } from 'react'
import type { RollResult } from '../dice'
import { loadSecretRolls, onSecretRollsChanged, type SecretRoll } from '../dice/secret'
import { watchSecretRolls } from '../dice/secretCloud'
import { useDice } from '../dice/ui'
import { fetchPartyRolls, watchPartyRolls } from '../party/cloud'
import { mergeRollLists, onMemberRollsChanged, readMemberRolls } from '../party/feed'
import type { Party } from '../party/types'
import { mergeDmRolls, rollsSeenKey, unseenCount, type DmRollEntry } from './rolls'

/**
 * The campaign's roll log, kept live: this device's dice history, other tabs, and the server (public `rolls`
 * of brought characters since joining, and the party's `secret_rolls`, which only the DM may read).
 */
export function useDmRolls(party: Party | undefined): DmRollEntry[] {
  const { history } = useDice()
  const [entries, setEntries] = useState<DmRollEntry[]>([])
  useEffect(() => {
    if (!party) return
    let live = true
    let remote: Record<string, RollResult[]> = {}
    let secrets: SecretRoll[] = loadSecretRolls(party.id)
    const show = () => {
      if (!live) return
      const histories = Object.fromEntries(party.members.map(m => [m.userId, mergeRollLists(readMemberRolls(m.userId), remote[m.userId] ?? [])]))
      setEntries(mergeDmRolls(party, histories, secrets))
    }
    const fetchRemote = () => fetchPartyRolls(party.members.map(m => m.userId)).then(r => { remote = r; show() }).catch(() => {})
    const reloadSecrets = () => { secrets = loadSecretRolls(party.id); show() }
    show()
    void fetchRemote()
    const offs = [
      onMemberRollsChanged(show),
      history.subscribe(show),
      watchPartyRolls(() => { void fetchRemote() }),
      onSecretRollsChanged(party.id, reloadSecrets),
      watchSecretRolls(party.id),
    ]
    return () => { live = false; offs.forEach(off => off()) }
  }, [party, history])
  return party ? entries : []
}

/** How many rolls landed since the DM last opened the Rolls tab; `markSeen` resets it. */
export function useUnseenRolls(userId: string, entries: readonly DmRollEntry[]): { unseen: number; markSeen: () => void } {
  const [seenAt, setSeenAt] = useState<string | undefined>(() => {
    try { return globalThis.localStorage?.getItem(rollsSeenKey(userId)) ?? undefined } catch { return undefined }
  })
  const markSeen = useCallback(() => {
    const now = new Date().toISOString()
    setSeenAt(now)
    try { globalThis.localStorage?.setItem(rollsSeenKey(userId), now) } catch { /* storage blocked: the badge just keeps counting */ }
  }, [userId])
  return { unseen: unseenCount(entries, seenAt), markSeen }
}

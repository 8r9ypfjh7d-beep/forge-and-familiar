// Whether a profile keeps the DM pages without running a campaign: after ending one, or to prepare before the
// players join. On once the profile has DM'd a campaign, has DM data, or picked "I'm a DM" on Home.
import { useEffect, useState } from 'react'
import { loadDm, onDmChanged } from './store'
import type { DmState } from './types'

const KEY = (userId: string) => `ff.dmTools.v1.${userId}`

export const dmToolsOn = (userId: string): boolean => {
  try { return localStorage.getItem(KEY(userId)) === '1' } catch { return false }
}

export function setDmTools(userId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(KEY(userId), '1')
    else localStorage.removeItem(KEY(userId))
  } catch {
    // Storage blocked: the DM pages follow the campaign only.
  }
}

/** Planned fights or NPC ideas: things a DM made and would want to reach again. */
export const hasDmData = (state: DmState): boolean => state.plans.length > 0 || state.npcs.length > 0

/** True when this profile may open the DM pages without a campaign it runs. Running one turns it on for good. */
export function useDmTools(userId: string, partyDm: boolean): [boolean, () => void] {
  const [on, setOn] = useState(() => !!userId && dmToolsOn(userId))
  const [forUser, setForUser] = useState(userId)
  if (forUser !== userId) { setForUser(userId); setOn(!!userId && dmToolsOn(userId)) }
  useEffect(() => {
    if (!userId) return
    if (partyDm) { setDmTools(userId, true); return }
    if (dmToolsOn(userId)) return
    let live = true
    const seen = (s: DmState) => { if (live && hasDmData(s)) { setDmTools(userId, true); setOn(true) } }
    loadDm(userId).then(seen).catch(() => {})
    const off = onDmChanged(userId, seen)
    return () => { live = false; off() }
  }, [userId, partyDm])
  const enable = () => { if (userId) { setDmTools(userId, true); setOn(true) } }
  return [on || partyDm, enable]
}

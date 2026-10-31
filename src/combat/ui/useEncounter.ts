import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../../model/character'
import { normalize } from '../../sheet/engine'
import { fetchPartyCharacters, watchPartyCharacters } from '../../party/cloud'
import { getCharacter, onCharactersChanged, saveCharacter } from '../../storage'
import { breakConcentration, syncPartyConditions, type Party } from '../engine'
import { getEncounter, saveEncounter } from '../storage'
import type { Encounter } from '../types'

/** One change: the new encounter, plus any party characters it changed (damage, death saves). */
export type Change = (e: Encounter, party: Party, remote: ReadonlySet<string>) => Encounter | { encounter: Encounter; characters: Character[] }
export type Act = (change: Change) => void

interface Snapshot {
  encounter: Encounter
  /** Party members as they were before the change, to put back on undo. */
  characters: Character[]
}

const MAX_UNDO = 40

/**
 * Loads an encounter and the party members in it, and saves every change to both.
 * After each change, concentration breaks for anyone incapacitated or at 0 HP, and
 * conditions from starting or ending effects are written to the party's characters.
 * A character that is not on this device but is brought to a shared campaign is read from the cloud:
 * it shows, but nothing here changes it (`remote`); the player's own device owns it.
 */
export function useEncounter(encounterId: string) {
  const [encounter, setEncounter] = useState<Encounter | null | undefined>(undefined)
  const [party, setParty] = useState<Party>({})
  const [remote, setRemote] = useState<ReadonlySet<string>>(new Set())
  const [undoCount, setUndoCount] = useState(0)
  const enc = useRef<Encounter | null | undefined>(undefined)
  const pty = useRef<Party>({})
  const rem = useRef<Set<string>>(new Set())
  const history = useRef<Snapshot[]>([])

  const showParty = useCallback((p: Party) => { pty.current = p; setParty(p) }, [])
  const showEncounter = useCallback((e: Encounter | null | undefined) => { enc.current = e; setEncounter(e) }, [])
  const markRemote = useCallback((id: string, on: boolean) => {
    if (rem.current.has(id) === on) return
    const next = new Set(rem.current)
    if (on) next.add(id); else next.delete(id)
    rem.current = next
    setRemote(next)
  }, [])

  const loadCharacter = useCallback(async (id: string) => {
    const c = await getCharacter(id)
    if (c) {
      markRemote(id, false)
      showParty({ ...pty.current, [id]: normalize(c) })
      return
    }
    const [r] = await fetchPartyCharacters([id]).catch(() => [])
    markRemote(id, !!r)
    showParty({ ...pty.current, [id]: r ? normalize(r) : undefined })
  }, [markRemote, showParty])

  useEffect(() => {
    let live = true
    getEncounter(encounterId).then(async e => {
      if (!live) return
      showEncounter(e ?? null)
      for (const c of e?.combatants ?? []) if (c.characterId) await loadCharacter(c.characterId)
    })
    // Picks up HP or conditions changed on the sheet, in this tab or another.
    const off = onCharactersChanged(id => {
      const ids = (enc.current?.combatants ?? []).flatMap(c => (c.characterId ? [c.characterId] : []))
      for (const x of ids) if (!id || id === x) loadCharacter(x)
    })
    return () => { live = false; off() }
  }, [encounterId, loadCharacter, showEncounter])

  // Characters on players' phones: reload when the server says they changed.
  const remoteKey = [...remote].sort().join(',')
  useEffect(() => {
    if (!remoteKey) return
    const ids = remoteKey.split(',')
    return watchPartyCharacters(ids, () => { for (const id of ids) loadCharacter(id) })
  }, [remoteKey, loadCharacter])

  const commit = useCallback((next: Encounter, nextParty: Party, before: Party) => {
    const changed = Object.keys(nextParty).filter(id => nextParty[id] !== before[id])
    showEncounter(next)
    showParty(nextParty)
    saveEncounter(next)
    for (const id of changed) {
      const c = nextParty[id]
      if (c) saveCharacter(c)
    }
    return changed
  }, [showEncounter, showParty])

  const act = useCallback<Act>(change => {
    const prev = enc.current
    if (!prev) return
    const before = pty.current
    const out = change(prev, before, rem.current)
    let next = 'encounter' in out ? out.encounter : out
    const nextParty: Party = { ...before }
    if ('characters' in out) for (const c of out.characters) nextParty[c.id] = c
    for (const c of next.combatants) if (c.characterId && !(c.characterId in nextParty)) loadCharacter(c.characterId)
    next = breakConcentration(next, nextParty)
    for (const c of syncPartyConditions(prev, next, nextParty)) nextParty[c.id] = c
    // Characters on players' phones are never written from here.
    for (const id of rem.current) nextParty[id] = before[id]
    if (next === prev && Object.keys(nextParty).every(id => nextParty[id] === before[id])) return
    const changed = commit(next, nextParty, before)
    history.current = [{ encounter: prev, characters: changed.flatMap(id => before[id] ?? []) }, ...history.current].slice(0, MAX_UNDO)
    setUndoCount(history.current.length)
  }, [commit, loadCharacter])

  const undo = useCallback(() => {
    const [last, ...rest] = history.current
    if (!last) return
    history.current = rest
    setUndoCount(rest.length)
    const nextParty: Party = { ...pty.current }
    for (const c of last.characters) nextParty[c.id] = c
    commit(last.encounter, nextParty, pty.current)
  }, [commit])

  /** encounter is undefined while loading, null when it does not exist. */
  return { encounter, party, remote, act, undo, canUndo: undoCount > 0 }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../../model/character'
import { normalize } from '../../sheet/engine'
import { fetchPartyCharacters, watchPartyCharacters } from '../../party/cloud'
import { getCharacter, onCharactersChanged, saveCharacter } from '../../storage'
import { getNpc, onNpcsChanged, saveNpc, type NpcSheet } from '../../npc'
import { breakConcentration, syncPartyConditions, type Party } from '../engine'
import { mirrorNpcs, npcChangesFromRows, type NpcSheets } from '../npcRows'
import { getEncounter, saveEncounter } from '../storage'
import type { Encounter } from '../types'

/** One change: the new encounter, plus any party characters (damage, death saves) or NPC sheets (src/npc) it changed. */
export type Change = (e: Encounter, party: Party, remote: ReadonlySet<string>, npcs: NpcSheets) =>
  Encounter | { encounter: Encounter; characters?: Character[]; npcs?: NpcSheet[] }
export type Act = (change: Change) => void

interface Snapshot {
  encounter: Encounter
  /** Party members as they were before the change, to put back on undo. */
  characters: Character[]
  /** NPC sheets as they were before the change. */
  npcs: NpcSheet[]
}

const MAX_UNDO = 40

/**
 * Loads an encounter and the party members in it, and saves every change to both.
 * After each change, concentration breaks for anyone incapacitated or at 0 HP, and
 * conditions from starting or ending effects are written to the party's characters.
 * A character that is not on this device but is brought to a shared campaign is read from the cloud:
 * it shows, but nothing here changes it (`remote`); the player's own device owns it.
 * Rows with `npcId` play a DM-private NPC sheet: the sheet owns their HP, conditions and uses, the
 * row shows a copy (`mirrorNpcs`), and row changes made through the encounter engine are written back.
 */
export function useEncounter(encounterId: string) {
  const [encounter, setEncounter] = useState<Encounter | null | undefined>(undefined)
  const [party, setParty] = useState<Party>({})
  const [remote, setRemote] = useState<ReadonlySet<string>>(new Set())
  const [npcs, setNpcs] = useState<NpcSheets>({})
  const sheets = useRef<NpcSheets>({})
  const [undoCount, setUndoCount] = useState(0)
  const enc = useRef<Encounter | null | undefined>(undefined)
  const pty = useRef<Party>({})
  const rem = useRef<Set<string>>(new Set())
  const history = useRef<Snapshot[]>([])

  const showParty = useCallback((p: Party) => { pty.current = p; setParty(p) }, [])
  const showEncounter = useCallback((e: Encounter | null | undefined) => { enc.current = e; setEncounter(e) }, [])
  const showNpcs = useCallback((n: NpcSheets) => {
    sheets.current = n
    setNpcs(n)
    // The rows show the sheets as they are now (edited on the NPC sheet screen, or in another tab).
    if (enc.current) showEncounter(mirrorNpcs(enc.current, n))
  }, [showEncounter])
  const loadNpc = useCallback(async (id: string) => {
    const n = await getNpc(id)
    showNpcs({ ...sheets.current, [id]: n })
  }, [showNpcs])
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
      for (const c of e?.combatants ?? []) if (c.npcId) await loadNpc(c.npcId)
      for (const c of e?.combatants ?? []) if (c.characterId) await loadCharacter(c.characterId)
    })
    // Picks up HP or conditions changed on the sheet, in this tab or another.
    const off = onCharactersChanged(id => {
      const ids = (enc.current?.combatants ?? []).flatMap(c => (c.characterId ? [c.characterId] : []))
      for (const x of ids) if (!id || id === x) loadCharacter(x)
    })
    const offNpcs = onNpcsChanged(id => {
      const ids = (enc.current?.combatants ?? []).flatMap(c => (c.npcId ? [c.npcId] : []))
      for (const x of ids) if (!id || id === x) loadNpc(x)
    })
    return () => { live = false; off(); offNpcs() }
  }, [encounterId, loadCharacter, loadNpc, showEncounter])

  // Characters on players' phones: reload when the server says they changed.
  const remoteKey = [...remote].sort().join(',')
  useEffect(() => {
    if (!remoteKey) return
    const ids = remoteKey.split(',')
    return watchPartyCharacters(ids, () => { for (const id of ids) loadCharacter(id) })
  }, [remoteKey, loadCharacter])

  const commit = useCallback((next: Encounter, nextParty: Party, before: Party, nextNpcs: NpcSheets, npcsBefore: NpcSheets) => {
    const changed = Object.keys(nextParty).filter(id => nextParty[id] !== before[id])
    const changedNpcs = Object.keys(nextNpcs).filter(id => nextNpcs[id] !== npcsBefore[id])
    sheets.current = nextNpcs
    setNpcs(nextNpcs)
    showEncounter(next)
    showParty(nextParty)
    saveEncounter(next)
    for (const id of changed) {
      const c = nextParty[id]
      if (c) saveCharacter(c)
    }
    for (const id of changedNpcs) {
      const n = nextNpcs[id]
      if (n) saveNpc(n)
    }
    return { changed, changedNpcs }
  }, [showEncounter, showParty])

  const act = useCallback<Act>(change => {
    const prev = enc.current
    if (!prev) return
    const before = pty.current
    const npcsBefore = sheets.current
    const out = change(prev, before, rem.current, npcsBefore)
    let next = 'encounter' in out ? out.encounter : out
    const nextParty: Party = { ...before }
    const nextNpcs: NpcSheets = { ...npcsBefore }
    if ('encounter' in out) {
      for (const c of out.characters ?? []) nextParty[c.id] = c
      for (const n of out.npcs ?? []) nextNpcs[n.id] = n
    }
    const touched = new Set('encounter' in out ? (out.npcs ?? []).map(n => n.id) : [])
    for (const n of npcChangesFromRows(prev, next, nextNpcs, touched)) nextNpcs[n.id] = n
    next = mirrorNpcs(next, nextNpcs)
    for (const c of next.combatants) if (c.characterId && !(c.characterId in nextParty)) loadCharacter(c.characterId)
    for (const c of next.combatants) if (c.npcId && !(c.npcId in nextNpcs)) loadNpc(c.npcId)
    next = breakConcentration(next, nextParty)
    for (const c of syncPartyConditions(prev, next, nextParty)) nextParty[c.id] = c
    // Characters on players' phones are never written from here.
    for (const id of rem.current) nextParty[id] = before[id]
    if (next === prev && Object.keys(nextParty).every(id => nextParty[id] === before[id]) &&
      Object.keys(nextNpcs).every(id => nextNpcs[id] === npcsBefore[id])) return
    const { changed, changedNpcs } = commit(next, nextParty, before, nextNpcs, npcsBefore)
    const snapshot: Snapshot = { encounter: prev, characters: changed.flatMap(id => before[id] ?? []), npcs: changedNpcs.flatMap(id => npcsBefore[id] ?? []) }
    history.current = [snapshot, ...history.current].slice(0, MAX_UNDO)
    setUndoCount(history.current.length)
  }, [commit, loadCharacter, loadNpc])

  const undo = useCallback(() => {
    const [last, ...rest] = history.current
    if (!last) return
    history.current = rest
    setUndoCount(rest.length)
    const nextParty: Party = { ...pty.current }
    for (const c of last.characters) nextParty[c.id] = c
    const nextNpcs: NpcSheets = { ...sheets.current }
    for (const n of last.npcs) nextNpcs[n.id] = n
    commit(mirrorNpcs(last.encounter, nextNpcs), nextParty, pty.current, nextNpcs, sheets.current)
  }, [commit])

  /** encounter is undefined while loading, null when it does not exist. */
  return { encounter, party, remote, npcs, act, undo, canUndo: undoCount > 0 }
}

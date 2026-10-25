import { useCallback, useEffect, useState } from 'react'
import { createEncounter, elapsed, endCombat, inCombat, nextTurn, startCombat, setInitiative } from '../engine'
import { deleteEncounter, listEncounters, saveEncounter } from '../storage'
import type { Encounter } from '../types'
import { AddCombatants } from './AddCombatants'
import { CombatantRow } from './CombatantRow'
import { Effects } from './Effects'
import { PendingChecks } from './PendingChecks'
import { useCombatRolls } from './rolls'
import { useEncounter } from './useEncounter'
import './combat.css'

const newId = () => crypto.randomUUID()

/** Encounter list, and the open encounter. Each player profile keeps its own encounters. */
export function CombatTracker({ ownerId }: { ownerId: string }) {
  const [list, setList] = useState<Encounter[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const refresh = useCallback(() => { listEncounters(ownerId).then(setList) }, [ownerId])
  useEffect(refresh, [refresh])

  if (openId) return <EncounterView key={openId} encounterId={openId} onBack={() => { setOpenId(null); refresh() }} />

  const create = async () => {
    const e = await saveEncounter(createEncounter(newId(), ownerId, `Encounter ${(list?.length ?? 0) + 1}`))
    setOpenId(e.id)
  }
  return (
    <section className="ff-combat">
      <div className="row spread">
        <h2>Combat tracker</h2>
        <button className="btn primary" onClick={create}>+ New encounter</button>
      </div>
      {list && list.length === 0 && (
        <div className="panel empty">
          <p>Track initiative, concentration and spell timers for a fight.</p>
          <button className="btn primary" onClick={create}>Start an encounter</button>
        </div>
      )}
      <ul className="plain encounter-list">
        {list?.map(e => (
          <li key={e.id} className="panel">
            <div>
              <h3>{e.name}</h3>
              <p className="muted small">
                {e.combatants.length} combatants · {inCombat(e) ? `round ${e.round}` : 'not started'}
              </p>
            </div>
            <div className="row">
              <button className="btn primary small" onClick={() => setOpenId(e.id)}>Open</button>
              <button className="btn ghost small" onClick={async () => {
                if (confirm(`Delete ${e.name}?`)) { await deleteEncounter(e.id); refresh() }
              }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EncounterView({ encounterId, onBack }: { encounterId: string; onBack: () => void }) {
  const { encounter: enc, party, act, undo, canUndo } = useEncounter(encounterId)
  const rolls = useCombatRolls()
  const [editingName, setEditingName] = useState(false)

  if (enc === undefined) return <p className="muted">Loading…</p>
  if (enc === null) return <p>This encounter could not be found. <button className="btn" onClick={onBack}>Back</button></p>

  const fighting = inCombat(enc)
  const unrolled = enc.combatants.filter(c => c.initiative === null)
  const rollMissing = () => act((e, p) => {
    let next = e
    for (const c of e.combatants) {
      if (c.initiative !== null) continue
      const r = rolls.initiative(c, p)
      if (r) next = setInitiative(next, c.id, r.total)
    }
    return next
  })

  return (
    <section className="ff-combat">
      <header className="combat-head">
        <button className="btn ghost" onClick={onBack} aria-label="Back to encounters">←</button>
        {editingName ? (
          <input autoFocus defaultValue={enc.name} aria-label="Encounter name"
            onBlur={ev => { const name = ev.target.value.trim(); if (name) act(e => ({ ...e, name })); setEditingName(false) }}
            onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur() }} />
        ) : (
          <h2><button className="title-btn" onClick={() => setEditingName(true)} title="Rename">{enc.name}</button></h2>
        )}
        <div className="round" aria-live="polite">
          {fighting ? <><strong>Round {enc.round}</strong><span className="muted small">{elapsed(enc.round)}</span></> : <span className="muted">Not started</span>}
        </div>
      </header>

      <div className="combat-actions row">
        {unrolled.length > 0 && <button className="btn" onClick={rollMissing}>Roll initiative ({unrolled.length})</button>}
        {fighting
          ? <button className="btn primary next" onClick={() => act(nextTurn)}>Next turn →</button>
          : <button className="btn primary next" disabled={!enc.combatants.length || unrolled.length > 0} onClick={() => act(startCombat)}
              title={unrolled.length ? 'Everyone needs an initiative first' : undefined}>Start combat</button>}
        {fighting && <button className="btn" onClick={() => confirm('End combat? Every effect ends.') && act(endCombat)}>End combat</button>}
        <button className="btn ghost" disabled={!canUndo} onClick={undo}>Undo</button>
      </div>

      <PendingChecks enc={enc} act={act} />

      <div className="combat-grid">
        <div>
          {enc.combatants.length === 0
            ? <div className="panel empty"><p>Add the party and the monsters to begin.</p></div>
            : (
              <ol className="plain order" aria-label="Initiative order">
                {enc.combatants.map((c, i) => (
                  <CombatantRow key={c.id} enc={enc} combatant={c} party={party} act={act}
                    first={i === 0} last={i === enc.combatants.length - 1} />
                ))}
              </ol>
            )}
          <AddCombatants enc={enc} act={act} />
        </div>
        <div>
          <Effects enc={enc} act={act} />
          <section className="panel">
            <h3>Log</h3>
            {enc.log.length === 0
              ? <p className="muted small">Turns, timers and saves show here.</p>
              : <ol className="plain combat-log">{enc.log.map((l, i) => <li key={i}>{l}</li>)}</ol>}
          </section>
        </div>
      </div>
    </section>
  )
}

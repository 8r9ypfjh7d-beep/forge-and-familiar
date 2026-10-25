import { concentrationOf, dismissCheck, resolveCheck } from '../engine'
import type { Encounter } from '../types'
import { useCombatRolls } from './rolls'
import type { Act } from './useEncounter'

/** Concentration saves waiting to be rolled, one per hit. */
export function PendingChecks({ enc, act }: { enc: Encounter; act: Act }) {
  const rolls = useCombatRolls()
  if (!enc.pendingChecks.length) return null
  return (
    <section className="checks" aria-label="Concentration saves">
      {enc.pendingChecks.map(p => {
        const c = enc.combatants.find(x => x.id === p.combatantId)
        const spell = concentrationOf(enc, p.combatantId)
        if (!c || !spell) return null
        const roll = () => act((e, pt) => {
          const r = rolls.concentration(c, pt, p.dc)
          return r ? resolveCheck(e, p.id, r.total, r.autoFail) : e
        })
        return (
          <div key={p.id} className="check-card panel" role="alert">
            <p><strong>{c.name}</strong> makes a DC {p.dc} Constitution save to keep <strong>{spell.name}</strong>.</p>
            <div className="row">
              <button className="btn primary small" onClick={roll}>Roll save</button>
              <button className="btn small" onClick={() => act(e => resolveCheck(e, p.id, p.dc))}>Passed</button>
              <button className="btn small" onClick={() => act(e => resolveCheck(e, p.id, 0, true))}>Failed</button>
              <button className="btn ghost small" onClick={() => act(e => dismissCheck(e, p.id))}>Skip</button>
            </div>
          </div>
        )
      })}
    </section>
  )
}

import { useI18n } from '../../i18n'
import { concentrationOf, dismissCheck, resolveCheck } from '../engine'
import type { Encounter } from '../types'
import { useCombatRolls } from './rolls'
import type { Act } from './useEncounter'

/** Concentration saves waiting to be rolled, one per hit. */
export function PendingChecks({ enc, act }: { enc: Encounter; act: Act }) {
  const rolls = useCombatRolls()
  const { t } = useI18n()
  if (!enc.pendingChecks.length) return null
  return (
    <section className="checks" aria-label={t('combat.checks')}>
      {enc.pendingChecks.map(p => {
        const c = enc.combatants.find(x => x.id === p.combatantId)
        const spell = concentrationOf(enc, p.combatantId)
        if (!c || !spell) return null
        const roll = () => act((e, pt) => {
          const r = rolls.concentration(c, pt, t('combat.concLabel', { dc: p.dc }))
          return r ? resolveCheck(e, p.id, r.total, r.autoFail) : e
        })
        return (
          <div key={p.id} className="check-card glass" role="alert">
            <p>{t('combat.checkText', { name: c.name, dc: p.dc, effect: spell.name })}</p>
            <div className="row">
              <button className="glass-btn prominent small" onClick={roll}>{t('combat.rollSave')}</button>
              <button className="glass-btn small" onClick={() => act(e => resolveCheck(e, p.id, p.dc))}>{t('combat.passed')}</button>
              <button className="glass-btn small" onClick={() => act(e => resolveCheck(e, p.id, 0, true))}>{t('combat.failed')}</button>
              <button className="glass-btn small plain" onClick={() => act(e => dismissCheck(e, p.id))}>{t('combat.skip')}</button>
            </div>
          </div>
        )
      })}
    </section>
  )
}

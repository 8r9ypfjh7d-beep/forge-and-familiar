import type { Monster } from '../../content'
import { useI18n } from '../../i18n'
import type { Ability } from '../../rules'
import { autoFails, targetConditions } from '../auto'
import { concentrationOf, dismissCheck, resolveCheck, type Party } from '../engine'
import type { Combatant, Encounter } from '../types'
import { useCombatRolls } from './rolls'
import type { Act } from './useEncounter'
import { monsterSave } from '../auto'

/**
 * Saves waiting to be rolled: concentration after a hit, and an effect's repeat save at the end of a turn.
 * Monsters roll their own when the DM's monsterSaves switch is on (CombatTracker), so these are mostly the party's.
 */
export function PendingChecks({ enc, act, monsterOf }: { enc: Encounter; act: Act; party?: Party; monsterOf: (c: Combatant) => Monster | undefined }) {
  const rolls = useCombatRolls()
  const { t, abilityShort } = useI18n()
  if (!enc.pendingChecks.length) return null
  return (
    <section className="checks" aria-label={t('combat.checks')}>
      {enc.pendingChecks.map(p => {
        const c = enc.combatants.find(x => x.id === p.combatantId)
        const effect = p.effectId ? enc.effects.find(e => e.id === p.effectId) : concentrationOf(enc, p.combatantId)
        if (!c || !effect) return null
        const ability = (p.ability ?? 'con') as Ability
        const roll = () => act((e, pt) => {
          const m = monsterOf(c)
          const label = p.effectId ? t('combat.effectSaveLabel', { effect: effect.name, dc: p.dc }) : t('combat.concLabel', { dc: p.dc })
          const r = p.effectId ? rolls.save(c, pt, ability, label, m ? monsterSave(m, ability) : undefined) : rolls.concentration(c, pt, label)
          return r ? resolveCheck(e, p.id, r.total, r.autoFail || autoFails(targetConditions(e, c, pt), ability)) : e
        })
        return (
          <div key={p.id} className="check-card glass" role="alert">
            <p>{p.effectId
              ? t('combat.effectCheckText', { name: c.name, dc: p.dc, ability: abilityShort(ability), effect: effect.name })
              : t('combat.checkText', { name: c.name, dc: p.dc, effect: effect.name })}</p>
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

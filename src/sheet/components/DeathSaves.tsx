import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { deathSaveOutcome, revive, rollDeathSave, setDeathSaves, stabilize, vitals } from '../engine'
import type { Apply } from '../types'
import { useSheetRolls } from '../dice'
import { Marks } from './Pips'

const OUTCOME = {
  'critical-success': 'sheet.death.critical-success',
  'critical-failure': 'sheet.death.critical-failure',
  success: 'sheet.death.success-outcome',
  failure: 'sheet.death.failure-outcome',
} as const

export function DeathSaves({ character, apply }: { character: Character; apply: Apply }) {
  const rolls = useSheetRolls(character)
  const state = vitals(character)
  const { successes, failures } = character.state.deathSaves
  const { t } = useI18n()

  const roll = () => {
    const d20 = rolls.deathSave()
    apply(t('sheet.death.rolled', { outcome: t(OUTCOME[deathSaveOutcome(d20)]), d20 }), c => rollDeathSave(c, d20))
  }

  return (
    <section className={`card death state-${state}`} aria-labelledby="ds-title">
      <h2 id="ds-title">{t('sheet.death')}</h2>
      <div className="ds-rows">
        <div className="ds-row">
          <span>{t('sheet.death.successes')}</span>
          <Marks count={successes} tone="success" label={t('sheet.death.success')}
            onChange={n => apply(t('sheet.death.adjusted'), c => setDeathSaves(c, n, failures))} />
        </div>
        <div className="ds-row">
          <span>{t('sheet.death.failures')}</span>
          <Marks count={failures} tone="failure" label={t('sheet.death.failure')}
            onChange={n => apply(t('sheet.death.adjusted'), c => setDeathSaves(c, successes, n))} />
        </div>
      </div>
      <div className="row">
        {state === 'dying' && <button type="button" className="btn primary" onClick={roll}>{t('sheet.death.roll')}</button>}
        {state === 'dying' && <button type="button" className="btn" onClick={() => apply(t('sheet.death.stabilized'), stabilize)}>{t('sheet.death.stabilize')}</button>}
        {state === 'dead' && <button type="button" className="btn" onClick={() => apply(t('sheet.death.revived'), c => revive(c))}>{t('sheet.death.revive')}</button>}
      </div>
    </section>
  )
}

import { useI18n } from '../../i18n'
import type { Character, HitDie } from '../../model/character'
import { abilityMod, formatMod, getAbilityScores } from '../../rules'
import { canLongRest, effectiveMaxHp, hitDiceRemaining, longRest, shortRest, spendHitDie, vitals } from '../engine'
import type { Apply } from '../types'
import { useSheetRolls } from '../dice'
import { defaultMeal, endDay } from '../../supplies/supplies'

/**
 * One tap rests. Short rest brings back short-rest resources; while hurt, each hit die type
 * gets a one-tap roll to heal. Long rest eats a ration if there is one and resets everything.
 */
export function Rests({ character, apply }: { character: Character; apply: Apply }) {
  const rolls = useSheetRolls(character)
  const con = abilityMod(getAbilityScores(character).con)
  const dice = hitDiceRemaining(character)
  const dead = vitals(character) === 'dead'
  const hurt = vitals(character) === 'healthy' && character.state.currentHp < effectiveMaxHp(character)
  const { t } = useI18n()

  const spend = (die: HitDie) => {
    const roll = rolls.hitDie(die, con)
    const gained = Math.max(0, roll + con)
    apply(t('sheet.log.hitDie', { die, roll, con: formatMod(con), gained }), c => spendHitDie(c, die, roll))
  }
  const long = () => {
    const meal = defaultMeal(character)
    apply(t(meal === 'ration' ? 'sheet.log.longRation' : 'sheet.log.long'), c => endDay(c, longRest(c), meal))
  }

  return (
    <section className="card rests" aria-labelledby="rest-title">
      <h2 id="rest-title">{t('sheet.rest')}</h2>
      <div className="row rest-buttons">
        <button type="button" className="btn" disabled={dead} onClick={() => apply(t('sheet.log.short'), shortRest)}>{t('rest.short')}</button>
        <button type="button" className="btn primary" disabled={!canLongRest(character)} onClick={long}>{t('rest.long')}</button>
      </div>
      {!canLongRest(character) && !dead && <p className="hint">{t('sheet.longRestNeedsHp')}</p>}
      <p className="hint">
        {t('sheet.hitDice', { list: dice.map(d => `${d.remaining}/${d.total} ${d.die}`).join(', ') })}
      </p>
      {hurt && dice.some(d => d.remaining > 0) && (
        <div className="row hit-dice">
          {dice.filter(d => d.remaining > 0).map(d => (
            <button key={d.die} type="button" className="btn small" onClick={() => spend(d.die)}>{t('sheet.rollDie', { die: d.die })}</button>
          ))}
        </div>
      )}
    </section>
  )
}

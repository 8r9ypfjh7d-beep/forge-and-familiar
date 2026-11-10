import { fmtMod } from '../../i18n/signed'
import { useI18n } from '../../i18n'
import type { Character, HitDie } from '../../model/character'
import { useState } from 'react'
import { abilityMod, getAbilityScores, getResources } from '../../rules'
import { canLongRest, effectiveMaxHp, hitDiceRemaining, hitDieAverage, hitDicePreview, longRest, restGains, shortRest, spendHitDie, vitals } from '../engine'
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
  const { t, term } = useI18n()
  const preview = hitDicePreview(character)
  // What the last rest gave back, shown under the buttons and saved in the log.
  const [back, setBack] = useState('')

  /** "Back: HP full, 2 spell slots, Arcane Recovery", or '' when nothing came back. */
  const backText = (after: Character) => {
    const g = restGains(character, after)
    const names = new Map(getResources(character).map(r => [r.id, term('resource', r.id, r.label)]))
    const list = [
      g.hp ? (g.full ? t('rest.hpFull') : t('rest.hp', { n: g.hp })) : '',
      g.slots ? (g.slots === 1 ? t('rest.slot1') : t('rest.slots', { n: g.slots })) : '',
      g.hitDice ? (g.hitDice === 1 ? t('rest.die1') : t('rest.dice', { n: g.hitDice })) : '',
      ...g.resources.map(id => names.get(id) ?? ''),
    ].filter(Boolean)
    return list.length ? t('rest.back', { list: list.join(', ') }) : ''
  }
  const rest = (log: string, fn: (c: Character) => Character) => {
    const text = backText(fn(character))
    setBack(text || t('rest.nothingBack'))
    apply(text ? `${log}. ${text}` : log, fn)
  }

  const spend = (die: HitDie) => {
    const roll = rolls.hitDie(die, con)
    const gained = Math.max(0, roll + con)
    setBack('')
    apply(t('sheet.log.hitDie', { die, roll, con: fmtMod(con), gained }), c => spendHitDie(c, die, roll))
  }
  const long = () => {
    const meal = defaultMeal(character)
    rest(t(meal === 'ration' ? 'sheet.log.longRation' : 'sheet.log.long'), c => endDay(c, longRest(c), meal))
  }

  return (
    <section className="card rests" aria-labelledby="rest-title">
      <h2 id="rest-title">{t('sheet.rest')}</h2>
      <div className="row rest-buttons">
        <button type="button" className="btn" disabled={dead} onClick={() => rest(t('sheet.log.short'), shortRest)}>{t('rest.short')}</button>
        <button type="button" className="btn primary" disabled={!canLongRest(character)} onClick={long}>{t('rest.long')}</button>
      </div>
      {back && <p className="hint rest-back" aria-live="polite">{back}</p>}
      {!canLongRest(character) && !dead && <p className="hint">{t('sheet.longRestNeedsHp')}</p>}
      <p className="hint">
        {t('sheet.hitDice', { list: dice.map(d => `${d.remaining}/${d.total} ${d.die}`).join(', ') })}
      </p>
      {hurt && dice.some(d => d.remaining > 0) && (
        <p className="hint hit-dice-preview">
          {t(preview.enough
            ? (preview.dice === 1 ? 'sheet.hitDicePreview1' : 'sheet.hitDicePreview')
            : (preview.dice === 1 ? 'sheet.hitDicePreviewShort1' : 'sheet.hitDicePreviewShort'), { missing: preview.missing, dice: preview.dice, heal: preview.heal })}
        </p>
      )}
      {hurt && dice.some(d => d.remaining > 0) && (
        <div className="row hit-dice">
          {dice.filter(d => d.remaining > 0).map(d => (
            <button key={d.die} type="button" className="btn small" onClick={() => spend(d.die)}>{t('sheet.rollDieAvg', { die: d.die, avg: Math.round(hitDieAverage(d.die, con)) })}</button>
          ))}
        </div>
      )}
    </section>
  )
}

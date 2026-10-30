// The player's own conditions, under hit points in both modes: tap one for its rules, ✕ to remove,
// "+ Condition" to add. Saved in state.conditions, which the dice (rules/rollMode) and the DM's
// combat tracker already read, so rolls pick up advantage and disadvantage on their own.
import { useState } from 'react'
import { useI18n, type MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import { CONDITIONS, derive, type ConditionId } from '../../rules'
import { setCondition } from '../engine'
import type { Apply } from '../types'

export function Conditions({ character, apply }: { character: Character; apply: Apply }) {
  const { t, term } = useI18n()
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<ConditionId | null>(null)
  const active = character.state.conditions
  const immune = derive(character).defenses.conditionImmunities
  const name = (id: ConditionId) => term('condition', id, id[0].toUpperCase() + id.slice(1))
  const set = (id: ConditionId, on: boolean) => {
    apply(t(on ? 'cond.log.add' : 'cond.log.remove', { name: name(id) }), c => setCondition(c, id, on))
    if (!on && open === id) setOpen(null)
  }
  const shown = open && active.includes(open) ? open : null

  return (
    <div className="conditions" role="group" aria-label={t('cond.title')}>
      <div className="cond-row">
        {active.map(id => (
          <span key={id} className="chip on cond-chip">
            <button type="button" className="cond-name" aria-expanded={shown === id} aria-label={t('cond.rulesOf', { name: name(id) })} onClick={() => setOpen(o => (o === id ? null : id))}>
              {name(id)}
            </button>
            <button type="button" className="cond-x" aria-label={t('cond.remove', { name: name(id) })} onClick={() => set(id, false)}>✕</button>
          </span>
        ))}
        <button type="button" className="chip cond-add" aria-expanded={adding} onClick={() => setAdding(a => !a)}>{t('cond.add')}</button>
      </div>
      {shown && <p className="cond-rules hint"><strong>{name(shown)}.</strong> {t(`dm.cond.${shown}` as MessageKey)}</p>}
      {adding && (
        <div className="cond-picker">
          {CONDITIONS.filter(id => !active.includes(id)).map(id => (
            <button key={id} type="button" className="chip" title={t(`dm.cond.${id}` as MessageKey)}
              onClick={() => { set(id, true); setAdding(false) }}>
              {immune.includes(id) ? t('cond.immune', { name: name(id) }) : name(id)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

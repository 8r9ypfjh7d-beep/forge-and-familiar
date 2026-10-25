import { useI18n, type MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import { getSpellSlots } from '../../rules'
import { setPactUsed, setSlotUsed } from '../engine'
import type { Apply } from '../types'
import { Pips } from './Pips'


export function SpellSlots({ character, apply }: { character: Character; apply: Apply }) {
  const { slots, pact } = getSpellSlots(character)
  const { spellSlotsUsed, pactSlotsUsed } = character.state
  const { t } = useI18n()
  const ordinal = (level: number) => t(`sheet.slot.${level}` as MessageKey)
  if (!pact && slots.every(n => n === 0)) return null

  return (
    <section className="card" aria-labelledby="slots-title">
      <h2 id="slots-title">{t('sheet.slots')}</h2>
      <ul className="track-list">
        {slots.map((total, i) => total > 0 && (
          <li key={i}>
            <span className="track-label">{ordinal(i + 1)}</span>
            <Pips total={total} used={spellSlotsUsed[i] ?? 0} label={t('sheet.slotLabel', { ordinal: ordinal(i + 1) })}
              onChange={used => apply(t(used > (spellSlotsUsed[i] ?? 0) ? 'sheet.log.slotUsed' : 'sheet.log.slotRestored', { ordinal: ordinal(i + 1) }), c => setSlotUsed(c, i + 1, used))} />
            <span className="track-count">{total - (spellSlotsUsed[i] ?? 0)}/{total}</span>
          </li>
        ))}
        {pact && (
          <li>
            <span className="track-label">{t('sheet.pact')} <small>({ordinal(pact.level)})</small></span>
            <Pips total={pact.count} used={pactSlotsUsed} label={t('sheet.pactSlot')}
              onChange={used => apply(t(used > pactSlotsUsed ? 'sheet.log.pactUsed' : 'sheet.log.pactRestored'), c => setPactUsed(c, used))} />
            <span className="track-count">{pact.count - pactSlotsUsed}/{pact.count}</span>
          </li>
        )}
      </ul>
      {pact && <p className="hint">{t('sheet.pactHint')}</p>}
    </section>
  )
}

import { useI18n, type MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import { derive, getSpellSlots } from '../../rules'
import { setPactUsed, setSlotUsed } from '../engine'
import type { Apply } from '../types'
import { Pips } from './Pips'

/** Whether the character has any spell slots (regular or pact). */
export function hasSlots(character: Character): boolean {
  const { slots, pact } = getSpellSlots(character)
  return !!pact || slots.some(n => n > 0)
}

/** Spells the character's equipped items let them cast (an item effect). */
export const itemSpellsOf = (character: Character) => derive(character).itemSpells

/** Spell slot pips by level, plus warlock pact slots and spells from items. Lives inside the Spells card in both sheet modes. */
export function SpellSlots({ character, apply }: { character: Character; apply: Apply }) {
  const { slots, pact } = getSpellSlots(character)
  const { spellSlotsUsed, pactSlotsUsed } = character.state
  const { t } = useI18n()
  const ordinal = (level: number) => t(`sheet.slot.${level}` as MessageKey)
  const fromItems = itemSpellsOf(character)
  if (!hasSlots(character)) return fromItems.length ? <ItemSpells spells={fromItems} /> : null

  return (
    <>
    <div className="spell-slots" role="group" aria-labelledby="slots-title">
      <h3 id="slots-title" className="sub-title">{t('sheet.slots')}</h3>
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
    </div>
    {fromItems.length > 0 && <ItemSpells spells={fromItems} />}
    </>
  )
}

function ItemSpells({ spells }: { spells: ReturnType<typeof itemSpellsOf> }) {
  const { t } = useI18n()
  return (
    <div className="spell-slots item-spells" role="group" aria-labelledby="item-spells-title">
      <h3 id="item-spells-title" className="sub-title">{t('spells.fromItems')}</h3>
      <ul className="track-list">
        {spells.map((s, i) => (
          <li key={i}>
            <span className="track-label"><bdi>{s.spell}</bdi><small><bdi>{s.source}</bdi>{s.note ? <> · <bdi>{s.note}</bdi></> : null}</small></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

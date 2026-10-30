// What taking damage calls for, right under the HP card's Damage button: the concentration save
// (one tap rolls it, a fail ends the spell), the damage a running Armor of Agathys deals back, and
// reaction spells cast in answer to being hurt (Hellish Rebuke, Absorb Elements).
import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { DAMAGE_REACTION_SPELLS, derive, itemSpellCast } from '../../rules'
import { CastButton, CastResult, useCast } from '../../spellbook/Cast'
import { itemSpellCaster } from '../../spellbook/Cast'
import { LastRoll, type Shown } from '../combat/LastRoll'
import { useSheetRolls } from '../dice'
import { concentration, endEffect } from '../effects'
import type { Apply } from '../types'
import { useSpells } from './Effects'

/** One hit, as the HP card took it. */
export interface Hit {
  key: number
  /** Damage type, when the player picked one. */
  type?: string
  /** The concentration effect it threatens, with the save DC. */
  conc?: { id: string; name: string; dc: number }
  reprisals: { name: string; damage: string; type?: string }[]
}

/** Absorb Elements only answers these. */
const ELEMENTS = ['acid', 'cold', 'fire', 'lightning', 'thunder']

const answers = (id: string, type?: string) => id !== 'absorb-elements' || !type || ELEMENTS.includes(type)

export function AfterDamage({ hit, character, apply, onClose }: { hit: Hit; character: Character; apply: Apply; onClose: () => void }) {
  const { t, term } = useI18n()
  const rolls = useSheetRolls(character)
  const casting = useCast(character, apply)
  const spells = useSpells(character)
  const [save, setSave] = useState<{ key: number; shown: Shown[]; kept: boolean } | null>(null)
  const d = derive(character)

  // Out cold: no saves to make (concentration already ended) and no reactions to take.
  if (character.state.currentHp === 0) return null

  const known = new Set((character.spells ?? []).map(s => s.id))
  const reactions = spells.filter(s => DAMAGE_REACTION_SPELLS.includes(s.id) && known.has(s.id) && answers(s.id, hit.type))
  const innate = d.itemSpells.filter(s => {
    const name = itemSpellCast(s.spell).name.toLowerCase()
    const spell = spells.find(x => x.name.toLowerCase() === name)
    return spell && DAMAGE_REACTION_SPELLS.includes(spell.id) && !known.has(spell.id) && answers(spell.id, hit.type)
  })
  const caster = itemSpellCaster(spells, casting.cast)
  const conc = hit.conc && concentration(character)?.id === hit.conc.id ? hit.conc : undefined
  const saved = save?.key === hit.key ? save : null

  if (!conc && !saved && !hit.reprisals.length && !reactions.length && !innate.length && !casting.out) return null

  const rollSave = () => {
    if (!conc) return
    const r = rolls.save(d, 'con', d.concentrationAdvantage ? 'advantage' : undefined)
    const kept = !r.autoFail && r.total >= conc.dc
    setSave({ key: hit.key, kept, shown: [{ roll: r, what: t('hurt.conc', { dc: conc.dc, name: conc.name }) }] })
    if (!kept) apply(t('hurt.log.lostConc', { name: conc.name }), c => endEffect(c, conc.id))
  }
  const lose = () => {
    if (!conc) return
    setSave({ key: hit.key, kept: false, shown: [] })
    apply(t('hurt.log.lostConc', { name: conc.name }), c => endEffect(c, conc.id))
  }
  const name = hit.conc?.name ?? ''

  return (
    <div className="hp-after" role="group" aria-live="polite">
      <button type="button" className="glass-btn small icon hp-after-close" aria-label={t('hurt.dismiss')} title={t('hurt.dismiss')} onClick={onClose}>✕</button>
      {conc && !saved && (
        <div className="hp-after-row">
          <span>{t('hurt.conc', { dc: conc.dc, name: conc.name })}</span>
          <span className="hp-after-actions">
            <button type="button" className="glass-btn small prominent" onClick={rollSave}>{t('hurt.conc.roll')}</button>
            <button type="button" className="glass-btn small" onClick={lose}>{t('hurt.conc.lost')}</button>
          </span>
        </div>
      )}
      {saved && (
        <>
          {saved.shown.length > 0 && <LastRoll rolls={saved.shown} />}
          <p className={`hp-after-outcome ${saved.kept ? 'kept' : 'lost'}`}>{t(saved.kept ? 'hurt.conc.kept' : 'hurt.conc.broke', { name })}</p>
        </>
      )}
      {hit.reprisals.map(r => (
        <p key={r.name} className="hp-after-row">
          {t('hurt.reprisal', { name: r.name, dice: r.damage, type: r.type ? ` ${term('damage', r.type, r.type)}` : '' })}
        </p>
      ))}
      {reactions.map(s => (
        <div key={s.id} className="hp-after-row">
          <span>{t('hurt.reaction', { name: s.name })}</span>
          <CastButton character={character} spell={s} onCast={casting.cast} />
        </div>
      ))}
      {innate.map(s => (
        <div key={`${s.source}:${s.spell}`} className="hp-after-row">
          <span>{t('hurt.reaction', { name: s.spell })} <small className="hint">{s.source}</small></span>
          <button type="button" className="glass-btn small prominent" aria-label={t('cast.castName', { name: s.spell })} onClick={() => caster.cast(s)}>{t('cast.cast')}</button>
        </div>
      ))}
      <CastResult out={casting.out} outKey={casting.outKey} onDone={casting.clear} character={character} apply={apply} />
    </div>
  )
}

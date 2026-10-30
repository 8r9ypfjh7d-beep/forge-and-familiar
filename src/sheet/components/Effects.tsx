// The Effects switches: Rage and Sneak Attack, every known spell whose running effect changes numbers
// (Hex, Bless, Shield of Faith), whatever is running now (Armor of Agathys after casting it) and the
// player's own actions. Combat's Combat tab lists them all; story mode gets them as their own card.
// Switching on a spell that isn't running casts it, exactly like Cast; switching it off ends it.
import { useEffect, useState } from 'react'
import { loadKind, type Spell } from '../../content'
import { effectText } from '../../inventory'
import { useI18n, type MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import { derive, RECKLESS_ID } from '../../rules'
import { editionOf, spellSourcesFor } from '../../spellbook/access'
import { effectToggles, setActionActive, type EffectToggle } from '../combat/combat'
import type { SlotChoice } from '../../quickcast'
import { spendSlot } from '../../quickcast/quickcast'
import { CastResult, ConfirmCast, SlotPicker, useCast, useCastWarning } from '../../spellbook/Cast'
import { endEffect, endFight, endsWithFight, setEffectOn, startEffect } from '../effects'
import type { Apply } from '../types'
import { FormCard } from './WildShape'

type T = ReturnType<typeof useI18n>['t']

/** Casts a spell from its switch, at the picked slot or the lowest free one. */
export type CastFn = (spell: Spell, slot?: SlotChoice) => unknown

/**
 * Flips one switch. On, a known spell that isn't running is cast (slot, temporary HP, rolls); off, a running
 * spell, feature or item effect ends. Custom actions are saved on the action. Rage and Sneak Attack use `local`.
 */
export function toggleEffect(e: EffectToggle, value: boolean, apply: Apply, t: T, local: () => void, cast: CastFn, slot?: SlotChoice) {
  const log = t(value ? 'cs.log.effectOn' : 'cs.log.effectOff', { name: e.name })
  if (e.id.startsWith('act:')) return apply(log, c => setActionActive(c, e.id.slice(4), value))
  if (e.live) return value ? apply(log, c => setEffectOn(c, e.id, true)) : confirm(t('fx.confirmEnd', { name: e.name })) && apply(t('fx.log.end', { name: e.name }), c => endEffect(c, e.id))
  if (e.spell && value) return void cast(e.spell, slot ?? e.slot)
  if (e.start && value) return apply(log, c => startEffect(e.slot ? spendSlot(c, e.slot) : c, e.start!).character)
  local()
}

/** What a switch does, in short: its dice, stat changes and the running effect's extras. */
function useDescribe() {
  const i18n = useI18n()
  const { t, term } = i18n
  return (e: EffectToggle) => {
    const fx = e.live ?? e.start
    const type = (d?: string) => (d ? ` ${term('damage', d, d)}` : '')
    return [
      e.damage ? `${t(e.weaponOnly ? 'cs.affects.weapon' : 'cs.affects.damage')}${e.damageType ? ` (${term('damage', e.damageType, e.damageType)})` : ''}` : '',
      e.pactOnly ? t('fx.pactOnly') : '',
      fx?.once ? t('fx.once') : '',
      ...(['attack', 'save', 'check'] as const).map(k => (fx?.rollDice?.[k] ? t(`fx.dice.${k}` as MessageKey, { dice: fx.rollDice[k]! }) : '')),
      fx?.acBase ? t('fx.acBase', { n: fx.acBase }) : '',
      fx?.acMin ? t('fx.acMin', { n: fx.acMin }) : '',
      fx?.reflect ? t('fx.reflect', { dice: fx.reflect.damage, type: type(fx.reflect.type) }) : '',
      fx?.whileTempHp ? t('fx.whileTempHp') : '',
      e.id === RECKLESS_ID ? t('fx.reckless') : '',
      ...(e.stats ?? []).map(f => effectText(i18n, f)),
    ].filter(Boolean).join(' · ')
  }
}

export function EffectRows({ character, effects, isOn, onToggle, apply }: {
  character: Character; effects: EffectToggle[]; isOn: (e: EffectToggle) => boolean; onToggle: (e: EffectToggle, value: boolean, slot?: SlotChoice) => void; apply: Apply
}) {
  const { t, term, spellName, spellMeasure } = useI18n()
  const describe = useDescribe()
  const warning = useCastWarning(character)
  // A cast that warns (no slot left, or it ends another concentration spell) waits here for Cast anyway.
  const [pending, setPending] = useState<{ id: string; slot?: SlotChoice; text: string } | null>(null)
  const flip = (e: EffectToggle, value: boolean, slot?: SlotChoice) => {
    setPending(null)
    const text = value && e.spell && !e.live ? warning(e.spell, slot) : ''
    if (text) return setPending({ id: e.id, slot, text })
    onToggle(e, value, slot)
  }
  return (
    <ul className="cs-rows cs-effects">
      {effects.map(e => {
        const live = e.live
        // A spell that isn't running shows the slot its cast will take, or that none is left.
        const level = live?.level ?? (e.spell ? e.slot?.level : undefined)
        const noSlot = !live && e.spell && e.spell.level > 0 && !e.slot
        return (
          <li key={e.id} className={live ? 'running' : undefined}>
            <label className="cs-switch">
              <input type="checkbox" role="switch" checked={live ? true : isOn(e)} onChange={ev => flip(e, ev.target.checked)} />
              <span>{e.feature ? term('feature', e.name, e.name) : <bdi>{e.spell ? spellName(e.spell.id, e.name) : term('feature', e.name, e.name)}</bdi>}</span>
            </label>
            {e.damage && <span className="dmg" dir="ltr">{e.damage}</span>}
            <span className="hint">{describe(e)}</span>
            <span className="fx-live">
              {live?.concentration && <abbr className="sb-tag" title={t('spells.concentration')}>C</abbr>}
              {level ? <span className="sb-badge">{t(`sheet.slot.${level}` as MessageKey)}{!live && e.slot?.source === 'pact' ? ` ${t('cast.pact')}` : ''}</span> : null}
              {noSlot && <small>{t('cast.warn.noSlot')}</small>}
              {!live && e.spell && <SlotPicker character={character} spell={e.spell} onPick={s => flip(e, true, s)} />}
              {live?.duration && <small>{spellMeasure(live.duration)}</small>}
              {live && !(live.self && live.on) && (
                <button type="button" className={`glass-chip small${live.on ? ' on' : ''}`} aria-pressed={live.on} aria-label={t('fx.onMeName', { name: e.name })}
                  onClick={() => apply(t(live.on ? 'cs.log.effectOff' : 'cs.log.effectOn', { name: e.name }), c => setEffectOn(c, e.id, !live.on))}>
                  {t(live.on ? 'fx.onMe' : 'fx.notOnMe')}
                </button>
              )}
              {/* Hex moves to a new target when the cursed one drops to 0 HP: a bonus action, no slot. */}
              {live && e.id === 'spell:hex' && (
                <button type="button" className="glass-chip small" onClick={() => apply(t('fx.log.moveHex'), c => c)}>{t('fx.moveHex')}</button>
              )}
            </span>
            {live?.form && <FormCard character={character} form={live.form} />}
            {pending?.id === e.id && (
              <ConfirmCast text={pending.text} onYes={() => { setPending(null); onToggle(e, true, pending.slot) }} onNo={() => setPending(null)} />
            )}
          </li>
        )
      })}
      {effects.some(e => e.live && endsWithFight(e.live)) && (
        <li className="fx-end-fight">
          <button type="button" className="glass-btn small" onClick={() => apply(
            t('fx.log.endFight', { names: effects.filter(e => e.live && endsWithFight(e.live)).map(e => e.name).join(', ') }), endFight)}>
            {t('fx.endFight')}
          </button>
        </li>
      )}
    </ul>
  )
}

/** The edition's spells (SRD and books), for knowing which of the character's spells have a switch. */
export function useSpells(character: Character): Spell[] {
  const edition = editionOf(character)
  const [spells, setSpells] = useState<{ edition: string; list: Spell[] }>({ edition, list: [] })
  useEffect(() => {
    let live = true
    loadKind('spells', { sources: spellSourcesFor(edition) }).then(list => { if (live) setSpells({ edition, list }) }).catch(() => {})
    return () => { live = false }
  }, [edition])
  return spells.edition === edition ? spells.list : []
}

/** Story mode's Effects card. Rage and Sneak Attack stay on the Attacks card; nothing to switch hides the card. */
export function EffectsCard({ character, apply }: { character: Character; apply: Apply }) {
  const { t } = useI18n()
  const spells = useSpells(character)
  const casting = useCast(character, apply)
  const effects = effectToggles(character, derive(character), spells).filter(e => !e.feature)
  if (!effects.length) return null
  const isOn = (e: EffectToggle) => (e.id.startsWith('act:') ? !!character.customActions?.find(a => `act:${a.id}` === e.id)?.active : !!e.live?.on)
  return (
    <section className="card cs-fight fx-card" aria-labelledby="fx-title">
      <div className="card-head"><h2 id="fx-title">{t('cs.effects')}</h2></div>
      <CastResult out={casting.out} outKey={casting.outKey} onDone={casting.clear} character={character} apply={apply} />
      <EffectRows character={character} effects={effects} isOn={isOn} apply={apply} onToggle={(e, v, slot) => toggleEffect(e, v, apply, t, () => {}, casting.cast, slot)} />
    </section>
  )
}

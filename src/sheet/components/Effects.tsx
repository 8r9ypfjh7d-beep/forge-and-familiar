// The Effects switches: Rage and Sneak Attack, every known spell whose running effect changes numbers
// (Hex, Bless, Shield of Faith), whatever is running now (Armor of Agathys after casting it) and the
// player's own actions. Combat's Combat tab lists them all; story mode gets them as their own card.
import { useEffect, useState } from 'react'
import { loadKind, type Spell } from '../../content'
import { effectText } from '../../inventory'
import { useI18n, type MessageKey } from '../../i18n'
import type { Character } from '../../model/character'
import { derive } from '../../rules'
import { editionOf, spellSourcesFor } from '../../spellbook/access'
import { effectToggles, setActionActive, type EffectToggle } from '../combat/combat'
import { endEffect, setEffectOn, startEffect } from '../effects'
import type { Apply } from '../types'

type T = ReturnType<typeof useI18n>['t']

/**
 * Flips one switch. Custom actions and running spells are saved; a known spell that isn't running
 * starts without spending a slot (it was cast before, or off the sheet). Rage and Sneak Attack use `local`.
 */
export function toggleEffect(e: EffectToggle, value: boolean, apply: Apply, t: T, local: () => void) {
  const log = t(value ? 'cs.log.effectOn' : 'cs.log.effectOff', { name: e.name })
  if (e.id.startsWith('act:')) return apply(log, c => setActionActive(c, e.id.slice(4), value))
  if (e.live) return apply(log, c => setEffectOn(c, e.id, value))
  if (e.start && value) return apply(log, c => startEffect(c, e.start!).character)
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
      fx?.once ? t('fx.once') : '',
      ...(['attack', 'save', 'check'] as const).map(k => (fx?.rollDice?.[k] ? t(`fx.dice.${k}` as MessageKey, { dice: fx.rollDice[k]! }) : '')),
      fx?.acBase ? t('fx.acBase', { n: fx.acBase }) : '',
      fx?.acMin ? t('fx.acMin', { n: fx.acMin }) : '',
      fx?.reflect ? t('fx.reflect', { dice: fx.reflect.damage, type: type(fx.reflect.type) }) : '',
      fx?.whileTempHp ? t('fx.whileTempHp') : '',
      ...(e.stats ?? []).map(f => effectText(i18n, f)),
    ].filter(Boolean).join(' · ')
  }
}

export function EffectRows({ effects, isOn, onToggle, apply }: {
  effects: EffectToggle[]; isOn: (e: EffectToggle) => boolean; onToggle: (e: EffectToggle, value: boolean) => void; apply: Apply
}) {
  const { t, term } = useI18n()
  const describe = useDescribe()
  return (
    <ul className="cs-rows cs-effects">
      {effects.map(e => {
        const live = e.live
        return (
          <li key={e.id} className={live ? 'running' : undefined}>
            <label className="cs-switch">
              <input type="checkbox" role="switch" checked={isOn(e)} onChange={ev => onToggle(e, ev.target.checked)} />
              <span>{e.feature ? term('feature', e.name, e.name) : <bdi>{e.name}</bdi>}</span>
            </label>
            {e.damage && <span className="dmg" dir="ltr">{e.damage}</span>}
            <span className="hint">{describe(e)}</span>
            {live && (
              <span className="fx-live">
                {live.concentration && <abbr className="sb-tag" title={t('spells.concentration')}>C</abbr>}
                {live.level ? <span className="sb-badge">{t(`sheet.slot.${live.level}` as MessageKey)}</span> : null}
                {live.duration && <small lang="en" dir="ltr">{live.duration}</small>}
                {!live.on && <small>{t('fx.notOnMe')}</small>}
                <button type="button" className="glass-btn small icon" aria-label={t('fx.endName', { name: e.name })} title={t('fx.end')}
                  onClick={() => apply(t('fx.log.end', { name: e.name }), c => endEffect(c, e.id))}>✕</button>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** The edition's spells (SRD and books), for knowing which of the character's spells have a switch. */
function useSpells(character: Character): Spell[] {
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
  const effects = effectToggles(character, derive(character), spells).filter(e => !e.feature)
  if (!effects.length) return null
  const isOn = (e: EffectToggle) => (e.id.startsWith('act:') ? !!character.customActions?.find(a => `act:${a.id}` === e.id)?.active : !!e.live?.on)
  return (
    <section className="card cs-fight fx-card" aria-labelledby="fx-title">
      <div className="card-head"><h2 id="fx-title">{t('cs.effects')}</h2></div>
      <EffectRows effects={effects} isOn={isOn} apply={apply} onToggle={(e, v) => toggleEffect(e, v, apply, t, () => {})} />
    </section>
  )
}

// One-tap casting from the spell cards: spends the slot, rolls what the spell rolls, gives its
// temporary HP, and starts its running effect (shown under Effects). A small ▾ casts at a higher level.
import { useState } from 'react'
import type { Spell } from '../content'
import { useI18n, type MessageKey } from '../i18n'
import type { Character } from '../model/character'
import { slotChoices, spellDamage } from '../quickcast/quickcast'
import type { SlotChoice } from '../quickcast'
import { derive, getResources } from '../rules'
import { withRollFromText } from '../sheet/combat/combat'
import { LastRoll, type Shown } from '../sheet/combat/LastRoll'
import { useSheetRolls } from '../sheet/dice'
import { heal } from '../sheet/engine'
import { startEffect } from '../sheet/effects'
import type { Apply } from '../sheet/types'
import { castPlan, castSpell, defaultSlot, fixedAmount } from './cast'
import { toQuickCast } from './spellbook'

export interface CastOut { name: string; rolls: Shown[]; note?: string; healMe?: number }

/** Casting for one card: `cast` does everything and returns what to show; `out` is the last result. */
export function useCast(character: Character, apply: Apply) {
  const { t, term, abilityShort } = useI18n()
  const rolls = useSheetRolls(character)
  const [out, setOut] = useState<{ key: number; value: CastOut } | null>(null)

  /**
   * `free`: cast without a slot (an item's or a race's spell), at `free.level` when it says so, spending
   * `free.spend` (its once-per-rest use or the item's charges) when it has a limit.
   */
  const cast = (spell: Spell, chosen?: SlotChoice, free?: { level?: number; spend?: { id: string; n: number } }) => {
    const slot = free ? undefined : chosen ?? defaultSlot(character, spell)
    const d = derive(character)
    const level = slot?.level ?? free?.level ?? spell.level
    const plan = castPlan(character, d, spell, slot, level)
    const shown: Shown[] = []
    const notes: string[] = []
    if (slot) notes.push(t(slot.source === 'pact' ? 'cs.usedPact' : 'cs.usedSlot', { level: slot.level }))
    else if (spell.level > 0 && !free) notes.push(t('cast.noSlot'))
    if (free?.spend) {
      const r = getResources(character).find(x => x.id === free.spend!.id)
      const left = r ? r.max - (character.state.resources[r.id]?.used ?? 0) : 0
      notes.push(left < free.spend.n ? t('use.noneLeft') : t('use.left', { n: left - free.spend.n, max: r?.max ?? 0 }))
    }

    // Attack, save and damage or healing, as the attacks table rolls them.
    const entry = toQuickCast(withRollFromText(spell))
    const sc = d.spellcasting
    const dice = spellDamage({ ...entry, id: '', kind: 'spell' }, level, d.level, sc ? d.mods[sc.ability] : 0)
    const healing = entry.damageType === 'healing'
    const riders = entry.roll === 'attack' && !healing
      ? (character.state.effects ?? []).filter(e => e.on && e.damage && !e.weaponOnly).map(e => ({ name: e.name, damage: e.damage! }))
      : []
    let healMe: number | undefined
    if (entry.roll !== 'none' || dice) {
      const res = rolls.spell(spell.name, { attackBonus: entry.roll === 'attack' ? sc?.attackBonus : undefined, damage: dice, damageType: entry.damageType, riders })
      if ('attack' in res && res.attack) shown.push({ roll: res.attack, what: t('cs.roll.toHit') })
      if (res.damage) {
        const type = entry.damageType && !healing ? term('damage', entry.damageType, entry.damageType) : ''
        shown.push({ roll: res.damage, what: healing ? t('cs.roll.healing') : t(type ? 'cs.roll.damage' : 'cs.roll.damagePlain', { type }) })
        if (healing) healMe = res.damage.total
      }
    }
    if (entry.roll === 'save' && entry.save && sc) notes.push(t('cs.saveNote', { dc: sc.saveDc, ability: abilityShort(entry.save) }))
    if (plan.hit) {
      const res = rolls.spell(spell.name, { damage: plan.hit.dice, damageType: plan.hit.type })
      const type = plan.hit.type ? term('damage', plan.hit.type, plan.hit.type) : ''
      if (res.damage) shown.push({ roll: res.damage, what: t(type ? 'cs.roll.damage' : 'cs.roll.damagePlain', { type }) })
    }
    const amount = (notation: string | undefined, what: string) => {
      if (!notation) return undefined
      const fixed = fixedAmount(notation)
      if (fixed !== undefined) return fixed
      const r = rolls.spell(spell.name, { damage: notation, damageType: what }).damage
      if (r) shown.push({ roll: r, what })
      return r?.total
    }
    const tempHp = amount(plan.tempHp, t('cast.tempHp'))
    const healed = amount(plan.heal, t('cs.roll.healing'))
    if (tempHp) notes.push(t('cast.gotTempHp', { n: tempHp }))
    if (healed) notes.push(t('cast.healed', { n: healed }))
    const ended = plan.effect ? startEffect(character, plan.effect).ended : []
    for (const name of ended) notes.push(t('cast.concEnded', { name }))
    if (plan.effect) notes.push(t('cast.inEffect'))

    const log = slot
      ? t(slot.source === 'pact' ? 'cs.log.castPact' : 'cs.log.cast', { name: spell.name, level: slot.level })
      : t('cast.log', { name: spell.name })
    apply(log, c => castSpell(c, plan, { slot, tempHp, heal: healed, spend: free?.spend }).character)
    const value: CastOut = { name: spell.name, rolls: shown, note: notes.join(' · ') || undefined, ...(healMe ? { healMe } : {}) }
    setOut(o => ({ key: (o?.key ?? 0) + 1, value }))
    return value
  }

  return { cast, out: out?.value ?? null, outKey: out?.key ?? 0, clear: () => setOut(null) }
}

/** The last cast's result, fading like the combat page's. Healing spells offer to heal the caster. */
export function CastResult({ out, outKey, onDone, character, apply }: { out: CastOut | null; outKey: number; onDone: () => void; character: Character; apply: Apply }) {
  const { t } = useI18n()
  const [healedKey, setHealedKey] = useState(-1)
  if (!out) return null
  return (
    <div className="sb-cast-out" key={outKey}>
      <strong>{out.name}</strong>
      <LastRoll rolls={out.rolls} note={out.note} onDone={onDone} />
      {out.healMe !== undefined && healedKey !== outKey && character.state.currentHp > 0 && (
        <button type="button" className="glass-btn small" onClick={() => {
          setHealedKey(outKey)
          apply(t('cast.log.healMe', { n: out.healMe!, name: out.name }), c => heal(c, out.healMe!))
        }}>
          {t('cast.healMe', { n: out.healMe })}
        </button>
      )}
    </div>
  )
}

/** Cast, plus ▾ to pick a higher slot when there is more than one to choose from. */
export function CastButton({ character, spell, onCast }: { character: Character; spell: Spell; onCast: (spell: Spell, slot?: SlotChoice) => void }) {
  const { t } = useI18n()
  const [picking, setPicking] = useState(false)
  const choices = slotChoices(character, spell.level)
  const levels = choices.length > 1
  const name = (s: SlotChoice) => `${t(`sheet.slot.${s.level}` as MessageKey)}${s.source === 'pact' ? ` ${t('cast.pact')}` : ''} · ${s.remaining}`
  return (
    <span className="sb-cast">
      <button type="button" className="glass-btn small prominent" aria-label={t('cast.castName', { name: spell.name })} onClick={() => { setPicking(false); onCast(spell) }}>
        {t('cast.cast')}
      </button>
      {levels && (
        <button type="button" className="glass-btn small icon" aria-expanded={picking} aria-label={t('cast.higher', { name: spell.name })} onClick={() => setPicking(p => !p)}>▾</button>
      )}
      {picking && (
        <span className="sb-cast-levels" role="group" aria-label={t('cast.higher', { name: spell.name })}>
          {choices.map(s => (
            <button key={`${s.source}-${s.level}`} type="button" className="glass-chip" onClick={() => { setPicking(false); onCast(spell, s) }}>{name(s)}</button>
          ))}
        </span>
      )}
    </span>
  )
}

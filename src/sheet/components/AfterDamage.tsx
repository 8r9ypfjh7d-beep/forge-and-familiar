// What taking damage calls for, right under the HP card's Damage button: the concentration save
// (one tap rolls it, a fail ends the spell), the damage a running Armor of Agathys deals back,
// reaction spells cast in answer to being hurt (Hellish Rebuke, Absorb Elements), and features that
// take the hit again for less: Uncanny Dodge, Deflect Attacks, and Relentless Endurance at 0 HP.
import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { DAMAGE_REACTION_SPELLS, derive, getResources, itemSpellCast, rulesEdition } from '../../rules'
import { CastButton, CastResult, useCast } from '../../spellbook/Cast'
import { itemSpellCaster } from '../../spellbook/Cast'
import { LastRoll, type Shown } from '../combat/LastRoll'
import { useSheetRolls } from '../dice'
import { concentration, endEffect } from '../effects'
import { damageToOne, retakeDamage, setResourceUsed, takeDamage, type HpSnapshot } from '../engine'
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
  /** The damage that got through resistances, and the HP before and after, so a reaction can take the hit again for less. */
  taken?: number
  critical?: boolean
  before?: HpSnapshot
  after?: { currentHp: number; tempHp: number; failures: number }
}

/** Deflect Attacks (2024) stops bludgeoning, piercing and slashing; an untyped hit might be any of them. */
const PHYSICAL = ['bludgeoning', 'piercing', 'slashing']

/** Absorb Elements only answers these. */
const ELEMENTS = ['acid', 'cold', 'fire', 'lightning', 'thunder']

const answers = (id: string, type?: string) => id !== 'absorb-elements' || !type || ELEMENTS.includes(type)

export function AfterDamage({ hit, character, apply, onClose }: { hit: Hit; character: Character; apply: Apply; onClose: () => void }) {
  const { t, term, spellName, sourceName } = useI18n()
  const rolls = useSheetRolls(character)
  const casting = useCast(character, apply)
  const spells = useSpells(character)
  const [save, setSave] = useState<{ key: number; shown: Shown[]; kept: boolean } | null>(null)
  // The hit as it stands after a reaction took it again: what got through, the HP after, what was used.
  const [retaken, setRetaken] = useState<{ taken: number; after: NonNullable<Hit['after']>; used: string[]; shown: Shown[]; said: string[] } | null>(null)
  const d = derive(character)
  const edition = rulesEdition(character)
  const taken = retaken?.taken ?? hit.taken ?? 0
  const after = retaken?.after ?? hit.after
  const used = retaken?.used ?? []
  // Reactions only while the sheet still shows this hit (nothing healed or hit since), and only if it landed on a conscious character.
  const fresh = !!hit.before && !!after && hit.before.currentHp > 0 && character.state.currentHp === after.currentHp && character.state.tempHp === after.tempHp
  const has = (name: string) => d.features.some(f => f.name === name)
  const monk = character.classes.find(c => c.classId === 'monk')?.level ?? 0
  const deflect = has('Deflect Attacks') ? 'Deflect Attacks' : has('Deflect Missiles') ? 'Deflect Missiles' : undefined
  const relentless = getResources(character).find(r => r.label === 'Relentless Endurance')
  const relentlessLeft = relentless ? relentless.max - (character.state.resources[relentless.id]?.used ?? 0) : 0
  // Relentless Endurance comes last: once it kept the character at 1 HP, nothing else takes the hit again.
  const defenses = fresh && taken > 0 && !used.includes('relentless') ? [
    ...(has('Uncanny Dodge') && !used.includes('dodge') ? ['dodge' as const] : []),
    ...(deflect && !used.includes('deflect') && (!hit.type || PHYSICAL.includes(hit.type)) ? ['deflect' as const] : []),
    ...(relentless && relentlessLeft > 0 && after!.currentHp === 0 && after!.failures < 3 && !used.includes('relentless') ? ['relentless' as const] : []),
  ] : []

  /** Takes the hit again from before it landed, for `amount`. */
  const retake = (what: string, amount: number, log: string, shown: Shown[] = [], said = '', spend?: string) => {
    if (!hit.before) return
    const next = takeDamage({ ...character, state: { ...character.state, ...hit.before } }, amount, { critical: hit.critical }).state
    apply(log, c => {
      const done = retakeDamage(c, hit.before!, amount, { critical: hit.critical })
      return spend ? setResourceUsed(done, spend, (c.state.resources[spend]?.used ?? 0) + 1) : done
    })
    setRetaken({
      taken: amount, after: { currentHp: next.currentHp, tempHp: next.tempHp, failures: next.deathSaves.failures },
      used: [...used, what], shown: [...(retaken?.shown ?? []), ...shown], said: [...(retaken?.said ?? []), ...(said ? [said] : [])],
    })
  }
  const dodge = () => {
    const n = Math.floor(taken / 2)
    retake('dodge', n, t('hurt.log.dodge', { n }), [], t('hurt.dodged', { n }))
  }
  const deflectDice = `1d10+${d.mods.dex + monk}`
  const doDeflect = () => {
    const roll = rolls.spell(deflect!, { damage: deflectDice }).damage
    if (!roll) return
    const n = Math.max(0, taken - roll.total)
    const said = [t('hurt.deflected', { by: roll.total, n }), n === 0 && edition === '2024' ? t('hurt.deflect.redirect') : ''].filter(Boolean).join(' · ')
    retake('deflect', n, t('hurt.log.deflect', { name: deflect!, n }), [{ roll, what: t('hurt.deflect.by') }], said)
  }
  const endure = () => {
    if (!hit.before || !relentless) return
    const n = Math.min(taken, damageToOne(hit.before))
    retake('relentless', n, t('hurt.log.relentless'), [], t('hurt.relentless.done'), relentless.id)
  }

  // Out cold: no saves to make (concentration already ended) and no spells to cast; only Relentless Endurance or a reaction that takes the hit again.
  if (character.state.currentHp === 0 && !defenses.length && !retaken) return null

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

  if (!conc && !saved && !hit.reprisals.length && !reactions.length && !innate.length && !casting.out && !defenses.length && !retaken) return null
  const up = character.state.currentHp > 0

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
      {defenses.includes('dodge') && (
        <div className="hp-after-row">
          <span>{t('hurt.reaction', { name: term('feature', 'Uncanny Dodge', 'Uncanny Dodge') })} <small className="hint">{t('hurt.dodge.what', { n: Math.floor(taken / 2) })}</small></span>
          <button type="button" className="glass-btn small prominent" onClick={dodge}>{t('hurt.dodge')}</button>
        </div>
      )}
      {defenses.includes('deflect') && (
        <div className="hp-after-row">
          <span>{t('hurt.reaction', { name: term('feature', deflect!, deflect!) })} <small className="hint">{t(edition === '2024' ? 'hurt.deflect.what' : 'hurt.deflect.what2014', { dice: deflectDice })}</small></span>
          <button type="button" className="glass-btn small prominent" onClick={doDeflect}>{t('hurt.deflect.roll', { dice: deflectDice })}</button>
        </div>
      )}
      {defenses.includes('relentless') && (
        <div className="hp-after-row">
          <span>{t('hurt.relentless', { name: term('feature', 'Relentless Endurance', 'Relentless Endurance') })} <small className="hint">{t('use.left', { n: relentlessLeft, max: relentless!.max })}</small></span>
          <button type="button" className="glass-btn small prominent" onClick={endure}>{t('hurt.relentless.use')}</button>
        </div>
      )}
      {retaken && (
        <>
          {retaken.shown.length > 0 && <LastRoll rolls={retaken.shown} />}
          {retaken.said.map(x => <p key={x} className="hp-after-outcome kept">{x}</p>)}
        </>
      )}
      {up && conc && !saved && (
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
      {up && hit.reprisals.map(r => (
        <p key={r.name} className="hp-after-row">
          {t('hurt.reprisal', { name: r.name, dice: r.damage, type: r.type ? ` ${term('damage', r.type, r.type)}` : '' })}
        </p>
      ))}
      {up && reactions.map(s => (
        <div key={s.id} className="hp-after-row">
          <span>{t('hurt.reaction', { name: s.name })}</span>
          <CastButton character={character} spell={s} onCast={casting.cast} />
        </div>
      ))}
      {up && innate.map(s => (
        <div key={`${s.source}:${s.spell}`} className="hp-after-row">
          <span>{t('hurt.reaction', { name: spellName(s.spell) })} <small className="hint">{sourceName(s.source)}</small></span>
          <button type="button" className="glass-btn small prominent" aria-label={t('cast.castName', { name: spellName(s.spell) })} onClick={() => caster.cast(s)}>{t('cast.cast')}</button>
        </div>
      ))}
      <CastResult out={casting.out} outKey={casting.outKey} onDone={casting.clear} character={character} apply={apply} />
    </div>
  )
}

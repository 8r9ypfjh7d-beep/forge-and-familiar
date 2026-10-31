// The stat block of a monster row inside the fight: one tap rolls an attack with its damage (or a save action's
// damage) and shows it with a target picker, so the hit lands on a party member or another monster in one more tap.
// Recharge and X/Day actions are tracked on the row (spent), legendary actions on a 3-pip counter.
import { useState } from 'react'
import type { Monster, MonsterAction } from '../../content'
import { roll, rollD20, type RollResult } from '../../dice'
import { RollView, useDice } from '../../dice/ui'
import { useI18n } from '../../i18n'
import { derive, formatMod } from '../../rules'
import { crLabel } from '../../monsters/format'
import type { Ability } from '../../rules'
import { addLog, critDice, legendaryCost, spendAction, rechargeAction, spendLegendary, type Party } from '../engine'
import type { Combatant, Encounter } from '../types'
import { legendaryCount } from '../../monsters/block'
import { applyDamage } from './apply'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()

interface Hit {
  action: string
  toHit?: RollResult
  damage: { roll: RollResult; type: string }[]
  save?: MonsterAction['save']
}

const total = (h: Hit) => h.damage.reduce((n, d) => n + d.roll.total, 0)

export function MonsterActions({ enc, combatant: c, monster: m, monsterOf, party, act, onClose }: {
  enc: Encounter
  combatant: Combatant
  monster: Monster
  /** Stat blocks of other rows, so damage on a monster target meets its defenses. */
  monsterOf?: (c: Combatant) => Monster | undefined
  party: Party
  act: Act
  onClose?: () => void
}) {
  const { t, term, abilityShort, locale, dir } = useI18n()
  const { record } = useDice()
  const [hit, setHit] = useState<Hit | null>(null)
  const [targetId, setTargetId] = useState('')
  const targets = enc.combatants.filter(x => x.id !== c.id)
  const target = targets.find(x => x.id === targetId)
  const targetPc = target?.characterId ? party[target.characterId] : undefined
  const targetAc = targetPc ? derive(targetPc).armorClass.value : target?.ac
  // An attack roll against the target's AC: a natural 20 always hits (dice already doubled), a natural 1 always misses.
  const verdict = (() => {
    const r = hit?.toHit
    if (!r || !target || targetAc === undefined) return null
    const crit = !!r.d20?.crit
    const fumble = !!r.d20?.fumble
    const hits = crit || (!fumble && r.total >= targetAc)
    const text = crit ? t('combat.critHit') : fumble ? t('combat.natOneMiss') : t(hits ? 'combat.hitVs' : 'combat.missVs', { total: r.total, ac: targetAc })
    return { hits, text }
  })()
  // Legendary actions per round from the block ("can take 2 legendary actions"); 3 when it does not say.
  const LEGENDARY_MAX = legendaryCount(m) || 3
  const legendaryLeft = LEGENDARY_MAX - (c.legendaryUsed ?? 0)

  const perform = (a: MonsterAction, group: 'action' | 'legendary') => {
    const action = { id: newId(), name: `${c.name}: ${a.name}` }
    const label = `${c.name}: ${a.name}`
    const h: Hit = { action: a.name, damage: [], save: a.save }
    if (a.attackBonus != null) h.toHit = record({ ...rollD20(a.attackBonus, { label }, 'attack'), action })
    const crit = !!h.toHit?.d20?.crit
    const dice = a.damage.length ? a.damage : a.damageChoice?.slice(0, 1) ?? []
    for (const d of dice) {
      try {
        const extra = crit ? critDice(d.dice) : null
        const r = record({ ...roll(extra ? `${d.dice}+${extra}` : d.dice, { label: `${label} (${d.type})` }, 'damage'), action, damageType: d.type })
        h.damage.push({ roll: r, type: d.type })
      } catch { /* not dice notation */ }
    }
    setHit(h.toHit || h.damage.length ? h : null)
    act(e => {
      let next = e
      if (group === 'legendary') next = spendLegendary(next, c.id, a.name, legendaryCost(a.name), LEGENDARY_MAX)
      else if (a.usage?.type === 'recharge' || a.usage?.type === 'per day') next = spendAction(next, c.id, a.name)
      if (h.toHit) next = addLog(next, 'combat.log.attackRoll', { name: c.name, action: a.name, total: h.toHit.total })
      if (h.damage.length) next = addLog(next, 'combat.log.damageRoll', { name: c.name, action: a.name, amount: total(h), type: h.damage.map(d => d.type).join(' + ') })
      return next
    })
  }

  // Each damage part keeps its type, so an NPC sheet's resistances and immunities apply to it.
  const apply = (half: boolean) => {
    if (!hit || !target) return
    const parts = hit.damage.map(d => ({ amount: half ? Math.floor(d.roll.total / 2) : d.roll.total, type: d.type }))
    act((e, p, remote, npcs) => applyDamage(e, p, remote, target.id, parts, newId(), npcs, target.npcId ? undefined : monsterOf?.(target)))
    setHit(null)
  }

  const recharge = (a: MonsterAction) => {
    if (a.usage?.type !== 'recharge') return
    const r = record(roll(a.usage.dice, { label: `${c.name}: ${a.name} recharge` }))
    const min = a.usage.minimum
    act(e => rechargeAction(e, c.id, a.name, r.total, min))
  }

  const canUse = (a: MonsterAction, group: 'action' | 'legendary') => {
    if (group === 'legendary') return legendaryLeft >= legendaryCost(a.name)
    if (a.usage?.type === 'recharge') return !c.spent?.[a.name]
    if (a.usage?.type === 'per day') return (c.spent?.[a.name] ?? 0) < a.usage.times
    return true
  }

  const usage = (a: MonsterAction) => {
    if (a.usage?.type === 'recharge') {
      const range = a.usage.dice === '1d6' ? `${a.usage.minimum}–6` : a.usage.dice
      return c.spent?.[a.name]
        ? <button type="button" className="glass-chip spent" onClick={() => recharge(a)}>{t('combat.spent')} · {t('combat.rollRecharge')}</button>
        : <span className="glass-chip">{t('combat.rechargeOn', { range })}</span>
    }
    if (a.usage?.type === 'per day') {
      const left = Math.max(0, a.usage.times - (c.spent?.[a.name] ?? 0))
      return <span className={`glass-chip${left ? '' : ' spent'}`}>{t('combat.usesLeft', { left, max: a.usage.times })}</span>
    }
    return null
  }

  const save = (s: MonsterAction['save']) => s && (
    <span className="glass-chip save">{t('combat.saveDc', { dc: s.dc, ability: abilityShort(s.ability as Ability) })}{s.onSuccess === 'half' ? ` · ${t('combat.halfOnSave')}` : ''}</span>
  )

  const rollable = (a: MonsterAction) => a.attackBonus != null || a.damage.length > 0 || !!a.damageChoice?.length

  const list = (title: string, items: MonsterAction[], group: 'action' | 'legendary') => items.length > 0 && (
    <div className="sb-group">
      <h4 className="glass-eyebrow">
        {title}
        {group === 'legendary' && (
          <span className="pips" aria-label={t('combat.legendaryLeft', { left: legendaryLeft, max: LEGENDARY_MAX })} title={t('combat.legendaryLeft', { left: legendaryLeft, max: LEGENDARY_MAX })}>
            {Array.from({ length: LEGENDARY_MAX }, (_, i) => <i key={i} className={i < legendaryLeft ? 'on' : ''} />)}
          </span>
        )}
      </h4>
      <ul className="plain sb-actions">
        {items.map((a, i) => (
          <li key={i}>
            <div className="sb-line">
              {(rollable(a) || group === 'legendary' || a.usage) ? (
                <button type="button" className="glass-btn small act" disabled={!canUse(a, group)} onClick={() => perform(a, group)}>
                  <b>{a.name}</b>{a.attackBonus != null && <span className="muted"> {formatMod(a.attackBonus)}</span>}
                </button>
              ) : <b className="sb-name">{a.name}.</b>}
              {usage(a)}
              {save(a.save)}
              {[...a.damage, ...(a.damageChoice ?? [])].map((d, j) => <span key={j} className="glass-chip dmg" dir="ltr">{d.dice} {d.type}</span>)}
            </div>
            <p className="small sb-desc">{a.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <section className="statblock glass thick" lang="en" dir="ltr" aria-label={t('combat.statBlock')}>
      <div className="sb-head">
        <div>
          <strong>{m.name}</strong>
          <span className="muted small" lang={locale} dir={dir}> · {m.sizes.map(x => term('size', x, x)).join(' / ')} {term('creature', m.type, m.type)}{m.subtype ? ` (${m.subtype})` : ''} · {t('dm.cr', { cr: crLabel(m.challengeRating) })} · {t('stat.ac')} {m.armorClass[0]?.value}</span>
        </div>
        {onClose && <button type="button" className="icon" onClick={onClose} aria-label={t('combat.hideBlock')}>✕</button>}
      </div>
      <label className="sb-target">
        <span>{t('combat.target')}</span>
        <select value={targetId} onChange={ev => setTargetId(ev.target.value)}>
          <option value="">—</option>
          {targets.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      {hit && (
        <div className="sb-result" aria-live="polite">
          <div className="sb-rolls">
            {hit.toHit && <RollView roll={hit.toHit} compact />}
            {hit.damage.map((d, i) => <RollView key={i} roll={d.roll} compact />)}
          </div>
          {verdict && <p className={`sb-verdict ${verdict.hits ? 'hit' : 'miss'}`} lang={locale} dir={dir}><strong>{verdict.text}</strong></p>}
          {hit.damage.length > 0 && (
            <div className="row sb-apply" lang={locale} dir={dir}>
              <button type="button" className={`glass-btn small ${verdict && !verdict.hits ? 'plain' : 'danger'}`} disabled={!target} title={target ? undefined : t('combat.noTarget')} onClick={() => apply(false)}>
                {!target ? t('combat.noTarget')
                  : verdict && !verdict.hits ? t('combat.applyAnyway', { amount: total(hit), name: target.name })
                    : t('combat.applyTo', { amount: total(hit), name: target.name })}
              </button>
              {hit.save?.onSuccess === 'half' && (
                <button type="button" className="glass-btn small" disabled={!target} onClick={() => apply(true)}>
                  {t('combat.applyTo', { amount: Math.floor(total(hit) / 2), name: target?.name ?? '' })} · ½
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {m.traits.length > 0 && (
        <details className="sb-traits">
          <summary className="glass-eyebrow">{t('dm.traits')}</summary>
          <ul className="plain sb-actions">{m.traits.map((a, i) => <li key={i}><div className="sb-line"><b className="sb-name">{a.name}.</b>{usage(a)}{save(a.save)}</div><p className="small sb-desc">{a.description}</p></li>)}</ul>
        </details>
      )}
      {list(t('dm.actions'), m.actions, 'action')}
      {list(t('dm.bonusActions'), m.bonusActions, 'action')}
      {list(t('dm.reactions'), m.reactions, 'action')}
      {list(t('dm.legendary'), m.legendaryActions, 'legendary')}
    </section>
  )
}

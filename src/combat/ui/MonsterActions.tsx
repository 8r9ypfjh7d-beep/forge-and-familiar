// The stat block of a monster row inside the fight: one tap rolls an attack with its damage (or a save action's
// damage, or every attack of a Multiattack) against the picked target, and a hit lands on it right away
// (the DM's applyHits switch; otherwise one more tap). The target opens on the first conscious enemy.
// Recharge and X/Day actions are tracked on the row (spent), legendary actions on a 3-pip counter.
import { useState } from 'react'
import type { Monster, MonsterAction } from '../../content'
import { roll, rollD20, rollSave, type RollResult } from '../../dice'
import { RollView, useDice } from '../../dice/ui'
import { useI18n } from '../../i18n'
import { derive, formatMod } from '../../rules'
import { crLabel } from '../../monsters/format'
import type { Ability } from '../../rules'
import { addLog, critDice, legendaryCost, spendAction, rechargeAction, spendLegendary, statusOf, targetGroups, type Party } from '../engine'
import { attackAgainst, autoFails, DEFAULT_AUTO, isDeadPc, isMelee, monsterSave, multiattackPlan, pickTarget, rowHp, standing, targetConditions, type AutoSettings } from '../auto'
import { getRollMode } from '../../rules/rollMode'
import type { Character } from '../../model/character'
import type { NpcSheets } from '../npcRows'
import type { Combatant, Encounter } from '../types'
import { legendaryCount } from '../../monsters/block'
import { rowName } from '../names'
import { applyDamage, chain } from './apply'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()

interface Hit {
  action: string
  toHit?: RollResult
  damage: { roll: RollResult; type: string }[]
  save?: MonsterAction['save']
  /** A critical hit: a natural 20, or a melee hit on a paralyzed or unconscious target. */
  crit: boolean
  /** The target when it was rolled, and whether it hit that target's AC (undefined: no target or AC to compare). */
  targetId?: string
  hits?: boolean
  /** The target's own save against a save action, rolled for it. */
  saveRoll?: { roll: RollResult; saved: boolean }
  /** What landed, once applied. */
  applied?: { amount: number; targetId: string }
}

/** Each monster row's last target, for this page visit. */
const lastTarget = new Map<string, string>()

const total = (h: Hit) => h.damage.reduce((n, d) => n + d.roll.total, 0)
/** What a save action deals after the target's save: full on a failure, half or nothing on a success. */
const afterSave = (h: Hit) => (!h.saveRoll || !h.saveRoll.saved ? total(h) : h.save?.onSuccess === 'half' ? Math.floor(total(h) / 2) : 0)

export function MonsterActions({ enc, combatant: c, monster: m, monsterOf, party, act, onClose, auto = DEFAULT_AUTO }: {
  enc: Encounter
  combatant: Combatant
  monster: Monster
  /** Stat blocks of other rows, so damage on a monster target meets its defenses. */
  monsterOf?: (c: Combatant) => Monster | undefined
  party: Party
  act: Act
  onClose?: () => void
  /** The DM's automation switches: with applyHits on, a hit lands on the target without another tap. */
  auto?: AutoSettings
}) {
  const { t, term, abilityShort, locale, dir, monsterName } = useI18n()
  const shown = (x: Combatant) => { const xm = monsterOf?.(x); return rowName(x, xm?.name, xm && monsterName(xm)) }
  const subtype = m.subtype?.split(/,\s*/).map(x => term('subtype', x, x)).join(', ')
  const { record: shared } = useDice()
  const record = (r: RollResult) => shared(r, { quiet: true })
  const [hits, setHits] = useState<Hit[]>([])
  const groups = targetGroups(enc, c.id)
  const hp = rowHp(enc, party)
  // Fallen monsters and dead party members drop out of the list.
  const alive = (x: Combatant) => standing(x, party, hp)
  const enemies = groups.enemies.filter(alive)
  const allies = groups.allies.filter(alive)
  const targets = [...enemies, ...allies]
  // Opens on the last target while it stands, else the first conscious enemy.
  const [picked, setPicked] = useState(() => pickTarget(enc, c.id, party, lastTarget.get(c.id), hp))
  const setTargetId = (id: string) => { lastTarget.set(c.id, id); setPicked(id) }
  // The pick fell (dropped to 0 or died): move on to the next one standing.
  const targetId = targets.some(x => x.id === picked) ? picked : picked === '' ? '' : pickTarget(enc, c.id, party, undefined, hp)
  const target = targets.find(x => x.id === targetId)
  const acOf = (x: Combatant | undefined) => {
    const pc = x?.characterId ? party[x.characterId] : undefined
    return pc ? derive(pc).armorClass.value : x?.ac
  }
  const byId = (id?: string) => enc.combatants.find(x => x.id === id)
  // An attack roll against the target's AC: a natural 20 always hits, a natural 1 always misses.
  const judge = (r: RollResult, ac: number | undefined) => (ac === undefined ? undefined : !!r.d20?.crit || (!r.d20?.fumble && r.total >= ac))
  const verdictOf = (h: Hit) => {
    const r = h.toHit
    const who = byId(h.targetId) ?? target
    const ac = acOf(who)
    if (!r || !who || ac === undefined) return null
    const hit = h.targetId ? h.hits ?? false : judge(r, ac)!
    const text = r.d20?.crit ? t('combat.critHit') : r.d20?.fumble ? t('combat.natOneMiss')
      : h.crit ? t('combat.autoCrit', { total: r.total, ac }) : t(hit ? 'combat.hitVs' : 'combat.missVs', { total: r.total, ac })
    return { hits: hit, text }
  }
  // Legendary actions per round from the block ("can take 2 legendary actions"); 3 when it does not say.
  const LEGENDARY_MAX = legendaryCount(m) || 3
  const legendaryLeft = LEGENDARY_MAX - (c.legendaryUsed ?? 0)
  const multi = multiattackPlan(m)

  /** Rolls one action against the current target: to hit with the target's conditions, then damage (doubled on a critical). */
  const rollAction = (a: MonsterAction, aim: Combatant | undefined): Hit => {
    const action = { id: newId(), name: `${c.name}: ${a.name}` }
    const label = `${c.name}: ${a.name}`
    const h: Hit = { action: a.name, damage: [], save: a.save, crit: false, targetId: aim?.id }
    const melee = isMelee(a)
    const against = aim ? attackAgainst(targetConditions(enc, aim, party), melee) : { mode: [], autoCrit: false }
    if (a.attackBonus != null) {
      const own = getRollMode({ state: { conditions: statusOf(enc, c, party).conditions } } as Pick<Character, 'state'>, 'attack')
      h.toHit = record({ ...rollD20(a.attackBonus, { label, mode: [own, ...against.mode] }, 'attack'), action })
      h.hits = judge(h.toHit, acOf(aim))
      h.crit = !!h.toHit.d20?.crit || (!!h.hits && against.autoCrit)
    }
    const dice = a.damage.length ? a.damage : a.damageChoice?.slice(0, 1) ?? []
    for (const d of dice) {
      try {
        const extra = h.crit ? critDice(d.dice) : null
        const r = record({ ...roll(extra ? `${d.dice}+${extra}` : d.dice, { label: `${label} (${d.type})` }, 'damage'), action, damageType: d.type })
        h.damage.push({ roll: r, type: d.type })
      } catch { /* not dice notation */ }
    }
    // A save action against a monster rolls the monster's save; a party member's waits for the table.
    if (a.attackBonus == null && a.save && aim?.kind === 'npc' && auto.applyHits && h.damage.length) h.saveRoll = rollTargetSave(aim, a.save.ability as Ability, a.save.dc, label)
    return h
  }

  /** A target's save against a monster's DC: a stat block's save bonus, a party member's sheet. */
  function rollTargetSave(x: Combatant, ability: Ability, dc: number, label: string) {
    const ch = x.characterId ? party[x.characterId] : undefined
    const what = `${label}: ${abilityShort(ability)} ${t('combat.saveWord')}`
    const xm = monsterOf?.(x)
    const r = ch
      ? record(rollSave(derive(ch), ability, { character: ch, label: what }))
      : record(rollD20(xm ? monsterSave(xm, ability) : ability === 'con' ? x.conSave ?? 0 : 0, { label: what, roller: { characterId: x.id, characterName: x.name } }, 'save'))
    const fails = autoFails(targetConditions(enc, x, party), ability)
    return { roll: r, saved: !fails && r.total >= dc }
  }

  /** Lands each hit that should land: hits on their target, save actions after the target's save. One undo step. */
  const land = (list: Hit[], group: 'action' | 'legendary', used: MonsterAction) => {
    const out = list.map(h => ({ ...h }))
    act((e, p, remote, npcs) => chain(e, p, npcs, [
      x => {
        let next = x
        if (group === 'legendary') next = spendLegendary(next, c.id, used.name, legendaryCost(used.name), LEGENDARY_MAX)
        else if (used.usage?.type === 'recharge' || used.usage?.type === 'per day') next = spendAction(next, c.id, used.name)
        for (const h of out) {
          if (h.toHit) next = addLog(next, 'combat.log.attackRoll', { name: c.name, action: h.action, total: h.toHit.total })
          if (h.damage.length) next = addLog(next, 'combat.log.damageRoll', { name: c.name, action: h.action, amount: total(h), type: h.damage.map(d => d.type).join(' + ') })
          if (h.saveRoll) next = addLog(next, h.saveRoll.saved ? 'combat.log.savePasses' : 'combat.log.saveFailsDc', { name: byId(h.targetId)?.name ?? '?', total: h.saveRoll.roll.total, dc: h.save?.dc ?? 0 })
        }
        return next
      },
      ...out.map(h => (x: Encounter, pp: Party, nn: NpcSheets) => {
        const aim = x.combatants.find(y => y.id === h.targetId)
        if (!auto.applyHits || !aim || !h.damage.length) return x
        const sheetHp = aim.npcId ? nn[aim.npcId]?.state.currentHp : undefined
        const up = aim.kind === 'npc' ? (sheetHp ?? aim.hp?.current ?? 1) > 0 : !isDeadPc(aim, pp)
        const lands = h.toHit ? h.hits === true : !!h.saveRoll
        if (!up || !lands) return x
        const amount = h.toHit ? total(h) : afterSave(h)
        if (amount <= 0) { h.applied = { amount: 0, targetId: aim.id }; return x }
        h.applied = { amount, targetId: aim.id }
        const scale = amount / total(h)
        const parts = h.damage.map(d => ({ amount: scale === 1 ? d.roll.total : Math.floor(d.roll.total * scale), type: d.type }))
        return applyDamage(x, pp, remote, aim.id, parts, newId(), nn, aim.npcId ? undefined : monsterOf?.(aim), h.crit)
      }),
    ]))
    setHits(out)
  }

  const perform = (a: MonsterAction, group: 'action' | 'legendary') => {
    // Multiattack rolls every attack it names against the target.
    if (/^multiattack/i.test(a.name) && multi) {
      const list = multi.map(name => m.actions.find(x => x.name === name)).filter((x): x is MonsterAction => !!x).map(x => rollAction(x, target))
      return land(list, group, a)
    }
    const h = rollAction(a, target)
    land(h.toHit || h.damage.length ? [h] : [], group, a)
  }

  // Each damage part keeps its type, so an NPC sheet's resistances and immunities apply to it.
  const apply = (i: number, half: boolean) => {
    const hit = hits[i]
    if (!hit || !target) return
    const parts = hit.damage.map(d => ({ amount: half ? Math.floor(d.roll.total / 2) : d.roll.total, type: d.type }))
    act((e, p, remote, npcs) => applyDamage(e, p, remote, target.id, parts, newId(), npcs, target.npcId ? undefined : monsterOf?.(target), hit.crit))
    setHits(hits.map((h, j) => (j === i ? { ...h, applied: { amount: parts.reduce((n, x) => n + x.amount, 0), targetId: target.id } } : h)))
  }

  /** A party member's save against a save action, rolled from their sheet, then the damage lands. */
  const rollSaveFor = (i: number) => {
    const hit = hits[i]
    if (!hit?.save || !target) return
    const saveRoll = rollTargetSave(target, hit.save.ability as Ability, hit.save.dc, `${c.name}: ${hit.action}`)
    const h = { ...hit, saveRoll, targetId: target.id }
    const amount = afterSave(h)
    const parts = h.damage.map(d => ({ amount: amount === total(h) ? d.roll.total : Math.floor(d.roll.total / 2), type: d.type }))
    act((e, p, remote, npcs) => chain(e, p, npcs, [
      x => addLog(x, saveRoll.saved ? 'combat.log.savePasses' : 'combat.log.saveFailsDc', { name: target.name, total: saveRoll.roll.total, dc: hit.save!.dc }),
      (x, pp, nn) => (amount > 0 ? applyDamage(x, pp, remote, target.id, parts, newId(), nn, target.npcId ? undefined : monsterOf?.(target)) : x),
    ]))
    setHits(hits.map((x, j) => (j === i ? { ...h, applied: { amount, targetId: target.id } } : x)))
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

  const rollable = (a: MonsterAction) => a.attackBonus != null || a.damage.length > 0 || !!a.damageChoice?.length || (!!multi && /^multiattack/i.test(a.name))

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
              {[...a.damage, ...(a.damageChoice ?? [])].map((d, j) => <span key={j} className="glass-chip dmg" lang={locale} dir={dir}><bdi dir="ltr">{d.dice}</bdi> {term('damage', d.type, d.type)}</span>)}
            </div>
            <p className="small sb-desc">{a.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <section className="statblock glass thick" lang="en" dir="ltr" aria-label={t('combat.statBlock')}>
      <div className="sb-head" lang={locale} dir={dir}>
        <div>
          <strong><bdi>{monsterName(m)}</bdi></strong>
          <span className="muted small"> · {m.sizes.map(x => term('size', x, x)).join(' / ')} {term('creature', m.type, m.type)}{subtype ? ` (${subtype})` : ''} · {t('dm.cr', { cr: crLabel(m.challengeRating) })} · {t('stat.ac')} {m.armorClass[0]?.value}</span>
        </div>
        {onClose && <button type="button" className="icon" onClick={onClose} aria-label={t('combat.hideBlock')}>✕</button>}
      </div>
      <label className="sb-target">
        <span>{t('combat.target')}</span>
        <select value={targetId} onChange={ev => setTargetId(ev.target.value)}>
          <option value="">—</option>
          {enemies.length > 0 && <optgroup label={t('combat.enemies')}>{enemies.map(x => <option key={x.id} value={x.id}>{shown(x)}</option>)}</optgroup>}
          {allies.length > 0 && <optgroup label={t('combat.allies')}>{allies.map(x => <option key={x.id} value={x.id}>{shown(x)}</option>)}</optgroup>}
        </select>
      </label>
      {hits.length > 0 && (
        <div className="sb-result" aria-live="polite">
          {hits.map((h, i) => {
            const verdict = verdictOf(h)
            const landed = h.applied && byId(h.applied.targetId)
            return (
              <div key={i} className="sb-hit">
                {hits.length > 1 && <p className="small sb-hit-name"><b>{h.action}</b></p>}
                <div className="sb-rolls">
                  {h.toHit && <RollView roll={h.toHit} compact />}
                  {h.damage.map((d, j) => <RollView key={j} roll={d.roll} compact />)}
                  {h.saveRoll && <RollView roll={h.saveRoll.roll} compact />}
                </div>
                {verdict && <p className={`sb-verdict ${verdict.hits ? 'hit' : 'miss'}`} lang={locale} dir={dir}><strong>{verdict.text}</strong></p>}
                {h.saveRoll && (
                  <p className={`sb-verdict ${h.saveRoll.saved ? 'miss' : 'hit'}`} lang={locale} dir={dir}>
                    <strong>{t(h.saveRoll.saved ? 'combat.targetSaved' : 'combat.targetFailed', { name: shown(byId(h.targetId) ?? c), total: h.saveRoll.roll.total, dc: h.save?.dc ?? 0 })}</strong>
                  </p>
                )}
                {landed ? (
                  <p className="sb-applied" lang={locale} dir={dir}>✓ {h.applied!.amount > 0 ? t('combat.appliedTo', { amount: h.applied!.amount, name: shown(landed) }) : t('combat.noDamage', { name: shown(landed) })}</p>
                ) : h.damage.length > 0 && (
                  <div className="row sb-apply" lang={locale} dir={dir}>
                    {h.save && !h.toHit && target?.kind === 'pc' && (
                      <button type="button" className="glass-btn small prominent" onClick={() => rollSaveFor(i)}>{t('combat.rollSaveFor', { name: shown(target), ability: abilityShort(h.save.ability as Ability) })}</button>
                    )}
                    <button type="button" className={`glass-btn small ${verdict && !verdict.hits ? 'plain' : 'danger'}`} disabled={!target} title={target ? undefined : t('combat.noTarget')} onClick={() => apply(i, false)}>
                      {!target ? t('combat.noTarget')
                        : verdict && !verdict.hits ? t('combat.applyAnyway', { amount: total(h), name: shown(target) })
                          : t('combat.applyTo', { amount: total(h), name: shown(target) })}
                    </button>
                    {h.save?.onSuccess === 'half' && (
                      <button type="button" className="glass-btn small" disabled={!target} onClick={() => apply(i, true)}>
                        {t('combat.applyTo', { amount: Math.floor(total(h) / 2), name: target ? shown(target) : '' })} · ½
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
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

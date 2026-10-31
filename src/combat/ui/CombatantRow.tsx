import { useState } from 'react'
import type { Monster } from '../../content'
import { rollDeathSave as rollDeathSaveDice } from '../../dice'
import { useDice } from '../../dice/ui'
import { useI18n } from '../../i18n'
import { derive } from '../../rules'
import type { ConditionId } from '../../rules/types'
import { effectiveMaxHp, rollDeathSave, vitals } from '../../sheet/engine'
import {
  addLog, concentrationOf, dropConcentration, effectConditions, isBloodied, isDefeated, moveCombatant,
  removeCombatant, setInitiative, statusOf, updateCombatant, type Party,
} from '../engine'
import { CONDITIONS, type Combatant, type Encounter } from '../types'
import { applyDamage, applyHeal } from './apply'
import { MonsterActions } from './MonsterActions'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()

export function CombatantRow({ enc, combatant: c, party, remote, monster, act, first, last }: {
  enc: Encounter
  combatant: Combatant
  party: Party
  /** Character ids that live on players' phones (read-only here). */
  remote: ReadonlySet<string>
  /** The row's stat block, when it came from the library. */
  monster?: Monster
  act: Act
  first: boolean
  last: boolean
}) {
  const { record } = useDice()
  const { t, term } = useI18n()
  const rounds = (n: number | null) => (n === null ? '∞' : t('combat.rounds', { count: n }))
  const cond = (x: ConditionId) => term('condition', x, x)
  const [amount, setAmount] = useState('')
  const [block, setBlock] = useState<boolean | null>(null)
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const isRemote = !!c.characterId && remote.has(c.characterId)
  const ch = c.characterId ? party[c.characterId] : undefined
  const status = statusOf(enc, c, party)
  const fromEffects = effectConditions(enc, c.id)
  const held = concentrationOf(enc, c.id)
  const on = enc.effects.filter(e => e.targetIds.includes(c.id))
  const active = enc.activeId === c.id
  const life = ch ? vitals(ch) : isDefeated(c) ? 'dead' : 'healthy'

  const hp = ch
    ? { current: ch.state.currentHp, max: effectiveMaxHp(ch), temp: ch.state.tempHp }
    : c.hp ?? { current: 0, max: 0, temp: 0 }
  const ac = ch ? derive(ch).armorClass.value : c.ac
  const pct = hp.max ? (hp.current / hp.max) * 100 : 0

  const idx = enc.combatants.findIndex(x => x.id === c.id)
  const tiedAbove = !first && enc.combatants[idx - 1].initiative === c.initiative
  const tiedBelow = !last && enc.combatants[idx + 1].initiative === c.initiative

  const damage = () => act((e, p, r) => applyDamage(e, p, r, c.id, n, newId()))
  const healUp = () => act((e, p, r) => applyHeal(e, p, r, c.id, n))
  const deathSave = () => act((e, p) => {
    const pc = c.characterId ? p[c.characterId] : undefined
    if (!pc) return e
    const r = record(rollDeathSaveDice({ character: pc }))
    return { encounter: addLog(e, 'combat.log.deathSave', { name: c.name, total: r.total }), characters: [rollDeathSave(pc, r.d20?.natural ?? 10)] }
  })

  const setConditions = (next: ConditionId[]) => act((e, p) => {
    const pc = c.characterId ? p[c.characterId] : undefined
    if (c.kind === 'npc') return updateCombatant(e, c.id, { conditions: next })
    if (!pc) return e
    return { encounter: e, characters: [{ ...pc, state: { ...pc.state, conditions: next } }] }
  })
  const own = c.kind === 'pc' ? status.conditions : c.conditions
  // The stat block unfolds by itself on the monster's turn; the DM can open or close it any time.
  const showBlock = !!monster && c.kind === 'npc' && life !== 'dead' && (block ?? active)

  return (
    <li className={`combatant glass${active ? ' active' : ''}${life === 'dead' ? ' out' : ''}${showBlock ? ' unfolded' : ''}`} aria-current={active ? 'true' : undefined}>
      <div className="init">
        <label className="sr-only" htmlFor={`init-${c.id}`}>{t('combat.initFor', { name: c.name })}</label>
        <input id={`init-${c.id}`} inputMode="numeric" value={c.initiative ?? ''} placeholder="–"
          onChange={ev => {
            const v = ev.target.value.replace(/[^\d-]/g, '')
            act(e => setInitiative(e, c.id, v === '' || v === '-' ? null : Number(v)))
          }} />
        {(tiedAbove || tiedBelow) && (
          <span className="tie">
            <button className="icon" disabled={!tiedAbove} onClick={() => act(e => moveCombatant(e, c.id, -1))} aria-label={t('combat.moveUp', { name: c.name })}>▲</button>
            <button className="icon" disabled={!tiedBelow} onClick={() => act(e => moveCombatant(e, c.id, 1))} aria-label={t('combat.moveDown', { name: c.name })}>▼</button>
          </span>
        )}
      </div>

      <div className="who">
        <div className="name-line">
          <strong>{c.name}</strong>
          {c.kind === 'pc' && <span className="tag">{t('combat.partyTag')}</span>}
          {ac !== undefined && <span className="tag" title={t('combat.acTitle')}>{t('stat.ac')} {ac}</span>}
          {life === 'dying' && <span className="tag bad">{t('combat.dying')}</span>}
          {life === 'stable' && <span className="tag">{t('combat.stable')}</span>}
          {life === 'dead' && <span className="tag bad">{c.kind === 'pc' ? t('combat.dead') : t('combat.down')}</span>}
          {c.kind === 'npc' && isBloodied(c.hp) && <span className="tag bad">{t('combat.bloodied')}</span>}
          {isRemote && <span className="tag" title={t('combat.remoteHint', { name: c.name })}>{t('combat.remoteTag')}</span>}
          {monster && c.kind === 'npc' && (
            <button type="button" className="tag tag-btn" aria-expanded={showBlock} onClick={() => setBlock(!showBlock)}>{showBlock ? t('combat.hideBlock') : t('combat.statBlock')}</button>
          )}
        </div>
        <div className="hp-line">
          <div className="hpbar" aria-hidden="true"><div className={pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''} style={{ width: `${pct}%` }} /></div>
          <span className="small"><span dir="ltr">{hp.current}/{hp.max}{hp.temp ? ` +${hp.temp}` : ''}</span> {t('stat.hp')}</span>
        </div>
        {(held || on.length > 0 || status.conditions.length > 0) && (
          <div className="chips">
            {held && (
              <button className="glass-chip conc" onClick={() => act(e => dropConcentration(e, c.id))}
                title={t('combat.concTitle')}>◎ <bdi>{held.name}</bdi> · <bdi>{rounds(held.remaining)}</bdi> ✕</button>
            )}
            {on.map(e => <span key={e.id} className="glass-chip fx" title={e.sourceId ? t('combat.from', { name: enc.combatants.find(x => x.id === e.sourceId)?.name ?? '' }) : undefined}><bdi>{e.name}</bdi> · <bdi>{rounds(e.remaining)}</bdi></span>)}
            {status.conditions.filter(x => !(c.kind === 'npc' && !c.conditions.includes(x))).map(x => (
              <button key={x} className="glass-chip cond" onClick={() => setConditions(own.filter(y => y !== x))} title={t('common.remove')}>{cond(x)} ✕</button>
            ))}
            {c.kind === 'npc' && fromEffects.filter(x => !c.conditions.includes(x)).map(x => (
              <span key={x} className="glass-chip cond" title={t('combat.fromEffect')}>{cond(x)}</span>
            ))}
          </div>
        )}
      </div>

      <div className="controls">
        <input aria-label={t('combat.amountFor', { name: c.name })} inputMode="numeric" placeholder="0" value={amount}
          onChange={ev => setAmount(ev.target.value.replace(/\D/g, ''))}
          onKeyDown={ev => { if (ev.key === 'Enter' && n) { damage(); setAmount('') } }} />
        <button className="glass-btn small danger" disabled={!n || life === 'dead'} onClick={() => { damage(); setAmount('') }}>{t('combat.dmg')}</button>
        <button className="glass-btn small heal" disabled={!n || (c.kind === 'pc' && life === 'dead')} onClick={() => { healUp(); setAmount('') }}>{t('combat.heal')}</button>
        <select aria-label={t('combat.addConditionTo', { name: c.name })} value="" onChange={ev => setConditions([...own, ev.target.value as ConditionId])}>
          <option value="">{t('combat.addCondition')}</option>
          {CONDITIONS.filter(x => !own.includes(x)).map(x => <option key={x} value={x}>{cond(x)}</option>)}
        </select>
        {active && life === 'dying' && <button className="glass-btn small prominent" onClick={deathSave}>{t('combat.deathSave')}</button>}
        <button className="icon" onClick={() => confirm(t('combat.removeConfirm', { name: c.name })) && act(e => removeCombatant(e, c.id))} aria-label={t('combat.removeName', { name: c.name })}>✕</button>
      </div>
      {showBlock && monster && (
        <div className="block-slot">
          <MonsterActions enc={enc} combatant={c} monster={monster} party={party} act={act} onClose={() => setBlock(false)} />
        </div>
      )}
    </li>
  )
}

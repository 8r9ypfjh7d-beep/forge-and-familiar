import { useState } from 'react'
import { rollDeathSave as rollDeathSaveDice } from '../../dice'
import { useDice } from '../../dice/ui'
import { derive } from '../../rules'
import type { ConditionId } from '../../rules/types'
import { effectiveMaxHp, heal, rollDeathSave, takeDamage, vitals } from '../../sheet/engine'
import {
  addLog, concentrationOf, damageNpc, effectConditions, endEffect, healNpc, isDefeated, moveCombatant,
  noteDamage, removeCombatant, setInitiative, statusOf, updateCombatant, type Party,
} from '../engine'
import { CONDITIONS, type Combatant, type Encounter } from '../types'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()
const rounds = (n: number | null) => (n === null ? '∞' : `${n} rd${n === 1 ? '' : 's'}`)

export function CombatantRow({ enc, combatant: c, party, act, first, last }: {
  enc: Encounter
  combatant: Combatant
  party: Party
  act: Act
  first: boolean
  last: boolean
}) {
  const { record } = useDice()
  const [amount, setAmount] = useState('')
  const n = Math.max(0, Math.floor(Number(amount) || 0))
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

  const damage = () => act((e, p) => {
    const pc = c.characterId ? p[c.characterId] : undefined
    if (c.kind === 'npc') return damageNpc(e, c.id, n, newId())
    if (!pc) return e
    return { encounter: noteDamage(addLog(e, `${c.name} takes ${n}`), c.id, n, newId()), characters: [takeDamage(pc, n)] }
  })
  const healUp = () => act((e, p) => {
    const pc = c.characterId ? p[c.characterId] : undefined
    if (c.kind === 'npc') return healNpc(e, c.id, n)
    if (!pc) return e
    return { encounter: addLog(e, `${c.name} heals ${n}`), characters: [heal(pc, n)] }
  })
  const deathSave = () => act((e, p) => {
    const pc = c.characterId ? p[c.characterId] : undefined
    if (!pc) return e
    const r = record(rollDeathSaveDice({ character: pc }))
    return { encounter: addLog(e, `${c.name} death save: ${r.total}`), characters: [rollDeathSave(pc, r.d20?.natural ?? 10)] }
  })

  const setConditions = (next: ConditionId[]) => act((e, p) => {
    const pc = c.characterId ? p[c.characterId] : undefined
    if (c.kind === 'npc') return updateCombatant(e, c.id, { conditions: next })
    if (!pc) return e
    return { encounter: e, characters: [{ ...pc, state: { ...pc.state, conditions: next } }] }
  })
  const own = c.kind === 'pc' ? status.conditions : c.conditions

  return (
    <li className={`combatant panel${active ? ' active' : ''}${life === 'dead' ? ' out' : ''}`} aria-current={active ? 'true' : undefined}>
      <div className="init">
        <label className="sr-only" htmlFor={`init-${c.id}`}>Initiative for {c.name}</label>
        <input id={`init-${c.id}`} inputMode="numeric" value={c.initiative ?? ''} placeholder="–"
          onChange={ev => {
            const v = ev.target.value.replace(/[^\d-]/g, '')
            act(e => setInitiative(e, c.id, v === '' || v === '-' ? null : Number(v)))
          }} />
        {(tiedAbove || tiedBelow) && (
          <span className="tie">
            <button className="icon" disabled={!tiedAbove} onClick={() => act(e => moveCombatant(e, c.id, -1))} aria-label={`Move ${c.name} up`}>▲</button>
            <button className="icon" disabled={!tiedBelow} onClick={() => act(e => moveCombatant(e, c.id, 1))} aria-label={`Move ${c.name} down`}>▼</button>
          </span>
        )}
      </div>

      <div className="who">
        <div className="name-line">
          <strong>{c.name}</strong>
          {c.kind === 'pc' && <span className="tag">Party</span>}
          {ac !== undefined && <span className="tag" title="Armor class">AC {ac}</span>}
          {life === 'dying' && <span className="tag bad">Dying</span>}
          {life === 'stable' && <span className="tag">Stable</span>}
          {life === 'dead' && <span className="tag bad">{c.kind === 'pc' ? 'Dead' : 'Down'}</span>}
        </div>
        <div className="hp-line">
          <div className="hpbar" aria-hidden="true"><div className={pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''} style={{ width: `${pct}%` }} /></div>
          <span className="small">{hp.current}/{hp.max}{hp.temp ? ` +${hp.temp}` : ''} HP</span>
        </div>
        {(held || on.length > 0 || status.conditions.length > 0) && (
          <div className="chips">
            {held && (
              <button className="chip conc" onClick={() => act(e => endEffect(e, held.id, `${c.name} drops ${held.name}`))}
                title="Concentrating. Click to drop it.">◎ {held.name} · {rounds(held.remaining)} ✕</button>
            )}
            {on.map(e => <span key={e.id} className="chip fx" title={e.sourceId ? `From ${enc.combatants.find(x => x.id === e.sourceId)?.name}` : undefined}>{e.name} · {rounds(e.remaining)}</span>)}
            {status.conditions.filter(x => !(c.kind === 'npc' && !c.conditions.includes(x))).map(x => (
              <button key={x} className="chip cond" onClick={() => setConditions(own.filter(y => y !== x))} title="Remove">{x} ✕</button>
            ))}
            {c.kind === 'npc' && fromEffects.filter(x => !c.conditions.includes(x)).map(x => (
              <span key={x} className="chip cond" title="From an effect">{x}</span>
            ))}
          </div>
        )}
      </div>

      <div className="controls">
        <input aria-label={`Amount for ${c.name}`} inputMode="numeric" placeholder="0" value={amount}
          onChange={ev => setAmount(ev.target.value.replace(/\D/g, ''))}
          onKeyDown={ev => { if (ev.key === 'Enter' && n) { damage(); setAmount('') } }} />
        <button className="btn small danger" disabled={!n || life === 'dead'} onClick={() => { damage(); setAmount('') }}>Dmg</button>
        <button className="btn small heal" disabled={!n || (c.kind === 'pc' && life === 'dead')} onClick={() => { healUp(); setAmount('') }}>Heal</button>
        <select aria-label={`Add condition to ${c.name}`} value="" onChange={ev => setConditions([...own, ev.target.value as ConditionId])}>
          <option value="">+ Condition</option>
          {CONDITIONS.filter(x => !own.includes(x)).map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        {active && life === 'dying' && <button className="btn small primary" onClick={deathSave}>Death save</button>}
        <button className="icon" onClick={() => confirm(`Remove ${c.name}?`) && act(e => removeCombatant(e, c.id))} aria-label={`Remove ${c.name}`}>✕</button>
      </div>
    </li>
  )
}

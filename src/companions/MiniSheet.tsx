import { useState } from 'react'
import type { Character } from '../model/character'
import { abilityMod, formatMod } from '../rules'
import { ABILITIES, type Ability } from '../rules/types'
import {
  damageCompanion, downText, formAbilities, formatCr, formatSpeed, healCompanion, KIND_LABEL, restoreCompanion, setMaxHp, tempHpCompanion,
  type DamageResult,
} from './rules'
import type { Companion, Creature } from './types'
import { useCompanionRolls } from './useCompanionRolls'

const SHORT: Record<Ability, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

export function MiniSheet({ companion: comp, creature, owner, onSave, onDamage, onRemove }: {
  companion: Companion
  creature: Creature
  owner: Character
  onSave: (c: Companion) => void
  /** Damage goes through the parent so wild shape can carry overflow to the druid. */
  onDamage: (r: DamageResult) => void
  onRemove: () => void
}) {
  const [amount, setAmount] = useState('')
  const [crit, setCrit] = useState(false)
  const rolls = useCompanionRolls(comp)
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const pct = comp.maxHp ? (comp.currentHp / comp.maxHp) * 100 : 0
  const down = comp.currentHp === 0
  const abilities = formAbilities(creature, comp, owner)
  const act = (fn: () => void) => { if (n > 0) { fn(); setAmount('') } }
  const id = `comp-${comp.id}`

  return (
    <article className={`panel comp-card kind-${comp.kind}${down ? ' down' : ''}`} aria-labelledby={`${id}-name`}>
      <header>
        <div>
          <h3 id={`${id}-name`}>{comp.name}</h3>
          <p className="muted small">
            {comp.name !== creature.name && `${creature.name} · `}{creature.size} {creature.type} · CR {formatCr(creature.cr)}
          </p>
        </div>
        <span className="kind">{KIND_LABEL[comp.kind]}</span>
      </header>

      <div>
        <div className="hp-text" aria-live="polite">
          <strong>{comp.currentHp}</strong><span className="muted">/ {comp.maxHp} HP</span>
          {comp.tempHp > 0 && <span className="temp">+{comp.tempHp} temp</span>}
        </div>
        <div className="bar" aria-hidden="true">
          <div className={`fill ${pct <= 25 ? 'low' : pct <= 50 ? 'hurt' : 'ok'}`} style={{ width: `${pct}%` }} />
        </div>
        {down && <p className="status">{downText(comp.kind)}</p>}
      </div>

      <form className="hp-controls" onSubmit={e => e.preventDefault()}>
        <label className="sr-only" htmlFor={`${id}-amt`}>Amount for {comp.name}</label>
        <input id={`${id}-amt`} inputMode="numeric" pattern="[0-9]*" placeholder="0"
          value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} />
        <button type="submit" className="btn small danger" disabled={!n || down}
          onClick={() => act(() => onDamage(damageCompanion(comp, n)))}>Damage</button>
        <button type="button" className="btn small" disabled={!n}
          onClick={() => act(() => onSave(healCompanion(comp, n)))}>Heal</button>
        <button type="button" className="btn small" disabled={!n}
          onClick={() => act(() => onSave(tempHpCompanion(comp, n)))}>Temp</button>
      </form>

      <dl className="stats">
        <div><dt>AC</dt><dd title={creature.acNote}>{creature.ac}</dd></div>
        <div className="wide"><dt>Speed</dt><dd>{formatSpeed(creature.speed)}</dd></div>
      </dl>

      <div className="abilities" role="group" aria-label="Ability checks">
        {ABILITIES.map(a => {
          const mod = abilityMod(abilities[a])
          return (
            <button key={a} type="button" className="ability" title={`Roll ${SHORT[a]} check`}
              onClick={() => rolls.check(`${comp.name} ${SHORT[a]}`, mod)}>
              <span className="lbl">{SHORT[a]}</span>
              <span className="score">{abilities[a]}</span>
              <span className="mod">{formatMod(mod)}</span>
            </button>
          )
        })}
      </div>
      {comp.kind === 'wildShape' && (
        <p className="hint">INT, WIS and CHA are {owner.name}'s own. Use the higher of your or the beast's skill and save bonuses. You can't cast spells in this form.</p>
      )}
      {creature.skills && <p className="small"><span className="muted">Skills</span> {creature.skills}</p>}
      <p className="small"><span className="muted">Senses</span> {creature.senses}</p>

      {creature.actions.length > 0 && (
        <div className="actions">
          <div className="row spread-tight">
            <h4>Actions</h4>
            <label className="small check"><input type="checkbox" checked={crit} onChange={e => setCrit(e.target.checked)} /> Crit</label>
          </div>
          {comp.kind === 'familiar' && <p className="hint">A familiar can't attack, but can take other actions (Help is a favourite).</p>}
          <ul className="plain">
            {creature.actions.map(a => (
              <li key={a.name} className="action">
                <div className="row">
                  <strong>{a.name}</strong>
                  {a.toHit !== undefined && (
                    <button type="button" className="btn small" onClick={() => rolls.attack(a)}>{formatMod(a.toHit)} to hit</button>
                  )}
                  {a.damage && (
                    <button type="button" className="btn small" onClick={() => rolls.damage(a, crit)}>{a.damage} {a.damageType}</button>
                  )}
                </div>
                {a.text && <p className="small muted">{a.text}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {creature.traits.length > 0 && (
        <details>
          <summary className="small">Traits ({creature.traits.length})</summary>
          <ul className="plain small">
            {creature.traits.map(tr => <li key={tr.name}><strong>{tr.name}.</strong> {tr.text}</li>)}
          </ul>
        </details>
      )}

      <label className="sr-only" htmlFor={`${id}-notes`}>Notes</label>
      <textarea id={`${id}-notes`} className="notes" rows={2} placeholder="Notes (tricks, commands, where it is)"
        defaultValue={comp.notes} onBlur={e => e.target.value !== comp.notes && onSave({ ...comp, notes: e.target.value })} />

      <footer className="row">
        {comp.kind === 'wildShape' ? (
          <button type="button" className="btn small primary" onClick={onRemove}>Revert to {owner.name}</button>
        ) : (
          <>
            <button type="button" className="btn small" disabled={comp.currentHp === comp.maxHp && !comp.tempHp}
              onClick={() => onSave(restoreCompanion(comp))}>
              {comp.kind === 'familiar' && down ? 'Summon again' : 'Full HP'}
            </button>
            <button type="button" className="btn small ghost" onClick={() => {
              const v = Number(prompt(`Max HP for ${comp.name}`, String(comp.maxHp)))
              if (v > 0) onSave(setMaxHp(comp, v))
            }}>Max HP</button>
            <button type="button" className="btn small ghost"
              onClick={() => (comp.kind === 'summon' || confirm(`Remove ${comp.name}?`)) && onRemove()}>
              {comp.kind === 'summon' ? 'Dismiss' : 'Remove'}
            </button>
          </>
        )}
      </footer>
    </article>
  )
}

import { useState } from 'react'
import { rollAttackWithDamage, rollDamage, rollInitiative } from '../dice'
import { RollView, useDice, useRollHistory } from '../dice/ui'
import type { Character } from '../model/character'
import { derive, formatMod, getCritRange, type Attack } from '../rules'
import { useSheetRolls } from '../sheet/dice'
import { effectiveMaxHp, grantTempHp, heal, rollDeathSave, stabilize, takeDamage, vitals } from '../sheet/engine'
import type { Apply } from '../sheet/types'
import { useLiveCharacter } from '../sheet/useLiveCharacter'
import { pressKey, tracks } from './tracks'
import { useWakeLock } from './useWakeLock'
import './table.css'

/** Big-button combat view for playing at the table with one hand. Keeps the screen on while open. */
export function TableMode({ characterId, onExit }: { characterId: string; onExit: () => void }) {
  const { character, apply, undo, log } = useLiveCharacter(characterId)
  const wake = useWakeLock()

  if (!character) {
    return (
      <div className="ff-table">
        <p className="tm-empty">{character === undefined ? 'Loading…' : 'This character could not be found.'}</p>
        <button type="button" className="tm-key" onClick={onExit}>Back</button>
      </div>
    )
  }

  return (
    <div className="ff-table">
      <header className="tm-top">
        <button type="button" className="tm-exit" onClick={onExit} aria-label="Leave table mode">✕</button>
        <div className="tm-who">
          <strong>{character.name}</strong>
          <span className={`tm-wake tm-wake-${wake}`}>{WAKE[wake]}</span>
        </div>
        <div className="tm-ac" aria-label={`Armor class ${derive(character).armorClass.value}`}>
          <small>AC</small>{derive(character).armorClass.value}
        </div>
      </header>

      <div className="tm-body">
        <div className="tm-info">
          <Vitals character={character} apply={apply} />
          <LastRoll characterId={character.id} />
          <Rolls character={character} />
          <Tracks character={character} apply={apply} />
        </div>
        <Keypad character={character} apply={apply} onUndo={undo} lastChange={log[0]?.text} />
      </div>
    </div>
  )
}

const WAKE = { on: 'Screen stays on', off: 'Screen may sleep', unsupported: 'Keep-awake not supported here' }

function Vitals({ character, apply }: { character: Character; apply: Apply }) {
  const { currentHp, tempHp, deathSaves } = character.state
  const max = effectiveMaxHp(character)
  const state = vitals(character)
  const rolls = useSheetRolls(character)
  const pct = max ? (currentHp / max) * 100 : 0

  return (
    <section className={`tm-hp tm-hp-${state}`} aria-label="Hit points">
      <div className="tm-hp-num" aria-live="polite">
        <span className="tm-hp-cur">{currentHp}</span>
        <span className="tm-hp-max">/ {max}</span>
        {tempHp > 0 && <span className="tm-hp-temp">+{tempHp} temp</span>}
      </div>
      <div className="tm-bar" aria-hidden="true">
        <div className={`tm-bar-fill ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      {state === 'dying' && (
        <div className="tm-death">
          <div className="tm-saves" aria-label={`${deathSaves.successes} successes, ${deathSaves.failures} failures`}>
            <span className="good">{'●'.repeat(deathSaves.successes)}{'○'.repeat(3 - deathSaves.successes)}</span>
            <span className="bad">{'●'.repeat(deathSaves.failures)}{'○'.repeat(3 - deathSaves.failures)}</span>
          </div>
          <div className="tm-row">
            <button type="button" className="tm-key tm-primary" onClick={() => {
              const d20 = rolls.deathSave()
              apply(`Death save (${d20})`, c => rollDeathSave(c, d20))
            }}>Roll death save</button>
            <button type="button" className="tm-key" onClick={() => apply('Stabilized', stabilize)}>Stable</button>
          </div>
        </div>
      )}
      {state === 'stable' && <p className="tm-status">Stable at 0 HP.</p>}
      {state === 'dead' && <p className="tm-status bad">Dead. Use the full sheet to revive.</p>}
    </section>
  )
}

function LastRoll({ characterId }: { characterId: string }) {
  const [last] = useRollHistory(characterId)
  if (!last) return null
  return <div className="tm-last"><RollView roll={last} compact /></div>
}

function Rolls({ character }: { character: Character }) {
  const { record } = useDice()
  const stats = derive(character)
  const critRange = getCritRange(character)
  const who = { character: { id: character.id, name: character.name, state: character.state } }

  // One tap rolls to-hit and damage; a crit doubles the damage dice.
  const attack = (a: Attack) => {
    const out = rollAttackWithDamage(a, { ...who, critRange })
    record(out.attack)
    if (out.damage) record(out.damage)
  }
  const damage = (a: Attack) => record(rollDamage(a, who))

  return (
    <section className="tm-rolls" aria-label="Rolls">
      <button type="button" className="tm-key" onClick={() => record(rollInitiative(stats, who))}>
        Initiative <small>{formatMod(stats.initiative)}</small>
      </button>
      {stats.attacks.map(a => (
        <div key={a.name} className="tm-attack">
          <button type="button" className="tm-key" onClick={() => attack(a)}>
            {a.name} <small>{formatMod(a.bonus)}</small>
          </button>
          <button type="button" className="tm-key" onClick={() => damage(a)}>
            Dmg <small>{a.damage}</small>
          </button>
        </div>
      ))}
    </section>
  )
}

function Tracks({ character, apply }: { character: Character; apply: Apply }) {
  const list = tracks(character)
  if (!list.length) return null
  return (
    <section className="tm-tracks" aria-label="Slots and resources">
      {list.map(t => (
        <div key={t.id} className={`tm-track ${t.remaining === 0 ? 'empty' : ''}`}>
          <button type="button" className="tm-track-use" disabled={t.remaining === 0}
            aria-label={`Use ${t.label}, ${t.remaining} of ${t.max} left`}
            onClick={() => apply(`Used ${t.label}`, c => t.change(c, 1))}>
            <span className="tm-track-n">{t.remaining}<small>/{t.max}</small></span>
            <span className="tm-track-label">{t.label}</span>
          </button>
          <button type="button" className="tm-track-back" disabled={t.remaining === t.max}
            aria-label={`Give back ${t.label}`}
            onClick={() => apply(`Regained ${t.label}`, c => t.change(c, -1))}>+1</button>
        </div>
      ))}
    </section>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']
const KEY_LABEL: Record<string, string> = { clear: 'C', back: '⌫' }

function Keypad({ character, apply, onUndo, lastChange }: {
  character: Character
  apply: Apply
  onUndo: () => void
  lastChange?: string
}) {
  const [amount, setAmount] = useState('')
  const [critical, setCritical] = useState(false)
  const n = Number(amount) || 0
  const state = vitals(character)
  const act = (text: string, change: (c: Character) => Character) => {
    if (!n) return
    apply(text, change)
    setAmount('')
    setCritical(false)
  }
  const atZero = character.state.currentHp === 0 && state !== 'dead'

  return (
    <section className="tm-pad" aria-label="Damage and healing">
      <div className="tm-amount" aria-live="polite">
        <span className={amount ? '' : 'muted'}>{amount || '0'}</span>
        {atZero && (
          <button type="button" className={`tm-chip ${critical ? 'on' : ''}`} aria-pressed={critical}
            onClick={() => setCritical(v => !v)}>Crit hit</button>
        )}
        <button type="button" className="tm-undo" disabled={!lastChange} onClick={onUndo}>
          Undo{lastChange ? `: ${lastChange}` : ''}
        </button>
      </div>
      <div className="tm-grid">
      <div className="tm-keys">
        {KEYS.map(k => (
          <button key={k} type="button" className="tm-key" aria-label={k === 'back' ? 'Backspace' : k === 'clear' ? 'Clear' : k}
            onClick={() => setAmount(a => pressKey(a, k))}>{KEY_LABEL[k] ?? k}</button>
        ))}
      </div>
      <div className="tm-actions">
        <button type="button" className="tm-key tm-damage" disabled={!n || state === 'dead'}
          onClick={() => act(`Took ${n} damage${critical && atZero ? ' (critical)' : ''}`, c => takeDamage(c, n, { critical: critical && atZero }))}>Damage</button>
        <button type="button" className="tm-key tm-heal" disabled={!n || state === 'dead'}
          onClick={() => act(`Healed ${n}`, c => heal(c, n))}>Heal</button>
        <button type="button" className="tm-key" disabled={!n}
          onClick={() => act(`Gained ${n} temp HP`, c => grantTempHp(c, n))}>Temp</button>
      </div>
      </div>
    </section>
  )
}

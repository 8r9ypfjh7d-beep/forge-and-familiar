// The sheet's quick-cast bar: one tap to attack, cast a pinned spell (spending the slot) or use a resource.
// Rolls go to the shared dice history; slot and resource spending goes through apply, so Undo works.
import { useState } from 'react'
import { critNotation, isValidNotation, roll, rollAttack, rollDamage, type RollResult } from '../dice'
import { useDice } from '../dice/ui'
import type { Character } from '../model/character'
import { derive, formatMod, getResources, type DerivedStats } from '../rules'
import { ABILITIES, type Ability } from '../rules/types'
import type { Apply } from '../sheet/types'
import { SPELL_PRESETS } from './presets'
import {
  addEntry, entriesOf, moveEntry, newEntryId, ORDINAL, removeEntry, resourceUse, slotChoices, spellDamage,
  spendResource, spendSlot,
} from './quickcast'
import type { QuickCastEntry, SlotChoice, SpellEntry } from './types'
import './quickcast.css'

const SHORT: Record<Ability, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

interface Outcome {
  title: string
  note?: string
  rolls: RollResult[]
}

function useRecord() {
  try {
    // Same call on every render: it either always throws or never does.
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    return useDice().record
  } catch {
    // Rendered outside <DiceProvider> (tests, standalone use): roll without history.
    return (r: RollResult) => r
  }
}

export function QuickCastBar({ character, apply }: { character: Character; apply: Apply }) {
  const stats = derive(character)
  const record = useRecord()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const entries = entriesOf(character)
  const who = { id: character.id, name: character.name, state: character.state }

  const attack = (name: string) => {
    const a = stats.attacks.find(x => x.name === name)
    if (!a) return
    const hit = record(rollAttack(a, { character: who }))
    const dmg = record(rollDamage(a, { character: who, crit: hit.d20?.crit }))
    setOutcome({ title: a.name, note: a.notes.join(' · ') || undefined, rolls: [hit, dmg] })
  }

  const cast = (spell: SpellEntry, choice?: SlotChoice) => {
    setPicking(null)
    const sc = stats.spellcasting
    const castLevel = choice?.level ?? spell.level
    const rolls: RollResult[] = []
    const notes: string[] = []
    let crit = false
    if (spell.roll === 'attack') {
      if (sc) {
        const hit = record(rollAttack({ name: spell.name, bonus: sc.attackBonus }, { character: who }))
        crit = !!hit.d20?.crit
        rolls.push(hit)
      } else notes.push('No spellcasting ability, so no attack bonus')
    }
    if (spell.roll === 'save' && spell.save) notes.push(sc ? `DC ${sc.saveDc} ${SHORT[spell.save]} save` : `${SHORT[spell.save]} save`)
    const notation = spellDamage(spell, castLevel, stats.level, sc ? stats.mods[sc.ability] : 0)
    if (notation) {
      const label = `${spell.name}${spell.damageType ? ` ${spell.damageType}` : ''}${crit ? ' (crit)' : ''}`
      rolls.push(record(roll(crit ? critNotation(notation) : notation, { character: who, label }, 'damage')))
    }
    if (choice) {
      const slot = `${ORDINAL[choice.level]}-level ${choice.source === 'pact' ? 'pact ' : ''}slot`
      notes.unshift(`Used a ${slot}`)
      apply(`Cast ${spell.name} (${slot})`, c => spendSlot(c, choice))
    }
    setOutcome({ title: spell.name, note: notes.join(' · ') || undefined, rolls })
  }

  const tapSpell = (spell: SpellEntry) => {
    if (spell.level === 0) return cast(spell)
    const choices = slotChoices(character, spell.level)
    if (choices.length === 1) return cast(spell, choices[0])
    setOutcome(null)
    setPicking(picking === spell.id ? null : spell.id)
  }

  const spendUse = (id: string) => {
    const r = resourceUse(character, id)
    if (!r || r.remaining <= 0) return
    apply(`Used ${r.label}`, c => spendResource(c, id))
    setOutcome({ title: r.label, note: `${r.remaining - 1} of ${r.max} left`, rolls: [] })
  }

  const run = (e: QuickCastEntry) => {
    if (e.kind === 'attack') attack(e.name)
    else if (e.kind === 'spell') tapSpell(e)
    else spendUse(e.resourceId)
  }

  const pickingSpell = entries.find((e): e is SpellEntry => e.id === picking && e.kind === 'spell')

  return (
    <section className="card qc" aria-labelledby="qc-title">
      <div className="card-head">
        <h2 id="qc-title">Quick cast</h2>
        {entries.length > 0 && (
          <button type="button" className="btn ghost small" aria-pressed={editing} onClick={() => { setEditing(!editing); setPicking(null) }}>
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {entries.length === 0 && !adding && (
        <p className="hint qc-empty">Pin the spells, attacks and abilities you use every turn, then cast them in one tap.</p>
      )}

      <ul className="qc-bar">
        {entries.map((e, i) => {
          const view = describe(character, stats, e)
          return (
            <li key={e.id} className={`qc-item qc-${e.kind}`}>
              <button type="button" className={`qc-chip${picking === e.id ? ' on' : ''}${view.blocked ? ' blocked' : ''}`} disabled={editing || !!view.blocked}
                title={view.blocked} aria-expanded={e.kind === 'spell' && e.level > 0 ? picking === e.id : undefined}
                onClick={() => run(e)}>
                <span className="qc-name">{view.name}</span>
                <span className="qc-sub">{view.blocked ?? view.sub}</span>
              </button>
              {editing && (
                <span className="qc-tools">
                  <button type="button" aria-label={`Move ${view.name} left`} disabled={i === 0}
                    onClick={() => apply(`Moved ${view.name}`, c => moveEntry(c, e.id, -1))}>←</button>
                  <button type="button" aria-label={`Move ${view.name} right`} disabled={i === entries.length - 1}
                    onClick={() => apply(`Moved ${view.name}`, c => moveEntry(c, e.id, 1))}>→</button>
                  <button type="button" aria-label={`Unpin ${view.name}`}
                    onClick={() => apply(`Unpinned ${view.name}`, c => removeEntry(c, e.id))}>×</button>
                </span>
              )}
            </li>
          )
        })}
        {!adding && (
          <li><button type="button" className="qc-chip qc-add" onClick={() => { setAdding(true); setEditing(false) }}>+ Pin</button></li>
        )}
      </ul>

      {pickingSpell && (
        <div className="qc-panel" role="group" aria-label={`Cast ${pickingSpell.name} with`}>
          <span>Cast {pickingSpell.name} with</span>
          {slotChoices(character, pickingSpell.level).map(ch => (
            <button key={`${ch.source}-${ch.level}`} type="button" className="btn small" onClick={() => cast(pickingSpell, ch)}>
              {ch.source === 'pact' ? 'Pact ' : ''}{ORDINAL[ch.level]} <small>({ch.remaining} left)</small>
            </button>
          ))}
        </div>
      )}

      {outcome && !pickingSpell && (
        <div className="qc-panel qc-outcome" aria-live="polite">
          <div className="qc-outcome-head">
            <strong>{outcome.title}</strong>
            <button type="button" className="btn ghost small" aria-label="Dismiss" onClick={() => setOutcome(null)}>×</button>
          </div>
          {outcome.note && <p className="qc-note">{outcome.note}</p>}
          {outcome.rolls.map(r => <RollLine key={r.id} roll={r} />)}
        </div>
      )}

      {adding && (
        <AddEntry character={character} stats={stats} onCancel={() => setAdding(false)}
          onAdd={(entry, label) => { apply(`Pinned ${label}`, c => addEntry(c, entry)); setAdding(false) }} />
      )}
    </section>
  )
}

function RollLine({ roll: r }: { roll: RollResult }) {
  const crit = r.d20?.crit
  const fumble = r.d20?.fumble
  return (
    <div className={`qc-roll${crit ? ' crit' : ''}${fumble ? ' fumble' : ''}`}>
      <span className="qc-roll-label">
        {r.type === 'attack' ? 'To hit' : r.label}
        {r.d20 && r.d20.mode !== 'normal' && <small> ({r.d20.mode === 'advantage' ? 'adv' : 'dis'})</small>}
        {crit && <small> Critical!</small>}
        {fumble && <small> Natural 1</small>}
      </span>
      <span className="qc-roll-break">{r.breakdown}</span>
      <span className="qc-roll-total">{r.total}</span>
    </div>
  )
}

/** Chip text for an entry, and why it can't be used right now. */
function describe(c: Character, stats: DerivedStats, e: QuickCastEntry): { name: string; sub: string; blocked?: string } {
  if (e.kind === 'attack') {
    const a = stats.attacks.find(x => x.name === e.name)
    if (!a) return { name: e.name, sub: '', blocked: 'Not equipped' }
    return { name: a.name, sub: `${formatMod(a.bonus)} · ${a.damage}` }
  }
  if (e.kind === 'resource') {
    const r = resourceUse(c, e.resourceId)
    if (!r) return { name: e.resourceId, sub: '', blocked: 'Not available' }
    return { name: r.label, sub: `${r.remaining}/${r.max}`, blocked: r.remaining <= 0 ? `0/${r.max} left` : undefined }
  }
  const sc = stats.spellcasting
  const bits: string[] = [ORDINAL[e.level]]
  if (e.roll === 'attack' && sc) bits.push(formatMod(sc.attackBonus))
  if (e.roll === 'save' && e.save) bits.push(`${SHORT[e.save]}${sc ? ` ${sc.saveDc}` : ''}`)
  if (e.level > 0 && slotChoices(c, e.level).length === 0) return { name: e.name, sub: '', blocked: 'No slots left' }
  return { name: e.name, sub: bits.join(' · ') }
}

type AddKind = 'spell' | 'attack' | 'resource'

function AddEntry({ character, stats, onAdd, onCancel }: {
  character: Character
  stats: DerivedStats
  onAdd: (entry: QuickCastEntry, label: string) => void
  onCancel: () => void
}) {
  const pinned = entriesOf(character)
  const attacks = stats.attacks.filter(a => !pinned.some(e => e.kind === 'attack' && e.name === a.name))
  const resources = [
    ...getResources(character).map(r => ({ id: r.id, label: r.label })),
    ...(character.state.counters ?? []).map(k => ({ id: k.id, label: k.label })),
  ].filter(r => !pinned.some(e => e.kind === 'resource' && e.resourceId === r.id))

  const [kind, setKind] = useState<AddKind>('spell')
  const [attackName, setAttackName] = useState(attacks[0]?.name ?? '')
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? '')
  const [spell, setSpell] = useState<Omit<SpellEntry, 'id' | 'kind'>>({ name: '', level: 1, roll: 'none' })
  const [error, setError] = useState('')
  const patch = (p: Partial<SpellEntry>) => { setSpell(s => ({ ...s, ...p })); setError('') }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const id = newEntryId()
    if (kind === 'attack') {
      if (attackName) onAdd({ id, kind: 'attack', name: attackName }, attackName)
      return
    }
    if (kind === 'resource') {
      const r = resources.find(x => x.id === resourceId)
      if (r) onAdd({ id, kind: 'resource', resourceId: r.id }, r.label)
      return
    }
    const name = spell.name.trim()
    if (!name) return setError('Give the spell a name.')
    for (const [field, value] of [['Damage', spell.damage], ['Higher levels', spell.upcast]] as const) {
      if (value?.trim() && !isValidNotation(value.trim())) return setError(`${field} should be dice like 2d6 or 1d4+1.`)
    }
    const clean: SpellEntry = {
      id, kind: 'spell', name, level: spell.level, roll: spell.roll,
      ...(spell.roll === 'save' && { save: spell.save ?? 'dex' }),
      ...(spell.damage?.trim() && { damage: spell.damage.trim(), damageType: spell.damageType?.trim() || undefined }),
      ...(spell.damage?.trim() && spell.level > 0 && spell.upcast?.trim() && { upcast: spell.upcast.trim() }),
      ...(spell.damage?.trim() && spell.level === 0 && spell.cantripScaling && { cantripScaling: true }),
      ...(spell.damage?.trim() && spell.addMod && { addMod: true }),
    }
    onAdd(clean, name)
  }

  return (
    <form className="qc-add-form" onSubmit={submit}>
      <div className="segmented" role="radiogroup" aria-label="What to pin">
        {(['spell', 'attack', 'resource'] as const).map(k => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {k === 'spell' ? 'Spell' : k === 'attack' ? 'Attack' : 'Resource'}
          </button>
        ))}
      </div>

      {kind === 'attack' && (attacks.length
        ? <label>Weapon<select value={attackName} onChange={e => setAttackName(e.target.value)}>
            {attacks.map(a => <option key={a.name} value={a.name}>{a.name} ({formatMod(a.bonus)}, {a.damage} {a.damageType})</option>)}
          </select></label>
        : <p className="hint">Every equipped attack is already pinned. Equip a weapon to add more.</p>)}

      {kind === 'resource' && (resources.length
        ? <label>Resource<select value={resourceId} onChange={e => setResourceId(e.target.value)}>
            {resources.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select></label>
        : <p className="hint">No class resources or trackers left to pin. Add a tracker under Class resources.</p>)}

      {kind === 'spell' && (
        <>
          <label>Start from an SRD spell
            <select value="" onChange={e => {
              const p = SPELL_PRESETS.find(x => x.name === e.target.value)
              if (p) { setSpell({ ...p }); setError('') }
            }}>
              <option value="">Choose…</option>
              {SPELL_PRESETS.map(p => <option key={p.name} value={p.name}>{p.name} ({ORDINAL[p.level]})</option>)}
            </select>
          </label>
          <div className="qc-grid">
            <label className="wide">Name<input value={spell.name} onChange={e => patch({ name: e.target.value })} placeholder="Fireball" /></label>
            <label>Level
              <select value={spell.level} onChange={e => patch({ level: Number(e.target.value) })}>
                {ORDINAL.map((o, i) => <option key={o} value={i}>{o}</option>)}
              </select>
            </label>
            <label>Roll
              <select value={spell.roll} onChange={e => patch({ roll: e.target.value as SpellEntry['roll'] })}>
                <option value="none">No roll</option>
                <option value="attack">Spell attack</option>
                <option value="save">Saving throw</option>
              </select>
            </label>
            {spell.roll === 'save' && (
              <label>Save
                <select value={spell.save ?? 'dex'} onChange={e => patch({ save: e.target.value as Ability })}>
                  {ABILITIES.map(a => <option key={a} value={a}>{SHORT[a]}</option>)}
                </select>
              </label>
            )}
            <label>Damage or healing<input value={spell.damage ?? ''} onChange={e => patch({ damage: e.target.value })} placeholder="8d6" /></label>
            <label>Type<input value={spell.damageType ?? ''} onChange={e => patch({ damageType: e.target.value })} placeholder="fire" /></label>
            {spell.level > 0 && (
              <label>Per higher level<input value={spell.upcast ?? ''} onChange={e => patch({ upcast: e.target.value })} placeholder="1d6" /></label>
            )}
          </div>
          {spell.level === 0 && (
            <label className="check"><input type="checkbox" checked={!!spell.cantripScaling} onChange={e => patch({ cantripScaling: e.target.checked })} />
              More dice at levels 5, 11 and 17</label>
          )}
          <label className="check"><input type="checkbox" checked={!!spell.addMod} onChange={e => patch({ addMod: e.target.checked })} />
            Add spellcasting modifier{stats.spellcasting ? ` (${formatMod(stats.mods[stats.spellcasting.ability])})` : ''}</label>
        </>
      )}

      {error && <p className="qc-error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="btn primary"
          disabled={(kind === 'attack' && !attacks.length) || (kind === 'resource' && !resources.length)}>Pin</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

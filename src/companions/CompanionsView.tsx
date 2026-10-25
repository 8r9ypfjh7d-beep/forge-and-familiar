import { useEffect, useMemo, useState } from 'react'
import type { Character } from '../model/character'
import { setResourceUsed, takeDamage } from '../sheet/engine'
import { getCharacter, onCharactersChanged, saveCharacter } from '../storage'
import { CREATURES } from './data/creatures'
import { MiniSheet } from './MiniSheet'
import {
  classLevel, creatureOf, formatCr, formsFor, KIND_LABEL, newCompanion, WILD_SHAPE, wildShapeLimits, wildShapeUses,
  type DamageResult,
} from './rules'
import { deleteCompanion, listCompanions, onCompanionsChanged, saveCompanion } from './store'
import type { Companion, CompanionKind, Creature } from './types'
import { useCompanionRolls } from './useCompanionRolls'
import './companions.css'

const KINDS: CompanionKind[] = ['familiar', 'companion', 'summon', 'wildShape']
const ORDER: Record<CompanionKind, number> = { wildShape: 0, familiar: 1, companion: 2, summon: 3 }

export function CompanionsView({ characterId, onBack, onOpenSheet }: {
  characterId: string
  onBack: () => void
  onOpenSheet: (id: string) => void
}) {
  const [owner, setOwner] = useState<Character | null | undefined>(undefined)
  const [list, setList] = useState<Companion[]>([])
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let live = true
    const loadChar = () => getCharacter(characterId).then(c => { if (live) setOwner(c ?? null) })
    const loadComps = () => listCompanions(characterId).then(l => { if (live) setList(l) })
    loadChar()
    loadComps()
    const off1 = onCharactersChanged(id => { if (!id || id === characterId) loadChar() })
    const off2 = onCompanionsChanged(loadComps)
    return () => { live = false; off1(); off2() }
  }, [characterId])

  const sorted = useMemo(() => [...list].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.createdAt.localeCompare(b.createdAt)), [list])

  if (owner === undefined) return <div className="ff-comp"><p className="hint">Loading…</p></div>
  if (owner === null) {
    return (
      <div className="ff-comp">
        <p>This character could not be found.</p>
        <button type="button" className="btn" onClick={onBack}>Back</button>
      </div>
    )
  }

  const form = list.find(c => c.kind === 'wildShape')

  const onDamage = async (r: DamageResult) => {
    const comp = r.companion
    if (comp.kind === 'wildShape' && comp.currentHp === 0) {
      // SRD: at 0 HP the druid reverts, and leftover damage carries over to their normal form.
      await deleteCompanion(comp.id)
      if (r.overflow > 0) await saveCharacter(takeDamage(owner, r.overflow))
      setNotice(r.overflow > 0
        ? `${owner.name} dropped out of ${comp.name} form and took ${r.overflow} damage carried over.`
        : `${owner.name} dropped out of ${comp.name} form.`)
      return
    }
    await saveCompanion(comp)
  }

  return (
    <div className="ff-comp">
      <header className="comp-head">
        <button type="button" className="btn ghost" onClick={onBack} aria-label="Back to characters">←</button>
        <div className="grow">
          <h2>{owner.name}'s companions</h2>
          <p className="muted small">Familiars, pets, summons and wild shapes, each with its own HP and attacks.</p>
        </div>
        <button type="button" className="btn small" onClick={() => onOpenSheet(owner.id)}>Open sheet</button>
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice} <button type="button" className="btn ghost small" onClick={() => setNotice('')}>OK</button>
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="panel empty"><p>No companions yet. Add a familiar, a pet or a summon below.</p></div>
      ) : (
        <div className="comp-grid">
          {sorted.map(comp => {
            const creature = creatureOf(comp)
            if (!creature) return null
            return (
              <MiniSheet key={comp.id} companion={comp} creature={creature} owner={owner}
                onSave={saveCompanion} onDamage={onDamage} onRemove={() => deleteCompanion(comp.id)} />
            )
          })}
        </div>
      )}

      <AddCompanion owner={owner} inWildShape={!!form} onNotice={setNotice} />
    </div>
  )
}

function AddCompanion({ owner, inWildShape, onNotice }: { owner: Character; inWildShape: boolean; onNotice: (s: string) => void }) {
  const druid = classLevel(owner, 'druid')
  const limits = wildShapeLimits(druid)
  const kinds = KINDS.filter(k => k !== 'wildShape' || limits)
  const [kind, setKind] = useState<CompanionKind>('familiar')
  const forms = useMemo(() => formsFor(kind, owner), [kind, owner])
  const [creatureId, setCreatureId] = useState(forms[0]?.id ?? '')
  const [name, setName] = useState('')
  const [count, setCount] = useState(1)
  const [rolledHp, setRolledHp] = useState<number | undefined>()
  const [custom, setCustom] = useState({ name: '', ac: 12, hp: 10, speed: 30, attack: '', toHit: 3, damage: '1d6+1', damageType: 'piercing' })
  const rolls = useCompanionRolls({ characterId: owner.id, name: name || 'Companion' })

  const isCustom = creatureId === 'custom'
  const creature: Creature | undefined = isCustom ? customCreature(custom) : forms.find(f => f.id === creatureId)
  const uses = wildShapeUses(owner)

  const pickKind = (k: CompanionKind) => {
    setKind(k)
    setCreatureId(formsFor(k, owner)[0]?.id ?? '')
    setRolledHp(undefined)
    setCount(1)
  }

  const add = async () => {
    if (!creature) return
    if (kind === 'wildShape') {
      await saveCharacter(setResourceUsed(owner, WILD_SHAPE, uses.max - uses.left + 1))
      await saveCompanion(newCompanion({ kind, name: creature.name, creature, owner }, crypto.randomUUID(), new Date()))
      onNotice(`${owner.name} is a ${creature.name} for up to ${limits!.hours} hour${limits!.hours > 1 ? 's' : ''}. ${uses.left - 1} Wild Shape use${uses.left - 1 === 1 ? '' : 's'} left.`)
      return
    }
    const n = kind === 'summon' ? count : 1
    const base = name.trim() || creature.name
    for (let i = 1; i <= n; i++) {
      const label = n > 1 ? `${base} ${i}` : base
      await saveCompanion(newCompanion({ kind, name: label, creature, owner, maxHp: i === 1 ? rolledHp : undefined }, crypto.randomUUID(), new Date()))
    }
    setName('')
    setRolledHp(undefined)
  }

  const blocked = kind === 'wildShape' && (inWildShape || uses.left === 0)

  return (
    <section className="panel comp-add" aria-labelledby="comp-add-title">
      <h3 id="comp-add-title">Add</h3>
      <div className="row" role="radiogroup" aria-label="Kind">
        {kinds.map(k => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => pickKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="hint">{HELP[kind](owner, limits)}</p>

      <div className="add-fields">
        <div className="field">
          <label htmlFor="comp-creature">{kind === 'wildShape' ? 'Beast form' : 'Creature'}</label>
          <select id="comp-creature" value={creatureId} onChange={e => { setCreatureId(e.target.value); setRolledHp(undefined) }}>
            {forms.map(f => <option key={f.id} value={f.id}>{f.name} (CR {formatCr(f.cr)}, {f.hp} HP)</option>)}
            {(kind === 'companion' || kind === 'summon') && <option value="custom">Custom creature…</option>}
          </select>
        </div>
        {kind !== 'wildShape' && (
          <div className="field">
            <label htmlFor="comp-name">Name</label>
            <input id="comp-name" value={name} onChange={e => setName(e.target.value)} placeholder={creature?.name ?? 'Name'} />
          </div>
        )}
        {kind === 'summon' && (
          <div className="field">
            <label htmlFor="comp-count">How many</label>
            <input id="comp-count" type="number" min={1} max={8} value={count}
              onChange={e => setCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        )}
      </div>

      {isCustom && (
        <div className="add-fields custom">
          <div className="field"><label htmlFor="cc-name">Creature</label>
            <input id="cc-name" value={custom.name} placeholder="Giant ferret" onChange={e => setCustom({ ...custom, name: e.target.value })} /></div>
          {(['ac', 'hp', 'speed', 'toHit'] as const).map(k => (
            <div key={k} className="field narrow"><label htmlFor={`cc-${k}`}>{CUSTOM_LABEL[k]}</label>
              <input id={`cc-${k}`} type="number" value={custom[k]} onChange={e => setCustom({ ...custom, [k]: Number(e.target.value) || 0 })} /></div>
          ))}
          <div className="field"><label htmlFor="cc-attack">Attack</label>
            <input id="cc-attack" value={custom.attack} placeholder="Bite" onChange={e => setCustom({ ...custom, attack: e.target.value })} /></div>
          <div className="field narrow"><label htmlFor="cc-dmg">Damage</label>
            <input id="cc-dmg" value={custom.damage} onChange={e => setCustom({ ...custom, damage: e.target.value })} /></div>
          <div className="field narrow"><label htmlFor="cc-type">Type</label>
            <input id="cc-type" value={custom.damageType} onChange={e => setCustom({ ...custom, damageType: e.target.value })} /></div>
        </div>
      )}

      <div className="row">
        {kind === 'wildShape' ? (
          <>
            <button type="button" className="btn primary" disabled={!creature || blocked} onClick={add}>Wild Shape</button>
            <span className="muted small">
              {inWildShape ? 'Revert first to pick another form.' : `${uses.left} of ${uses.max} uses left (back on a short rest).`}
            </span>
          </>
        ) : (
          <>
            <button type="button" className="btn primary" disabled={!creature || (isCustom && !custom.name.trim())} onClick={add}>
              Add {KIND_LABEL[kind].toLowerCase()}{kind === 'summon' && count > 1 ? `s (${count})` : ''}
            </button>
            {creature && !isCustom && (
              <span className="muted small">
                HP {rolledHp ?? creature.hp} {rolledHp === undefined ? '(average)' : '(rolled)'}{' '}
                <button type="button" className="btn ghost small" onClick={() => setRolledHp(Math.max(1, rolls.hp(creature.hitDice)))}>
                  Roll {creature.hitDice}
                </button>
              </span>
            )}
          </>
        )}
      </div>
    </section>
  )
}

const CUSTOM_LABEL = { ac: 'AC', hp: 'HP', speed: 'Speed', toHit: 'To hit' }

function customCreature(c: { name: string; ac: number; hp: number; speed: number; attack: string; toHit: number; damage: string; damageType: string }): Creature {
  return {
    id: 'custom', name: c.name.trim() || 'Custom creature', size: 'Medium', type: 'creature', cr: 0,
    ac: c.ac, hp: Math.max(1, c.hp), hitDice: `${Math.max(1, c.hp)}`, speed: { walk: c.speed },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, senses: '—', traits: [],
    actions: c.attack.trim() ? [{ name: c.attack.trim(), toHit: c.toHit, damage: c.damage.trim() || undefined, damageType: c.damageType.trim() }] : [],
  }
}

const HELP: Record<CompanionKind, (c: Character, l?: ReturnType<typeof wildShapeLimits>) => string> = {
  familiar: c => `Find Familiar: a celestial, fey or fiend in beast form. It vanishes at 0 HP.${classLevel(c, 'warlock') >= 3 ? ' Pact of the Chain adds imp, pseudodragon, quasit and sprite.' : ''}`,
  companion: () => 'A pet, mount or animal companion that stays with you. Any SRD beast, or make your own.',
  summon: () => `Short-lived creatures from spells like Conjure Animals. Add several at once; they're gone at 0 HP. ${CREATURES.filter(c => c.type === 'beast').length} SRD beasts to pick from.`,
  wildShape: (_c, l) => l
    ? `Beasts up to CR ${formatCr(l.maxCr)}${!l.fly ? ', no flying' : ''}${!l.swim ? ', no swimming' : ''}, for up to ${l.hours} hour${l.hours > 1 ? 's' : ''}. At 0 HP you revert and extra damage carries over to you.`
    : '',
}

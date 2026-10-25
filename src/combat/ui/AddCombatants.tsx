import { useEffect, useState } from 'react'
import { roll } from '../../dice'
import type { Character } from '../../model/character'
import { derive } from '../../rules'
import { listCharacters, listProfiles } from '../../storage'
import { addCombatant } from '../engine'
import type { Encounter } from '../types'
import type { Act } from './useEncounter'

const newId = () => crypto.randomUUID()

/** Adds party members (any player's character on this device) and monsters or NPCs. */
export function AddCombatants({ enc, act }: { enc: Encounter; act: Act }) {
  const [characters, setCharacters] = useState<{ owner: string; c: Character }[]>([])
  useEffect(() => {
    listProfiles().then(async ps => {
      const all = await Promise.all(ps.map(async p => (await listCharacters(p.id)).map(c => ({ owner: p.displayName, c }))))
      setCharacters(all.flat())
    })
  }, [])
  const inFight = new Set(enc.combatants.map(c => c.characterId))
  const available = characters.filter(x => !inFight.has(x.c.id))

  const addPc = (c: Character) =>
    act(e => addCombatant(e, { id: newId(), name: c.name, kind: 'pc', characterId: c.id, initiative: null, initBonus: derive(c).initiative }))

  return (
    <section className="panel add">
      <h3>Add to the fight</h3>
      <div className="row">
        <select aria-label="Add a party member" value="" disabled={!available.length}
          onChange={ev => { const x = available.find(a => a.c.id === ev.target.value); if (x) addPc(x.c) }}>
          <option value="">{available.length ? '+ Party member…' : 'No more characters'}</option>
          {available.map(({ owner, c }) => <option key={c.id} value={c.id}>{c.name} ({owner})</option>)}
        </select>
        {available.length > 1 && (
          <button className="btn small" onClick={() => available.forEach(x => addPc(x.c))}>Add everyone</button>
        )}
      </div>
      <MonsterForm act={act} />
    </section>
  )
}

function MonsterForm({ act }: { act: Act }) {
  const [f, setF] = useState({ name: '', count: '1', hp: '', ac: '', init: '0', con: '0' })
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: ev.target.value })

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const name = f.name.trim()
    const count = Math.min(20, Math.max(1, Math.floor(Number(f.count) || 1)))
    const hpText = f.hp.trim() || '1'
    // HP is a number, or dice like 2d6+2 rolled for each creature.
    let hps: number[]
    try {
      hps = Array.from({ length: count }, () => (/^\d+$/.test(hpText) ? Number(hpText) : Math.max(1, roll(hpText).total)))
    } catch {
      setError('HP must be a number or dice like 2d6+2.')
      return
    }
    setError('')
    act(e => hps.reduce((next, hp, i) => addCombatant(next, {
      id: newId(), name: count > 1 ? `${name} ${i + 1}` : name, kind: 'npc', initiative: null,
      initBonus: Number(f.init) || 0, conSave: Number(f.con) || 0, ac: f.ac ? Number(f.ac) : undefined,
      hp: { current: hp, max: hp, temp: 0 },
    }), e))
    setF({ ...f, name: '', count: '1' })
  }

  return (
    <form className="monster-form" onSubmit={submit}>
      <label>Monster or NPC<input required value={f.name} onChange={set('name')} placeholder="Goblin" /></label>
      <label>How many<input inputMode="numeric" value={f.count} onChange={set('count')} /></label>
      <label>HP<input value={f.hp} onChange={set('hp')} placeholder="7 or 2d6" /></label>
      <label>AC<input inputMode="numeric" value={f.ac} onChange={set('ac')} placeholder="15" /></label>
      <label>Init mod<input inputMode="numeric" value={f.init} onChange={set('init')} /></label>
      <label>CON save<input inputMode="numeric" value={f.con} onChange={set('con')} /></label>
      <button className="btn primary" disabled={!f.name.trim()}>Add</button>
      {error && <p className="bad small" role="alert">{error}</p>}
    </form>
  )
}

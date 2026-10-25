// Secret rolls in a party: players roll a check only the DM sees; the DM gets the results log.
import { useEffect, useState } from 'react'
import type { Character } from '../../model/character'
import { ABILITIES, ABILITY_NAMES, ALL_SKILLS, derive, SKILLS, type Ability, type SkillId } from '../../rules'
import { rollCheck, rollSave, rollSkill } from '../character'
import { clearSecretRolls, loadSecretRolls, onSecretRollsChanged, secretView, sendSecretRoll, type SecretRoll } from '../secret'
import type { RollMode } from '../types'
import { RollView } from './RollView'
import './dice.css'

type Choice = `skill:${SkillId}` | `check:${Ability}` | `save:${Ability}`

const SKILL_ORDER = [...ALL_SKILLS].sort((a, b) => SKILLS[a].name.localeCompare(SKILLS[b].name))

interface Props {
  party: { id: string; dmId: string }
  userId: string
  /** The character the viewer brings. Players without one can't roll. */
  character?: Character
  /** Display name for a player's UserProfile id. */
  nameOf: (userId: string) => string
}

export function SecretRolls({ party, userId, character, nameOf }: Props) {
  const [list, setList] = useState<SecretRoll[]>(() => loadSecretRolls(party.id))
  useEffect(() => {
    const load = () => setList(loadSecretRolls(party.id))
    load()
    return onSecretRollsChanged(party.id, load)
  }, [party.id])

  const view = secretView(list, party.dmId, userId)
  if (view.kind === 'dm') return <DmLog partyId={party.id} rolls={view.rolls} nameOf={nameOf} />
  if (!character) return null
  return <SecretRoller partyId={party.id} userId={userId} character={character} sent={view.sent} />
}

function DmLog({ partyId, rolls, nameOf }: { partyId: string; rolls: SecretRoll[]; nameOf: (id: string) => string }) {
  return (
    <section className="panel ff-secret" aria-label="Secret rolls">
      <div className="row spread">
        <div>
          <h3>Secret rolls</h3>
          <p className="muted small">Only you see these results.</p>
        </div>
        {rolls.length > 0 && (
          <button className="btn ghost small" onClick={() => confirm('Clear all secret rolls?') && clearSecretRolls(partyId)}>Clear</button>
        )}
      </div>
      <ol className="ff-secret__list" aria-live="polite">
        {rolls.length === 0 && <li className="muted small">No secret rolls yet. Players can roll a hidden check from this party page.</li>}
        {rolls.map(({ roll, fromUserId }, i) => (
          <li key={roll.id}>
            <span className="muted small">{nameOf(fromUserId)} · {time(roll.timestamp)}</span>
            <RollView roll={roll} compact={i > 0} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function SecretRoller({ partyId, userId, character, sent }: {
  partyId: string
  userId: string
  character: Character
  sent: { id: string; label: string; timestamp: string }[]
}) {
  const [pick, setPick] = useState<Choice>('skill:stealth')
  const [mode, setMode] = useState<RollMode>('normal')

  const roll = () => {
    const stats = derive(character)
    const opts = { character, mode }
    const [kind, key] = pick.split(':') as ['skill' | 'check' | 'save', string]
    const r = kind === 'skill' ? rollSkill(stats, key as SkillId, opts)
      : kind === 'save' ? rollSave(stats, key as Ability, opts)
      : rollCheck(stats, key as Ability, opts)
    sendSecretRoll(partyId, { roll: r, fromUserId: userId })
  }

  return (
    <section className="panel ff-secret" aria-label="Secret roll to the DM">
      <h3>Secret roll</h3>
      <p className="muted small">The DM sees the result. You won't.</p>
      <div className="row">
        <select value={pick} onChange={e => setPick(e.target.value as Choice)} aria-label="What to roll">
          <optgroup label="Skills">
            {SKILL_ORDER.map(s => <option key={s} value={`skill:${s}`}>{SKILLS[s].name}</option>)}
          </optgroup>
          <optgroup label="Ability checks">
            {ABILITIES.map(a => <option key={a} value={`check:${a}`}>{ABILITY_NAMES[a]} check</option>)}
          </optgroup>
          <optgroup label="Saving throws">
            {ABILITIES.map(a => <option key={a} value={`save:${a}`}>{ABILITY_NAMES[a]} save</option>)}
          </optgroup>
        </select>
        <div className="row" role="radiogroup" aria-label="Advantage">
          {(['disadvantage', 'normal', 'advantage'] as const).map(m => (
            <button key={m} type="button" role="radio" aria-checked={mode === m}
              className={`chip ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>
              {m === 'normal' ? 'Normal' : m === 'advantage' ? 'Adv' : 'Dis'}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={roll}>Roll for the DM</button>
      </div>
      {sent.length > 0 && (
        <ol className="ff-secret__list ff-secret__sent" aria-live="polite">
          {sent.slice(0, 5).map(s => (
            <li key={s.id} className="small"><span aria-hidden>🔒</span> {s.label} sent to the DM · <span className="muted">{time(s.timestamp)}</span></li>
          ))}
        </ol>
      )}
    </section>
  )
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

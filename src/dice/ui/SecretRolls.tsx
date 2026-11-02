// Secret rolls in a party: players roll a check only the DM sees; the DM gets the results log.
import { useEffect, useState } from 'react'
import type { Character } from '../../model/character'
import { ABILITIES, ALL_SKILLS, derive, type Ability, type SkillId } from '../../rules'
import { useI18n } from '../../i18n'
import { rollCheck, rollSave, rollSkill } from '../character'
import { loadSecretRolls, onSecretRollsChanged, secretView, type SecretRoll } from '../secret'
import { clearSharedSecretRolls, shareSecretRoll, watchSecretRolls } from '../secretCloud'
import type { RollMode } from '../types'
import { RollView } from './RollView'
import './dice.css'

type Choice = `skill:${SkillId}` | `check:${Ability}` | `save:${Ability}`


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
  // The DM of a cloud party gets players' rolls from the server, live.
  const dm = party.dmId === userId
  useEffect(() => (dm ? watchSecretRolls(party.id) : undefined), [dm, party.id])

  const view = secretView(list, party.dmId, userId)
  if (view.kind === 'dm') return <DmLog partyId={party.id} rolls={view.rolls} nameOf={nameOf} />
  if (!character) return null
  return <SecretRoller partyId={party.id} userId={userId} character={character} sent={view.sent} />
}

function DmLog({ partyId, rolls, nameOf }: { partyId: string; rolls: SecretRoll[]; nameOf: (id: string) => string }) {
  const { t } = useI18n()
  return (
    <section className="glass ff-secret" aria-label={t('secret.title')}>
      <div className="row spread">
        <div>
          <h3>{t('secret.title')}</h3>
          <p className="muted small">{t('secret.onlyYou')}</p>
        </div>
        {rolls.length > 0 && (
          <button className="glass-btn small ghost" onClick={() => confirm(t('secret.clearAsk')) && void clearSharedSecretRolls(partyId)}>{t('dice.clear')}</button>
        )}
      </div>
      <ol className="ff-secret__list" aria-live="polite">
        {rolls.length === 0 && <li className="muted small">{t('secret.none')}</li>}
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
  const { t, skill, ability, abilityShort, locale } = useI18n()
  const skills = [...ALL_SKILLS].sort((a, b) => skill(a).localeCompare(skill(b), locale))
  const labelOf = (kind: string, key: string) => kind === 'skill' ? skill(key as SkillId)
    : kind === 'save' ? t('math.saveTitle', { ability: abilityShort(key as Ability) })
    : t('cs.roll.check', { ability: ability(key as Ability) })

  const roll = () => {
    const stats = derive(character)
    const [kind, key] = pick.split(':') as ['skill' | 'check' | 'save', string]
    const opts = { character, mode, label: labelOf(kind, key) }
    const r = kind === 'skill' ? rollSkill(stats, key as SkillId, opts)
      : kind === 'save' ? rollSave(stats, key as Ability, opts)
      : rollCheck(stats, key as Ability, opts)
    void shareSecretRoll(partyId, { roll: r, fromUserId: userId }).catch(() => {})
  }

  return (
    <section className="glass ff-secret" aria-label={t('secret.rollTitle')}>
      <h3>{t('secret.roll')}</h3>
      <p className="muted small">{t('secret.dmSees')}</p>
      <div className="row">
        <select className="glass-field" value={pick} onChange={e => setPick(e.target.value as Choice)} aria-label={t('secret.what')}>
          <optgroup label={t('secret.skills')}>
            {skills.map(s => <option key={s} value={`skill:${s}`}>{skill(s)}</option>)}
          </optgroup>
          <optgroup label={t('secret.checks')}>
            {ABILITIES.map(a => <option key={a} value={`check:${a}`}>{labelOf('check', a)}</option>)}
          </optgroup>
          <optgroup label={t('secret.saves')}>
            {ABILITIES.map(a => <option key={a} value={`save:${a}`}>{t('math.saveTitle', { ability: ability(a) })}</option>)}
          </optgroup>
        </select>
        <div className="glass-segmented" role="radiogroup" aria-label={t('dice.advantageGroup')}>
          {(['disadvantage', 'normal', 'advantage'] as const).map(m => (
            <button key={m} type="button" role="radio" aria-checked={mode === m}
              onClick={() => setMode(m)}>
              {m === 'normal' ? t('dice.normal') : m === 'advantage' ? t('dice.adv') : t('dice.dis')}
            </button>
          ))}
        </div>
        <button className="glass-btn prominent" onClick={roll}>{t('secret.rollForDm')}</button>
      </div>
      {sent.length > 0 && (
        <ol className="ff-secret__list ff-secret__sent" aria-live="polite">
          {sent.slice(0, 5).map(s => (
            <li key={s.id} className="small"><span aria-hidden>🔒</span> {t('secret.sent', { label: s.label })} · <span className="muted">{time(s.timestamp)}</span></li>
          ))}
        </ol>
      )}
    </section>
  )
}

const time = (iso: string) => new Date(iso).toLocaleTimeString(document.documentElement.lang || [], { hour: '2-digit', minute: '2-digit' })

import { useCallback, useEffect, useState } from 'react'
import { SecretRolls } from '../dice/ui'
import { useI18n } from '../i18n'
import type { Character, UserProfile } from '../model/character'
import { derive, formatMod } from '../rules'
import { HandoutBadge, Handouts } from '../handouts'
import { SessionScheduler } from '../schedule'
import { vitals } from '../sheet/engine'
import { getCharacter, listCharacters, listProfiles, onCharactersChanged } from '../storage'
import { formatCode } from './code'
import { PartyStash } from './PartyStash'
import { chooseCharacter, createParty, getParty, joinParty, leaveParty, listParties, onPartiesChanged } from './store'
import type { Party, PartyMember } from './types'
import './party.css'

/** Parties the player is in, plus create and join. Opens one party's read-only table view. */
export function PartyView({ userId, onOpenCharacter }: { userId: string; onOpenCharacter: (id: string) => void }) {
  const [parties, setParties] = useState<Party[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const { t } = useI18n()

  const refresh = useCallback(() => { listParties(userId).then(setParties) }, [userId])
  useEffect(() => { refresh(); return onPartiesChanged(refresh) }, [refresh])

  if (parties === null) return null
  const open = parties.find(p => p.id === openId)
  if (open) return <PartyTable party={open} userId={userId} onBack={() => setOpenId(null)} onOpenCharacter={onOpenCharacter} />

  return (
    <section className="ff-party">
      <h2>{t('party.yours')}</h2>
      {parties.length === 0
        ? <p className="muted">{t('party.none')}</p>
        : (
          <div className="card-grid">
            {parties.map(p => (
              <button key={p.id} className="panel party-card" onClick={() => setOpenId(p.id)}>
                <h3>{p.name}</h3>
                <span className="muted small">{t('party.members', { count: p.members.length })} · <bdi>{formatCode(p.code)}</bdi></span>
                <HandoutBadge party={p} userId={userId} />
              </button>
            ))}
          </div>
        )}
      <div className="party-forms">
        <CreateForm onCreate={async name => setOpenId((await createParty(name, userId)).id)} />
        <JoinForm userId={userId} onJoined={setOpenId} />
      </div>
    </section>
  )
}

function CreateForm({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  const { t } = useI18n()
  return (
    <form className="panel" onSubmit={e => { e.preventDefault(); if (name.trim()) onCreate(name.trim()) }}>
      <h3>{t('party.start')}</h3>
      <p className="muted small">{t('party.startHelp')}</p>
      <div className="row">
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t('party.name')} aria-label={t('party.name')} />
        <button className="btn primary" disabled={!name.trim()}>{t('party.create')}</button>
      </div>
    </form>
  )
}

function JoinForm({ userId, onJoined }: { userId: string; onJoined: (partyId: string) => void }) {
  const [code, setCode] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [characterId, setCharacterId] = useState('')
  const [error, setError] = useState('')
  const { t } = useI18n()
  useEffect(() => {
    listCharacters(userId).then(list => { setCharacters(list); setCharacterId(list[0]?.id ?? '') })
  }, [userId])

  const submit = async () => {
    const res = await joinParty(code, userId, characterId || undefined)
    if (res.ok) onJoined(res.party.id)
    else setError(t(res.reason === 'invalid' ? 'party.badCode' : 'party.noSuchCode'))
  }

  return (
    <form className="panel" onSubmit={e => { e.preventDefault(); if (code.trim()) submit() }}>
      <h3>{t('party.join')}</h3>
      <div className="field">
        <label htmlFor="join-code">{t('party.inviteCode')}</label>
        <input id="join-code" className="code-input" value={code} maxLength={8} autoComplete="off"
          onChange={e => { setCode(e.target.value); setError('') }} placeholder="ABC-234" />
      </div>
      <div className="field">
        <label htmlFor="join-char">{t('party.bring')}</label>
        <select id="join-char" value={characterId} onChange={e => setCharacterId(e.target.value)}>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">{t('common.watching')}</option>
        </select>
      </div>
      {error && <p className="bad small" role="alert">{error}</p>}
      <button className="btn primary" disabled={!code.trim()}>{t('party.joinButton')}</button>
    </form>
  )
}

function PartyTable({ party: initial, userId, onBack, onOpenCharacter }: {
  party: Party
  userId: string
  onBack: () => void
  onOpenCharacter: (id: string) => void
}) {
  const [party, setParty] = useState(initial)
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [characters, setCharacters] = useState<Record<string, Character | undefined>>({})
  const [mine, setMine] = useState<Character[]>([])
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    const load = () => getParty(initial.id).then(p => { if (p) setParty(p); else onBack() })
    return onPartiesChanged(load)
  }, [initial.id, onBack])

  useEffect(() => {
    let live = true
    const load = async () => {
      const ids = party.members.flatMap(m => (m.characterId ? [m.characterId] : []))
      const list = await Promise.all(ids.map(getCharacter))
      if (live) setCharacters(Object.fromEntries(ids.map((id, i) => [id, list[i]])))
    }
    load()
    listProfiles().then(p => { if (live) setProfiles(p) })
    listCharacters(userId).then(l => { if (live) setMine(l) })
    const off = onCharactersChanged(load)
    return () => { live = false; off() }
  }, [party.members, userId])

  const me = party.members.find(m => m.userId === userId)
  const nameOf = (id: string) => profiles.find(p => p.id === id)?.displayName ?? t('party.unknownPlayer')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatCode(party.code))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked; the code is on screen to read out.
    }
  }

  return (
    <section className="ff-party">
      <div className="party-head">
        <button className="btn ghost" onClick={onBack} aria-label={t('party.backToParties')}>{t('common.backArrow')}</button>
        <div className="grow">
          <h2>{party.name}</h2>
          <p className="muted small">{t('party.dm', { name: nameOf(party.dmId) })}</p>
        </div>
        <div className="invite">
          <span className="muted small">{t('party.inviteCode')}</span>
          <button className="code" dir="ltr" onClick={copy} title={t('party.copyCode')}>{formatCode(party.code)}</button>
          <span className="small muted" aria-live="polite">{copied ? t('party.copied') : ''}</span>
        </div>
      </div>

      <div className="row party-me">
        <label className="small strong" htmlFor="party-char">{t('party.youBring')}</label>
        <select id="party-char" value={me?.characterId ?? ''} onChange={e => chooseCharacter(party.id, userId, e.target.value || undefined)}>
          {mine.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">{t('common.watching')}</option>
        </select>
        <button className="btn ghost small" onClick={() => confirm(t('party.confirmLeave', { name: party.name })) && leaveParty(party.id, userId)}>{t('party.leave')}</button>
      </div>

      <SessionScheduler party={party} userId={userId} nameOf={nameOf} />

      <div className="member-grid">
        {party.members.map(m => (
          <MemberCard
            key={m.userId}
            member={m}
            playerName={nameOf(m.userId)}
            isDm={m.userId === party.dmId}
            character={m.characterId ? characters[m.characterId] : undefined}
            onOpen={m.userId === userId && m.characterId ? () => onOpenCharacter(m.characterId!) : undefined}
          />
        ))}
      </div>

      <SecretRolls party={party} userId={userId} character={me?.characterId ? characters[me.characterId] : undefined} nameOf={nameOf} />
      <PartyStash party={party} userId={userId} nameOf={nameOf} />
      <Handouts party={party} userId={userId} nameOf={nameOf} />
    </section>
  )
}

const VITALS_LABEL = { dying: 'party.vital.dying', stable: 'party.vital.stable', dead: 'party.vital.dead' } as const

function MemberCard({ member, playerName, isDm, character, onOpen }: {
  member: PartyMember
  playerName: string
  isDm: boolean
  character?: Character
  onOpen?: () => void
}) {
  const { t, term, classLine } = useI18n()
  const badge = isDm && <span className="badge">{t('party.dmBadge')}</span>
  if (!member.characterId || !character) {
    return (
      <article className="panel member watching">
        <div className="who"><strong>{playerName}</strong> {badge}</div>
        <p className="muted small">{t(member.characterId ? 'party.notFound' : 'party.watching')}</p>
      </article>
    )
  }

  const s = derive(character)
  const { currentHp, tempHp, conditions, exhaustion } = character.state
  const pct = s.maxHp ? Math.max(0, Math.min(100, (currentHp / s.maxHp) * 100)) : 0
  const tone = pct > 50 ? 'ok' : pct > 25 ? 'hurt' : 'low'
  const v = vitals(character)
  const classes = classLine(character.classes)

  return (
    <article className="panel member">
      <header>
        {character.portrait ? <img src={character.portrait} alt="" /> : <div className="portrait-empty">{character.name.slice(0, 1)}</div>}
        <div className="grow">
          <h3>{character.name}</h3>
          <p className="muted small">{classes} · {playerName} {badge}</p>
        </div>
      </header>

      <div className="hp" aria-label={t(tempHp ? 'party.hpLabelTemp' : 'party.hpLabel', { hp: currentHp, max: s.maxHp, temp: tempHp })}>
        <div className="hp-text">
          <span><strong>{currentHp}</strong> / {s.maxHp} {t('stat.hp')}</span>
          {tempHp > 0 && <span className="temp">{t('party.tempShort', { temp: tempHp })}</span>}
          {v !== 'healthy' && <span className={`vital ${v}`}>{t(VITALS_LABEL[v])}</span>}
        </div>
        <div className="bar"><div className={`fill ${tone}`} style={{ width: `${pct}%` }} /></div>
      </div>

      <dl className="stats">
        <div><dt>{t('stat.ac')}</dt><dd>{s.armorClass.value}</dd></div>
        <div><dt>{t('stat.init')}</dt><dd>{formatMod(s.initiative)}</dd></div>
        <div><dt>{t('stat.speed')}</dt><dd>{s.speed}</dd></div>
        <div><dt>{t('stat.passivePerception')}</dt><dd>{s.passivePerception}</dd></div>
        {s.spellcasting && <div><dt>{t('stat.spellDc')}</dt><dd>{s.spellcasting.saveDc}</dd></div>}
      </dl>

      {(conditions.length > 0 || exhaustion > 0) && (
        <ul className="conds">
          {conditions.map(c => <li key={c}>{term('condition', c, c)}</li>)}
          {exhaustion > 0 && <li>{t('party.exhaustion', { level: exhaustion })}</li>}
        </ul>
      )}

      {onOpen && <button className="btn small" onClick={onOpen}>{t('party.openMine')}</button>}
    </article>
  )
}

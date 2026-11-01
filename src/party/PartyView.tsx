import { useCallback, useEffect, useState } from 'react'
import { getCloudAccountId } from '../cloud'
import { SecretRolls } from '../dice/ui'
import { useI18n } from '../i18n'
import type { Character, UserProfile } from '../model/character'
import { derive, formatMod } from '../rules'
import { Codex, HandoutBadge } from '../lore'
import { SessionScheduler } from '../schedule'
import { vitals } from '../sheet/engine'
import { getCharacter, listCharacters, listProfiles, onCharactersChanged } from '../storage'
import { fetchAccountNames, fetchPartyCharacters, watchPartyCharacters } from './cloud'
import { canWatchSheets, markPicked } from './active'
import { CampaignManage } from './CampaignsHome'
import { formatCode } from './code'
import { PartyStash } from './PartyStash'
import { GiveXp } from './GiveXp'
import { RollFeed } from './RollFeed'
import { chooseCharacter, createParty, getParty, joinParty, listParties, onPartiesChanged } from './store'
import type { Party, PartyMember } from './types'
import './party.css'

/** Parties the player is in, plus create and join. Opens one party's read-only table view.
 *  The campaigns home opens it on one party (openId) or straight on start/join (startWith). */
export function PartyView({ userId, onOpenCharacter, onWatchCharacter, openId: initialOpen, startWith, onRoute }: {
  userId: string
  onOpenCharacter: (id: string) => void
  /** Opens another member's sheet view only (the DM and the admin). */
  onWatchCharacter?: (id: string) => void
  openId?: string
  startWith?: 'start' | 'join'
  /** Puts the open party in the URL (#/party/<id>), so refresh and back keep it. `replace` for a just-made party. */
  onRoute?: (partyId: string | null, replace?: boolean) => void
}) {
  const [parties, setParties] = useState<Party[] | null>(null)
  const [openId, setOpenIdState] = useState<string | null>(initialOpen ?? null)
  const [newParty, setNewParty] = useState(!!startWith)
  const { t } = useI18n()
  // The URL is the source when it changes (back button); local state covers screens without routing.
  const [route, setRoute] = useState({ initialOpen, startWith })
  if (route.initialOpen !== initialOpen || route.startWith !== startWith) {
    setRoute({ initialOpen, startWith })
    setOpenIdState(initialOpen ?? null)
    if (startWith) setNewParty(true)
  }
  const setOpenId = (id: string | null, replace?: boolean) => {
    setOpenIdState(id)
    onRoute?.(id, replace)
  }

  const refresh = useCallback(() => { listParties(userId).then(setParties) }, [userId])
  useEffect(() => { refresh(); return onPartiesChanged(refresh) }, [refresh])

  if (parties === null) return null
  const open = parties.find(p => p.id === openId)
  if (open) return <PartyTable party={open} userId={userId} onBack={() => setOpenId(null)} onOpenCharacter={onOpenCharacter} onWatchCharacter={onWatchCharacter} />

  return (
    <section className="ff-party">
      <h2 className="glass-title">{t('party.yours')}</h2>
      {parties.length === 0
        ? <p className="muted">{t('party.none')}</p>
        : (
          <div className="card-grid">
            {parties.map(p => (
              <button key={p.id} className="glass party-card" onClick={() => setOpenId(p.id)}>
                <h3>{p.name}</h3>
                <span className="muted small">{t('party.members', { count: p.members.length })} · <bdi>{formatCode(p.code)}</bdi></span>
                <HandoutBadge party={p} userId={userId} />
              </button>
            ))}
          </div>
        )}
      {/* Your parties come first; start or join sit behind one "New party" button. */}
      {newParty
        ? <NewParty userId={userId} mode={startWith} onClose={() => setNewParty(false)} onOpen={id => { markPicked(userId); setNewParty(false); setOpenId(id, true) }} />
        : <button className="glass-btn party-new" onClick={() => setNewParty(true)}>{t('party.new')}</button>}
    </section>
  )
}

/** One panel for a new party: pick start or join, then fill in that form. */
function NewParty({ userId, mode: initialMode = 'start', onClose, onOpen }: { userId: string; mode?: 'start' | 'join'; onClose: () => void; onOpen: (partyId: string) => void }) {
  const [mode, setMode] = useState<'start' | 'join'>(initialMode)
  const { t } = useI18n()
  return (
    <div className="glass party-form" role="group" aria-label={t('party.newTitle')}>
      <div className="party-form-head">
        <h3 className="grow">{t('party.newTitle')}</h3>
        <button className="glass-btn small ghost" onClick={onClose}>{t('common.cancel')}</button>
      </div>
      <div className="glass-segmented" role="radiogroup" aria-label={t('party.newTitle')}>
        <button role="radio" aria-checked={mode === 'start'} onClick={() => setMode('start')}>{t('party.start')}</button>
        <button role="radio" aria-checked={mode === 'join'} onClick={() => setMode('join')}>{t('party.join')}</button>
      </div>
      {mode === 'start'
        ? <CreateForm userId={userId} onCreate={async (name, dmId) => onOpen((await createParty(name, userId, dmId)).id)} />
        : <JoinForm userId={userId} onJoined={onOpen} />}
    </div>
  )
}

/** Who can run the party: every account for the signed-in account, else the profiles on this device. */
function useDmChoices(userId: string) {
  const [choices, setChoices] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    let live = true
    const load = async () => {
      if (getCloudAccountId() === userId) {
        const names = await fetchAccountNames()
        if (Object.keys(names).length) return Object.entries(names).map(([id, name]) => ({ id, name }))
      }
      return (await listProfiles()).map(p => ({ id: p.id, name: p.displayName }))
    }
    load().then(list => { if (live) setChoices(list.sort((a, b) => Number(b.id === userId) - Number(a.id === userId) || a.name.localeCompare(b.name))) })
    return () => { live = false }
  }, [userId])
  return choices
}

function CreateForm({ userId, onCreate }: { userId: string; onCreate: (name: string, dmId: string) => void }) {
  const [name, setName] = useState('')
  const [dmId, setDmId] = useState('')
  const choices = useDmChoices(userId)
  const { t } = useI18n()
  const ready = !!name.trim() && !!dmId
  return (
    <form className="party-form-body" onSubmit={e => { e.preventDefault(); if (ready) onCreate(name.trim(), dmId) }}>
      <p className="muted small">{t('party.startHelp')}</p>
      <div className="field">
        <label htmlFor="party-name">{t('party.name')}</label>
        <input id="party-name" autoFocus className="glass-field" value={name} onChange={e => setName(e.target.value)} placeholder={t('party.name')} />
      </div>
      <div className="field">
        <label htmlFor="party-dm">{t('party.chooseDm')}</label>
        <select id="party-dm" className="glass-field" value={dmId} onChange={e => setDmId(e.target.value)} required>
          <option value="" disabled>{t('party.chooseDmPlaceholder')}</option>
          {choices.map(c => <option key={c.id} value={c.id}>{c.id === userId ? t('party.dmMe', { name: c.name }) : c.name}</option>)}
        </select>
      </div>
      <button className="glass-btn prominent" disabled={!ready}>{t('party.create')}</button>
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
    else setError(t(res.reason === 'invalid' ? 'party.badCode' : res.reason === 'offline' ? 'party.joinOffline' : res.reason === 'tooMany' ? 'party.joinTooMany' : 'party.noSuchCode'))
  }

  return (
    <form className="party-form-body" onSubmit={e => { e.preventDefault(); if (code.trim()) submit() }}>
      <div className="field">
        <label htmlFor="join-code">{t('party.inviteCode')}</label>
        <input id="join-code" autoFocus className="glass-field code-input" value={code} maxLength={8} autoComplete="off"
          onChange={e => { setCode(e.target.value); setError('') }} placeholder="ABC-234" />
      </div>
      <div className="field">
        <label htmlFor="join-char">{t('party.bring')}</label>
        <select id="join-char" className="glass-field" value={characterId} onChange={e => setCharacterId(e.target.value)}>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">{t('common.watching')}</option>
        </select>
      </div>
      {error && <p className="bad small" role="alert">{error}</p>}
      <button className="glass-btn prominent" disabled={!code.trim()}>{t('party.joinButton')}</button>
    </form>
  )
}

function PartyTable({ party: initial, userId, onBack, onOpenCharacter, onWatchCharacter }: {
  party: Party
  userId: string
  onBack: () => void
  onOpenCharacter: (id: string) => void
  onWatchCharacter?: (id: string) => void
}) {
  const [party, setParty] = useState(initial)
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [characters, setCharacters] = useState<Record<string, Character | undefined>>({})
  const [mine, setMine] = useState<Character[]>([])
  const [accountNames, setAccountNames] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    const load = () => getParty(initial.id).then(p => { if (p) setParty(p); else onBack() })
    return onPartiesChanged(load)
  }, [initial.id, onBack])

  useEffect(() => {
    let live = true
    const ids = party.members.flatMap(m => (m.characterId ? [m.characterId] : []))
    const load = async () => {
      const list = await Promise.all(ids.map(getCharacter))
      // Other members' characters aren't on this device: read them from the cloud party.
      const missing = ids.filter((_, i) => !list[i])
      const remote = new Map((await fetchPartyCharacters(missing)).map(c => [c.id, c]))
      if (live) setCharacters(Object.fromEntries(ids.map((id, i) => [id, list[i] ?? remote.get(id)])))
    }
    load()
    listProfiles().then(p => { if (live) setProfiles(p) })
    fetchAccountNames().then(n => { if (live) setAccountNames(n) })
    listCharacters(userId).then(l => { if (live) setMine(l) })
    const off = onCharactersChanged(load)
    const offRemote = watchPartyCharacters(ids, load)
    return () => { live = false; off(); offRemote() }
  }, [party.members, userId])

  const me = party.members.find(m => m.userId === userId)
  const nameOf = (id: string) => profiles.find(p => p.id === id)?.displayName ?? accountNames[id] ?? t('party.unknownPlayer')
  // The DM (and the admin) open every member's sheet, view only; a player opens only their own.
  const watcher = !!onWatchCharacter && canWatchSheets(party, userId)
  const openFor = (m: PartyMember) => {
    if (!m.characterId) return undefined
    if (m.userId === userId) return () => onOpenCharacter(m.characterId!)
    return watcher ? () => onWatchCharacter!(m.characterId!) : undefined
  }
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
        <button className="glass-btn icon" onClick={onBack} aria-label={t('party.backToParties')}>{t('common.backArrow')}</button>
        <div className="grow">
          <h2 className="glass-title">{party.name}</h2>
          <p className="muted small">{t('party.dm', { name: nameOf(party.dmId) })}</p>
        </div>
        <div className="invite">
          <span className="glass-eyebrow">{t('party.inviteCode')}</span>
          <button className="code" dir="ltr" onClick={copy} title={t('party.copyCode')}>{formatCode(party.code)}</button>
          <span className="small muted" aria-live="polite">{copied ? t('party.copied') : ''}</span>
        </div>
      </div>

      <div className="glass thin party-me">
        <label className="small strong" htmlFor="party-char">{t('party.youBring')}</label>
        <select id="party-char" className="glass-field" value={me?.characterId ?? ''} onChange={e => chooseCharacter(party.id, userId, e.target.value || undefined)}>
          {mine.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">{t('common.watching')}</option>
        </select>
        <CampaignManage party={party} userId={userId} />
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
            mine={m.userId === userId}
            onOpen={openFor(m)}
          />
        ))}
      </div>

      {/* Lore sits right under the party so players find what the DM revealed without scrolling past the stash. */}
      <Codex party={party} userId={userId} nameOf={nameOf} />

      <GiveXp party={party} userId={userId} characters={characters} nameOf={nameOf} />
      <RollFeed party={party} nameOf={nameOf} />
      <SecretRolls party={party} userId={userId} character={me?.characterId ? characters[me.characterId] : undefined} nameOf={nameOf} />
      <PartyStash party={party} userId={userId} nameOf={nameOf} />
    </section>
  )
}

const VITALS_LABEL = { dying: 'party.vital.dying', stable: 'party.vital.stable', dead: 'party.vital.dead' } as const

function MemberCard({ member, playerName, isDm, character, mine, onOpen }: {
  member: PartyMember
  playerName: string
  isDm: boolean
  character?: Character
  mine: boolean
  onOpen?: () => void
}) {
  const { t, term, classLine } = useI18n()
  const badge = isDm && <span className="badge">{t('party.dmBadge')}</span>
  if (!member.characterId || !character) {
    return (
      <article className="glass thin member watching">
        <div className="who"><strong>{playerName}</strong> {badge}</div>
        <p className="muted small">{t(member.characterId ? 'party.notFound' : 'party.watching')}</p>
      </article>
    )
  }

  const s = derive(character)
  const { currentHp, tempHp, conditions } = character.state
  const pct = s.maxHp ? Math.max(0, Math.min(100, (currentHp / s.maxHp) * 100)) : 0
  const tone = pct > 50 ? 'ok' : pct > 25 ? 'hurt' : 'low'
  const v = vitals(character)
  const classes = classLine(character.classes)

  return (
    <article className="glass member">
      <header>
        {character.portrait ? <img src={character.portrait} alt="" /> : <div className="portrait-empty">{character.name.slice(0, 1)}</div>}
        <div className="grow">
          <h3 className="member-name">{character.name}</h3>
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

      {conditions.length > 0 && (
        <ul className="conds">
          {conditions.map(c => <li key={c}>{term('condition', c, c)}</li>)}
        </ul>
      )}

      {onOpen && <button className="glass-btn small" onClick={onOpen}>{mine ? t('party.openMine') : t('party.openTheirs', { name: playerName })}</button>}
    </article>
  )
}

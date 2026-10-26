// Player requests to the DM: the player's "Ask the DM" page, the DM's Requests tab and story reminders,
// and RequestsAgent, which opens request links and adds granted requests to characters.
import { useEffect, useId, useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import { EffectsEditor, effectText } from '../inventory'
import type { Character, CustomAction } from '../model/character'
import { derive, type Ability, type ItemEffect } from '../rules'
import { resolveDice } from '../sheet/combat/combat'
import { listCharacters } from '../storage'
import { applyGrants } from './grants'
import {
  answered, codeFrom, hasMechanics, decide, decodeShared, DETAILS_MAX, inbox, linkFor, mergeShared, mine, newRequest, problems, reminders,
  removeRequest, setStoryNote, TITLE_MAX, type MergeOutcome, type Shared,
} from './logic'
import { useRequests } from './hooks'
import { onRequestsChanged, updateRequests } from './store'
import { REQUEST_KINDS, type DmRequest, type RequestKind, type RequestStatus } from './types'
import '../sheet/sheet.css'
import './requests.css'

const KIND_KEYS: Record<RequestKind, MessageKey> = {
  item: 'req.kind.item', effect: 'req.kind.effect', ability: 'req.kind.ability', other: 'req.kind.other',
}
const KIND_HINTS: Record<RequestKind, MessageKey> = {
  item: 'req.kindHint.item', effect: 'req.kindHint.effect', ability: 'req.kindHint.ability', other: 'req.kindHint.other',
}
const STATUS_KEYS: Record<RequestStatus, MessageKey> = {
  pending: 'req.status.pending', later: 'req.status.later', granted: 'req.status.granted', denied: 'req.status.denied',
}

const nowIso = () => new Date().toISOString()
const pageBase = () => `${location.origin}${location.pathname}`

async function importShared(s: Shared): Promise<MergeOutcome> {
  let outcome: MergeOutcome = 'same'
  await updateRequests(list => {
    const merged = mergeShared(list, s)
    outcome = merged.outcome
    return merged.list
  })
  return outcome
}

function importMessage(s: Shared, outcome: MergeOutcome): MessageKey {
  if (s.type === 'request') return outcome === 'added' ? 'req.got.request' : 'req.got.requestAgain'
  return outcome === 'added' || outcome === 'updated' ? 'req.got.answer' : 'req.got.answerAgain'
}

// ---------- Links ----------

/** Shares a request or an answer as a link: the phone's share sheet, else the clipboard, else a box to copy from. */
function ShareLink({ type, request, primary }: { type: Shared['type']; request: DmRequest; primary?: boolean }) {
  const { t } = useI18n()
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const url = linkFor(pageBase(), type, request)
  const label = type === 'request' ? t('req.shareRequest') : t('req.shareAnswer', { name: request.fromName })

  const share = async () => {
    const text = type === 'request'
      ? t('req.shareText.request', { name: request.fromName, title: request.title })
      : t('req.shareText.answer', { title: request.title })
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Forge & Familiar', text, url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      setState('manual')
    }
  }

  return (
    <div className="req-share">
      <button type="button" className={`btn small ${primary ? 'primary' : ''}`} onClick={share}>{label}</button>
      {state === 'copied' && <span className="hint" role="status">{t('req.copied')}</span>}
      {state === 'manual' && (
        <input className="req-link" readOnly value={url} dir="ltr" aria-label={t('req.linkLabel')} onFocus={e => e.currentTarget.select()} autoFocus />
      )}
    </div>
  )
}

/** For links that opened in a different browser: paste them here. */
function PasteLink({ label }: { label: string }) {
  const { t } = useI18n()
  const id = useId()
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const open = async () => {
    const code = codeFrom(text)
    const s = code ? decodeShared(code) : null
    if (!s) { setMsg(t('req.badLink')); return }
    setMsg(t(importMessage(s, await importShared(s)), { name: s.request.fromName, title: s.request.title }))
    setText('')
  }
  return (
    <form className="req-paste" onSubmit={e => { e.preventDefault(); open() }}>
      <label htmlFor={id} className="hint">{label}</label>
      <div className="req-row">
        <input id={id} value={text} onChange={e => { setText(e.target.value); setMsg(null) }} dir="ltr" placeholder="https://…" />
        <button className="btn small" disabled={!text.trim()}>{t('req.openLink')}</button>
      </div>
      {msg && <p className="hint" role="status">{msg}</p>}
    </form>
  )
}

/**
 * Mounted once in the app. Opens request links (#ff-request=…) into this device's list and tells
 * the app which page to show, and adds granted requests to this player's characters.
 */
export function RequestsAgent({ userId, onOpen }: { userId: string; onOpen: (type: Shared['type']) => void }) {
  const { t } = useI18n()
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const read = async () => {
      const code = codeFrom(location.hash)
      if (!code) return
      history.replaceState(null, '', `${location.pathname}${location.search}`)
      const s = decodeShared(code)
      if (!s) { setNotice(t('req.badLink')); return }
      setNotice(t(importMessage(s, await importShared(s)), { name: s.request.fromName, title: s.request.title }))
      onOpen(s.type)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [t, onOpen])

  useEffect(() => {
    const run = () => {
      applyGrants(userId).then(done => {
        if (done.length) setNotice(done.map(r => t('req.addedTo', { title: r.title, character: r.characterName })).join(' '))
      })
    }
    run()
    return onRequestsChanged(run)
  }, [userId, t])

  if (!notice) return null
  return (
    <div className="req-notice" role="status">
      <span>{notice}</span>
      <button type="button" className="btn ghost small" onClick={() => setNotice(null)} aria-label={t('req.dismiss')}>✕</button>
    </div>
  )
}

// ---------- Player: Ask the DM ----------

export function RequestsView({ userId, userName }: { userId: string; userName: string }) {
  const { t } = useI18n()
  const list = useRequests()
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [justSent, setJustSent] = useState<string | null>(null)
  useEffect(() => { listCharacters(userId).then(setCharacters) }, [userId])
  if (!list || !characters) return null
  const own = mine(list, userId)

  return (
    <div className="ff-sheet ff-requests">
      <RequestForm characters={characters} userId={userId} userName={userName} onSent={setJustSent} />
      <section className="card" aria-labelledby="req-mine">
        <h2 id="req-mine">{t('req.mine')}</h2>
        {own.length === 0 ? <p className="hint">{t('req.mineEmpty')}</p> : (
          <ul className="plain req-list">
            {own.map(r => (
              <li key={r.id} className={`req-card st-${r.status} ${r.id === justSent ? 'fresh' : ''}`}>
                <RequestHead r={r} />
                {r.details && <p className="req-details" dir="auto">{r.details}</p>}
                <Mechanics r={r} />
                <p className={`req-status st-${r.status}`}>
                  {r.status === 'granted' && !r.applied ? t('req.status.grantedElsewhere', { character: r.characterName }) : t(STATUS_KEYS[r.status], { character: r.characterName })}
                </p>
                {r.reply && <p className="req-reply"><span className="sub-title">{t('req.dmSays')}</span> <bdi>{r.reply}</bdi></p>}
                <div className="req-actions">
                  {r.status === 'pending' && <ShareLink type="request" request={r} primary={r.id === justSent} />}
                  <button type="button" className="btn ghost small" onClick={() => updateRequests(l => removeRequest(l, r.id))}>
                    {r.status === 'pending' ? t('req.withdraw') : t('req.clear')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <PasteLink label={t('req.pasteAnswer')} />
      </section>
    </div>
  )
}

function RequestForm({ characters, userId, userName, onSent }: {
  characters: Character[]; userId: string; userName: string; onSent: (id: string) => void
}) {
  const { t } = useI18n()
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? '')
  const [kind, setKind] = useState<RequestKind>('item')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [roll, setRoll] = useState<NonNullable<CustomAction['roll']>>({})
  const [extra, setExtra] = useState({ damage: '', type: '' })
  const [stats, setStats] = useState<ItemEffect[]>([])
  const [tried, setTried] = useState(false)
  const character = characters.find(x => x.id === characterId)
  const derived = character ? derive(character) : undefined
  const bad = (dice?: string) => !!dice?.trim() && !!derived && !resolveDice(dice, derived)
  const diceBad = bad(roll.dice)
  const extraBad = bad(extra.damage)
  const issues = problems({ characterId, title })

  const send = async () => {
    setTried(true)
    if (issues.length || diceBad || extraBad || !character) return
    const r = newRequest({
      fromId: userId, fromName: userName, characterId, characterName: character.name, kind, title, details,
      roll, extraDamage: extra, stats,
    }, crypto.randomUUID(), nowIso())
    await updateRequests(l => [...l, r])
    setTitle(''); setDetails(''); setRoll({}); setExtra({ damage: '', type: '' }); setStats([]); setTried(false)
    onSent(r.id)
  }

  return (
    <section className="card req-form" aria-labelledby="req-title">
      <h1 id="req-title">{t('req.title')}</h1>
      <p className="hint">{t('req.intro')}</p>
      {characters.length === 0 ? <p className="hint">{t('req.noCharacters')}</p> : (
        <form onSubmit={e => { e.preventDefault(); send() }}>
          {characters.length > 1 && (
            <label className="req-field">
              <span className="sub-title">{t('req.character')}</span>
              <select value={characterId} onChange={e => setCharacterId(e.target.value)}>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <fieldset className="req-field req-kinds">
            <legend className="sub-title">{t('req.kind')}</legend>
            {REQUEST_KINDS.map(k => (
              <label key={k} className={`chip ${kind === k ? 'on' : ''}`}>
                <input type="radio" name="req-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {t(KIND_KEYS[k])}
              </label>
            ))}
            <p className="hint">{t(KIND_HINTS[kind])}</p>
          </fieldset>
          <label className="req-field">
            <span className="sub-title">{t('req.what')}</span>
            <input value={title} maxLength={TITLE_MAX} onChange={e => setTitle(e.target.value)} placeholder={t('req.whatPlaceholder')}
              aria-invalid={tried && issues.includes('noTitle')} />
          </label>
          {tried && issues.includes('noTitle') && <p className="req-error" role="alert">{t('req.needTitle')}</p>}
          <label className="req-field">
            <span className="sub-title">{t('req.why')}</span>
            <textarea rows={4} maxLength={DETAILS_MAX} value={details} onChange={e => setDetails(e.target.value)} placeholder={t('req.whyPlaceholder')} />
          </label>

          <fieldset className="req-field req-box">
            <legend className="sub-title">{t('cs.form.roll')}</legend>
            <div className="req-grid">
              <label>{t('cs.form.check')}
                <select value={roll.check ?? 'none'} onChange={e => {
                  const check = e.target.value === 'none' ? undefined : (e.target.value as 'attack' | 'save')
                  setRoll(r => ({ ...r, check, ability: check ? r.ability ?? 'str' : undefined, save: check === 'save' ? r.save ?? 'wis' : undefined }))
                }}>
                  <option value="none">{t('cs.form.checkNone')}</option>
                  <option value="attack">{t('cs.form.checkAttack')}</option>
                  <option value="save">{t('cs.form.checkSave')}</option>
                </select>
              </label>
              {roll.check && <AbilityPick label={t('cs.form.ability')} value={roll.ability ?? 'str'} onChange={ability => setRoll(r => ({ ...r, ability }))} />}
              {roll.check === 'save' && <AbilityPick label={t('cs.form.saveAbility')} value={roll.save ?? 'wis'} onChange={save => setRoll(r => ({ ...r, save }))} />}
              <label>{t('cs.form.dice')}
                <input value={roll.dice ?? ''} onChange={e => setRoll(r => ({ ...r, dice: e.target.value }))} placeholder="2d6+STR" dir="ltr" aria-invalid={diceBad} />
              </label>
              <label>{t('cs.form.type')}
                <input value={roll.type ?? ''} onChange={e => setRoll(r => ({ ...r, type: e.target.value }))} placeholder={t('cs.form.typePlaceholder')} />
              </label>
            </div>
            <p className="hint">{diceBad ? t('cs.form.diceBad') : t('cs.form.diceHint')}</p>
          </fieldset>

          <fieldset className="req-field req-box">
            <legend className="sub-title">{t('req.extraDamage')}</legend>
            <div className="req-grid">
              <label>{t('cs.form.effectDice')}
                <input value={extra.damage} onChange={e => setExtra(x => ({ ...x, damage: e.target.value }))} placeholder="1d6" dir="ltr" aria-invalid={extraBad} />
              </label>
              <label>{t('cs.form.type')}
                <input value={extra.type} onChange={e => setExtra(x => ({ ...x, type: e.target.value }))} placeholder={t('cs.form.typePlaceholder')} />
              </label>
            </div>
            <p className="hint">{extraBad ? t('cs.form.diceBad') : t('req.extraDamageHint')}</p>
          </fieldset>

          <div className="req-field req-box">
            <EffectsEditor effects={stats} onChange={setStats} legend={t('req.stats')} />
            <p className="hint">{t('req.statsHint')}</p>
          </div>

          <button className="btn primary" disabled={diceBad || extraBad}>{t('req.send')}</button>
        </form>
      )}
    </section>
  )
}

function AbilityPick({ label, value, onChange }: { label: string; value: Ability; onChange: (a: Ability) => void }) {
  const { abilityShort } = useI18n()
  return (
    <label>{label}
      <select value={value} onChange={e => onChange(e.target.value as Ability)}>
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map(a => <option key={a} value={a}>{abilityShort(a)}</option>)}
      </select>
    </label>
  )
}

/** The roll, extra damage and stat changes of a request, one short line each. */
function Mechanics({ r }: { r: DmRequest }) {
  const i18n = useI18n()
  const { t, abilityShort } = i18n
  if (!hasMechanics(r)) return null
  const roll = r.roll
  const first = roll?.check === 'attack'
    ? t('req.m.attack', { ability: abilityShort(roll.ability ?? 'str') })
    : roll?.check === 'save'
      ? t('req.m.save', { ability: abilityShort(roll.ability ?? 'str'), save: abilityShort(roll.save ?? 'wis') })
      : ''
  return (
    <ul className="plain req-mech">
      {roll && (
        <li><span className="sub-title">{t('req.m.roll')}</span> {first}{first && roll.dice ? ', ' : ''}
          {roll.dice && <bdi dir="ltr">{roll.dice}</bdi>}{roll.type ? ` ${roll.type}` : ''}</li>
      )}
      {r.extraDamage && (
        <li><span className="sub-title">{t('req.m.extra')}</span> <bdi dir="ltr">+{r.extraDamage.damage}</bdi>{r.extraDamage.type ? ` ${r.extraDamage.type}` : ''}</li>
      )}
      {r.stats?.length ? (
        <li><span className="sub-title">{t('req.m.stats')}</span> <bdi>{r.stats.map(f => effectText(i18n, f)).join(' · ')}</bdi></li>
      ) : null}
    </ul>
  )
}

function RequestHead({ r, showWho }: { r: DmRequest; showWho?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="req-head">
      <span className="req-kind">{t(KIND_KEYS[r.kind])}</span>
      <h3 dir="auto">{r.title}</h3>
      <span className="hint req-who">
        {showWho ? t('req.from', { name: r.fromName, character: r.characterName }) : r.characterName}
      </span>
    </div>
  )
}

// ---------- DM: requests tab and story reminders ----------

/** The DM's Requests tab: new requests to answer, the "later" list, and past answers. */
export function DmRequestsTab({ list }: { list: DmRequest[] }) {
  const { t } = useI18n()
  const waiting = inbox(list)
  const later = reminders(list)
  const done = answered(list)
  return (
    <>
      <section className="card" aria-labelledby="req-inbox">
        <h2 id="req-inbox">{t('req.inbox', { count: waiting.length })}</h2>
        {waiting.length === 0 ? <p className="hint">{t('req.inboxEmpty')}</p> : (
          <ul className="plain req-list">{waiting.map(r => <InboxCard key={r.id} r={r} />)}</ul>
        )}
        <PasteLink label={t('req.pasteRequest')} />
      </section>
      <section className="card" aria-labelledby="req-later">
        <h2 id="req-later">{t('req.later')}</h2>
        <p className="hint">{t('req.laterHelp')}</p>
        {later.length === 0 ? <p className="hint">{t('req.laterEmpty')}</p> : (
          <ul className="plain req-list">{later.map(r => <LaterCard key={r.id} r={r} />)}</ul>
        )}
      </section>
      {done.length > 0 && (
        <section className="card" aria-labelledby="req-done">
          <h2 id="req-done">{t('req.answered')}</h2>
          <ul className="plain req-list">
            {done.map(r => (
              <li key={r.id} className={`req-card st-${r.status}`}>
                <RequestHead r={r} showWho />
                <p className={`req-status st-${r.status}`}>{t(r.status === 'granted' ? 'req.dm.granted' : 'req.dm.denied')}</p>
                {r.reply && <p className="req-reply"><span className="sub-title">{t('req.yourReply')}</span> <bdi>{r.reply}</bdi></p>}
                <div className="req-actions">
                  <ShareLink type="answer" request={r} />
                  <button type="button" className="btn ghost small" onClick={() => updateRequests(l => decide(l, r.id, 'pending', nowIso()))}>{t('req.undo')}</button>
                  <button type="button" className="btn ghost small" onClick={() => updateRequests(l => removeRequest(l, r.id))}>{t('req.clear')}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function InboxCard({ r }: { r: DmRequest }) {
  const { t } = useI18n()
  const id = useId()
  const [reply, setReply] = useState('')
  const answer = (status: RequestStatus) => updateRequests(l => decide(l, r.id, status, nowIso(), reply))
  return (
    <li className="req-card st-pending">
      <RequestHead r={r} showWho />
      {r.details && <p className="req-details" dir="auto">{r.details}</p>}
      <Mechanics r={r} />
      <label htmlFor={id} className="sub-title">{t('req.replyLabel')}</label>
      <textarea id={id} rows={2} maxLength={DETAILS_MAX} value={reply} onChange={e => setReply(e.target.value)} placeholder={t('req.replyPlaceholder')} />
      <div className="req-actions">
        <button type="button" className="btn primary small" onClick={() => answer('later')}>{t('req.approveLater')}</button>
        <button type="button" className="btn small" onClick={() => answer('granted')}>{t('req.grantNow')}</button>
        <button type="button" className="btn ghost small" onClick={() => answer('denied')}>{t('req.deny')}</button>
      </div>
    </li>
  )
}

function LaterCard({ r }: { r: DmRequest }) {
  const { t } = useI18n()
  const id = useId()
  const [note, setNote] = useState(r.storyNote ?? '')
  return (
    <li className="req-card st-later">
      <RequestHead r={r} showWho />
      {r.details && <p className="req-details" dir="auto">{r.details}</p>}
      <Mechanics r={r} />
      <label htmlFor={id} className="sub-title">{t('req.storyNote')}</label>
      <textarea id={id} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={t('req.storyNotePlaceholder')}
        onBlur={() => { if (note !== (r.storyNote ?? '')) updateRequests(l => setStoryNote(l, r.id, note)) }} />
      <div className="req-actions">
        <button type="button" className="btn primary small" onClick={() => updateRequests(l => decide(l, r.id, 'granted', nowIso()))}>{t('req.grantNow')}</button>
        <ShareLink type="answer" request={r} />
        <button type="button" className="btn ghost small" onClick={() => updateRequests(l => decide(l, r.id, 'denied', nowIso()))}>{t('req.drop')}</button>
      </div>
    </li>
  )
}

/** Small reminders of approved ideas, on top of the DM screen while they play. */
export function StoryReminders({ list, onOpen }: { list: DmRequest[]; onOpen: () => void }) {
  const { t } = useI18n()
  const later = reminders(list)
  const fresh = inbox(list).length
  const [granted, setGranted] = useState<DmRequest | null>(null)
  if (later.length === 0 && fresh === 0 && !granted) return null

  const grant = async (r: DmRequest) => {
    const now = nowIso()
    const next = await updateRequests(l => decide(l, r.id, 'granted', now))
    setGranted(next.find(x => x.id === r.id) ?? null)
  }

  return (
    <section className="card req-reminders" aria-labelledby="req-reminders">
      <div className="card-head">
        <h2 id="req-reminders">{t('req.reminders')}</h2>
        <button type="button" className="btn small" onClick={onOpen}>
          {fresh ? t('req.newCount', { count: fresh }) : t('req.manage')}
        </button>
      </div>
      {granted && (
        <div className="req-granted" role="status">
          <span>{t('req.grantedNow', { title: granted.title, name: granted.fromName })}</span>
          <ShareLink type="answer" request={granted} primary />
          <button type="button" className="btn ghost small" onClick={() => setGranted(null)} aria-label={t('req.dismiss')}>✕</button>
        </div>
      )}
      {later.length === 0 && <p className="hint">{t('req.remindersEmpty')}</p>}
      {later.length > 0 && (
        <ul className="plain req-chips">
          {later.map(r => (
            <li key={r.id}>
              <details>
                <summary>
                  <strong dir="auto">{r.title}</strong>
                  <span className="hint">{t('req.for', { character: r.characterName, name: r.fromName })}</span>
                </summary>
                {r.details && <p className="req-details" dir="auto">{r.details}</p>}
                <Mechanics r={r} />
                {r.storyNote && <p className="req-reply"><span className="sub-title">{t('req.storyNote')}</span> <bdi>{r.storyNote}</bdi></p>}
                <button type="button" className="btn primary small" onClick={() => grant(r)}>{t('req.grantNow')}</button>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

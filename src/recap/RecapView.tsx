import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Character } from '../model/character'
import { listParties } from '../party'
import { getCharacter, listCharacters } from '../storage'
import { endSession, startSession } from './journal'
import { buildRecap, capitalize, describeEvent, formatMinutes, recapToText, rollLabel, type CharacterRecap, type Recap } from './recap'
import { deleteSession, listSessions, onSessionsChanged, saveSession, updateSession } from './store'
import type { Session } from './types'
import './recap.css'

/** Start and end a play session, watch it fill in live, and read past recaps. */
export function RecapView({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const refresh = useCallback(() => { listSessions(userId).then(setSessions) }, [userId])
  useEffect(() => { refresh(); return onSessionsChanged(refresh) }, [refresh])

  if (sessions === null) return null
  const active = sessions.find(s => !s.endedAt)
  const open = sessions.find(s => s.id === openId)
  const past = sessions.filter(s => s.endedAt)

  if (open?.endedAt) return <RecapPage session={open} onBack={() => setOpenId(null)} />

  return (
    <section className="ff-recap">
      {active
        ? <LiveSession session={active} onEnded={setOpenId} />
        : <StartForm userId={userId} defaultTitle={`Session ${past.length + 1}`} />}
      <h3 className="past-head">Past sessions</h3>
      {past.length === 0
        ? <p className="muted">Finished sessions show up here with their recap.</p>
        : (
          <div className="card-grid wide">
            {past.map(s => {
              const r = buildRecap(s)
              return (
                <button key={s.id} className="panel session-card" onClick={() => setOpenId(s.id)}>
                  <h4>{s.title}</h4>
                  <span className="muted small">{formatDate(s.startedAt)} · {formatMinutes(r.minutes)}</span>
                  <span className="small">{r.characters.filter(c => c.characterId).map(c => c.name).join(', ')}</span>
                  {r.highlights[0] && <span className="small muted clamp">{r.highlights[0]}</span>}
                </button>
              )
            })}
          </div>
        )}
    </section>
  )
}

interface Pickable { character: Character; source: string }

function StartForm({ userId, defaultTitle }: { userId: string; defaultTitle: string }) {
  const [options, setOptions] = useState<Pickable[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      const mine = (await listCharacters(userId)).map(c => ({ character: c, source: 'Yours' }))
      const seen = new Set(mine.map(m => m.character.id))
      const fromParties: Pickable[] = []
      for (const p of await listParties(userId)) {
        for (const m of p.members) {
          if (!m.characterId || seen.has(m.characterId)) continue
          const c = await getCharacter(m.characterId)
          if (c) { seen.add(c.id); fromParties.push({ character: c, source: p.name }) }
        }
      }
      if (!live) return
      setOptions([...mine, ...fromParties])
      setPicked(new Set([...mine, ...fromParties].map(o => o.character.id)))
    })()
    return () => { live = false }
  }, [userId])

  if (options === null) return null
  const start = () => saveSession(startSession({
    ownerId: userId,
    title: title.trim() || defaultTitle,
    characters: options.filter(o => picked.has(o.character.id)).map(o => o.character),
  }))

  return (
    <div className="panel start">
      <h2>Session recap</h2>
      <p className="muted">
        Start a session when you sit down to play. Damage, healing, spell slots, loot, XP and every roll are noted as they happen,
        and you get a recap to share when you end it.
      </p>
      <div className="field">
        <label htmlFor="session-title">Session name</label>
        <input id="session-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={defaultTitle} />
      </div>
      {options.length === 0
        ? <p className="muted">Build a character or join a party first, so there is someone to follow.</p>
        : (
          <fieldset className="pick">
            <legend>Who's playing</legend>
            {options.map(({ character: c, source }) => (
              <label key={c.id} className="row">
                <input
                  type="checkbox"
                  checked={picked.has(c.id)}
                  onChange={e => {
                    const next = new Set(picked)
                    if (e.target.checked) next.add(c.id)
                    else next.delete(c.id)
                    setPicked(next)
                  }}
                />
                <span>{c.name}</span>
                <span className="muted small">{source}</span>
              </label>
            ))}
          </fieldset>
        )}
      <button className="btn primary" disabled={picked.size === 0} onClick={start}>Start session</button>
    </div>
  )
}

function LiveSession({ session, onEnded }: { session: Session; onEnded: (id: string) => void }) {
  const [now, setNow] = useState(() => new Date().toISOString())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 30_000)
    return () => clearInterval(t)
  }, [])
  const recap = useMemo(() => buildRecap(session, now), [session, now])
  const recent = session.events.slice(-12).reverse()

  const end = async () => {
    await updateSession(session.ownerId, session.id, s => endSession(s))
    onEnded(session.id)
  }
  const discard = () => {
    if (confirm(`Discard "${session.title}"? Nothing about the characters changes, only this log goes.`)) deleteSession(session.ownerId, session.id)
  }

  return (
    <div className="panel live">
      <div className="row spread">
        <div>
          <span className="rec-dot" aria-hidden /> <span className="small strong">Recording</span>
          <h2>{session.title}</h2>
          <p className="muted small">
            Started {formatTime(session.startedAt)} · {formatMinutes(recap.minutes)} · {recap.characters.filter(c => c.characterId).map(c => c.name).join(', ')}
          </p>
        </div>
        <div className="row">
          <button className="btn ghost small" onClick={discard}>Discard</button>
          <button className="btn primary" onClick={end}>End session and make recap</button>
        </div>
      </div>
      <Totals recap={recap} />
      <h4>So far</h4>
      {recent.length === 0
        ? <p className="muted small">Nothing yet. Open a character's sheet or the dice tray and play; this fills in as you go.</p>
        : (
          <ul className="plain timeline">
            {recent.map(e => <li key={e.id}><span className="muted small">{formatTime(e.at)}</span> <b>{e.characterName}</b> {describeEvent(e)}</li>)}
          </ul>
        )}
    </div>
  )
}

function RecapPage({ session, onBack }: { session: Session; onBack: () => void }) {
  const recap = useMemo(() => buildRecap(session), [session])
  const [copied, setCopied] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const players = recap.characters.filter(c => c.characterId || c.rolls > 0)
  const events = showAll ? session.events : session.events.filter(e => e.kind !== 'roll' || e.roll.d20?.natural === 20 || e.roll.d20?.natural === 1)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recapToText(recap))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copy the recap', recapToText(recap))
    }
  }
  const rename = () => {
    const title = prompt('Session name', session.title)?.trim()
    if (title) updateSession(session.ownerId, session.id, s => ({ ...s, title }))
  }
  const remove = async () => {
    if (!confirm(`Delete the recap for "${session.title}"?`)) return
    await deleteSession(session.ownerId, session.id)
    onBack()
  }

  return (
    <section className="ff-recap">
      <div className="row spread">
        <button className="btn ghost small" onClick={onBack}>← All sessions</button>
        <div className="row">
          <button className="btn small" onClick={rename}>Rename</button>
          <button className="btn ghost small" onClick={remove}>Delete</button>
          <button className="btn primary small" onClick={copy}>{copied ? 'Copied' : 'Copy recap'}</button>
        </div>
      </div>
      <header className="recap-head">
        <h2>{recap.title}</h2>
        <p className="muted">
          {formatDate(recap.startedAt)} · {formatTime(recap.startedAt)} to {formatTime(recap.endedAt!)} · {formatMinutes(recap.minutes)}
          {recap.rests.long + recap.rests.short > 0 && ` · ${restText(recap)}`}
        </p>
      </header>

      <div className="panel highlights">
        <h3>Highlights</h3>
        {recap.highlights.length === 0
          ? <p className="muted">A quiet session. Nothing dramatic happened to anyone.</p>
          : <ul>{recap.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
      </div>

      <Totals recap={recap} />

      <div className="member-grid">
        {players.map(c => <CharacterCard key={c.characterId ?? 'table'} c={c} />)}
      </div>

      <div className="panel">
        <div className="row spread">
          <h3>Timeline</h3>
          <label className="row small"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show every roll</label>
        </div>
        {events.length === 0
          ? <p className="muted small">Nothing was recorded.</p>
          : (
            <ol className="plain timeline">
              {events.map(e => <li key={e.id}><span className="muted small">{formatTime(e.at)}</span> <b>{e.characterName}</b> {describeEvent(e)}</li>)}
            </ol>
          )}
      </div>
    </section>
  )
}

function Totals({ recap }: { recap: Recap }) {
  const t = recap.totals
  const tiles: [string, string | number][] = [
    ['Damage taken', t.damageTaken],
    ['Healing', t.healing],
    ['Rolls', t.rolls],
    ['Nat 20s', t.nat20s],
    ['Nat 1s', t.nat1s],
    ['XP', t.xp.toLocaleString('en')],
    ['Gold', t.gold > 0 ? `+${t.gold}` : t.gold],
  ]
  return (
    <div className="tiles">
      {tiles.map(([label, value]) => (
        <div key={label} className="tile"><span className="num tile-value">{value}</span><span className="muted small">{label}</span></div>
      ))}
    </div>
  )
}

function CharacterCard({ c }: { c: CharacterRecap }) {
  const rows: [string, string][] = []
  if (c.damageTaken) rows.push(['Damage taken', `${c.damageTaken}${c.biggestHit !== c.damageTaken ? ` (biggest ${c.biggestHit})` : ''}`])
  if (c.lowestHp && c.lowestHp.hp > 0) rows.push(['Lowest HP', `${c.lowestHp.hp} / ${c.lowestHp.maxHp}`])
  if (c.healing) rows.push(['Healed', String(c.healing)])
  if (c.timesDowned) rows.push(['Dropped to 0', `${c.timesDowned}×`])
  if (c.slotsUsed) rows.push(['Spell slots', String(c.slotsUsed)])
  for (const [label, n] of Object.entries(c.resourcesUsed)) if (n > 0) rows.push([label, `${n}×`])
  if (c.rolls) rows.push(['Rolls', `${c.rolls}${c.damageRolled ? ` · ${c.damageRolled} damage rolled` : ''}`])
  if (c.bestRoll) rows.push(['Best roll', `${c.bestRoll.total} on ${rollLabel(c.bestRoll)}`])
  if (c.nat20s.length || c.nat1s.length) rows.push(['Nat 20 / nat 1', `${c.nat20s.length} / ${c.nat1s.length}`])
  if (c.conditions.length) rows.push(['Conditions', c.conditions.map(capitalize).join(', ')])
  if (c.xp) rows.push(['XP', `+${c.xp.toLocaleString('en')}`])
  if (c.levelUps.length) rows.push(['Level up', c.levelUps.map(l => `→ ${l}`).join(', ')])
  if (c.gold) rows.push(['Gold', `${c.gold > 0 ? '+' : ''}${c.gold} gp`])
  const loot = c.loot.filter(l => l.qty > 0)
  if (loot.length) rows.push(['Loot', loot.map(l => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(', ')])

  return (
    <article className={`panel member ${c.died ? 'fallen' : ''}`}>
      <h3>{c.name}{c.died && <span className="badge bad">Fallen</span>}</h3>
      {rows.length === 0
        ? <p className="muted small">A quiet session.</p>
        : <dl className="stats">{rows.map(([k, v]) => <div key={k}><dt className="muted small">{k}</dt><dd>{v}</dd></div>)}</dl>}
    </article>
  )
}

function restText(r: Recap) {
  return [r.rests.long && `${r.rests.long} long rest${r.rests.long > 1 ? 's' : ''}`, r.rests.short && `${r.rests.short} short rest${r.rests.short > 1 ? 's' : ''}`]
    .filter(Boolean).join(', ')
}
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })

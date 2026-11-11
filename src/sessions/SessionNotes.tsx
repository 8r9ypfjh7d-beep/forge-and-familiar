// Session notes: the DM's own planning book. The DM starts a session when the game begins, jots things down
// during play and keeps people met, loot, leads, private notes and the plan for next time. Nothing here is
// shown to players: the story of each game is written by the party in Party notes (src/notes).
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/locales/en'
import type { Party } from '../party/types'
import { watchNotes } from './cloud'
import {
  addJot, addLead, addToList, allLeads, currentSession, emptySecret, isDm, linesToLeads, linesToList, listToLines,
  matches, previousSession, removeJot, startSession, toggleLead, visibleNotes,
} from './logic'
import { deleteNote, listNotes, listSecrets, onNotesChanged, pendingCount, refreshNotes, saveNote, saveSecret } from './store'
import type { SessionNote, SessionSecret } from './types'
import './sessions.css'

type T = ReturnType<typeof useI18n>['t']
type JotKind = 'moment' | 'person' | 'loot' | 'lead'
const JOT_KINDS: { id: JotKind; icon: string }[] = [
  { id: 'moment', icon: '📝' }, { id: 'person', icon: '👤' }, { id: 'loot', icon: '💰' }, { id: 'lead', icon: '❓' },
]

function useSessions(partyId: string) {
  const [notes, setNotes] = useState<SessionNote[]>([])
  const [secrets, setSecrets] = useState<SessionSecret[]>([])
  const [pending, setPending] = useState(0)
  useEffect(() => {
    let live = true
    const load = () => {
      listNotes(partyId).then(l => { if (live) setNotes(l) })
      listSecrets(partyId).then(l => { if (live) setSecrets(l) })
      setPending(pendingCount(partyId))
    }
    load()
    const off = onNotesChanged(load)
    // Cloud party: fetch now, on every change from another device, and when the signal comes back.
    const refresh = () => { void refreshNotes(partyId) }
    refresh()
    const offCloud = watchNotes(partyId, refresh)
    window.addEventListener('online', refresh)
    return () => { live = false; off(); offCloud(); window.removeEventListener('online', refresh) }
  }, [partyId])
  return { notes, secrets, pending }
}

/** "Session 3 · Sat, Oct 31" */
function useLabel() {
  const { t, locale } = useI18n()
  return (n: SessionNote) => {
    const [y, m, d] = n.playedOn.split('-').map(Number)
    const date = y ? new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }) : ''
    return date ? t('sessions.numberDate', { n: n.number, date }) : t('sessions.numberLabel', { n: n.number })
  }
}
const nameOfNote = (t: T, n: SessionNote) => n.title.trim() || t('sessions.numberLabel', { n: n.number })

/** The DM's session notes for a campaign: the Sessions tab of the DM screen. Players see nothing here. */
export function SessionNotes({ party, userId }: { party: Party; userId: string }) {
  const { t } = useI18n()
  const label = useLabel()
  const { notes, secrets, pending } = useSessions(party.id)
  const dm = isDm(party, userId)
  const [editing, setEditing] = useState<SessionNote | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [confirm, setConfirm] = useState<SessionNote | null>(null)
  const [error, setError] = useState('')

  const visible = visibleNotes(notes, party, userId)
  const current = dm ? currentSession(notes, party) : undefined
  const list = visible.filter(n => n.id !== current?.id && matches(n, query))
  const leads = allLeads(notes, party, userId)
  const openLeads = leads.filter(r => !r.lead.doneAt)
  const secretOf = (n: SessionNote) => secrets.find(s => s.id === n.id) ?? emptySecret(n)
  const open = visible.find(n => n.id === openId)
  const view = (n: SessionNote) => setOpenId(n.id)

  const start = async () => {
    const n = startSession(party, userId, notes)
    await saveNote(n)
    await saveSecret(emptySecret(n))
  }
  // Not saved until the DM presses Save, so Cancel leaves nothing behind.
  const addEarlier = () => setEditing(startSession(party, userId, notes))
  const doConfirm = async () => {
    if (!confirm) return
    try {
      await deleteNote(confirm.id)
      setOpenId(null)
      setEditing(null)
    } catch {
      setError(t('sessions.deleteFailed'))
    }
  }

  if (!dm) return null
  return (
    <section className="ff-sessions" aria-labelledby="sessions-title">
      <div className="row spread wrap">
        <h3 id="sessions-title">{t('sessions.title')}</h3>
        {dm && !editing && (notes.length > 0) && <button type="button" className="glass-btn small ghost" onClick={addEarlier}>{t('sessions.addPast')}</button>}
      </div>
      {dm && <p className="hint">{t('sessions.dmHint')}</p>}
      {pending > 0 && <p className="hint sessions-waiting" role="status">☁️ {t('sessions.waiting')}</p>}
      {error && <p className="sessions-error" role="alert">{error}</p>}

      {dm && editing && (
        <Editor key={editing.id} note={notes.find(n => n.id === editing.id) ?? editing} secret={secretOf(editing)} label={label(editing)}
          onDone={() => setEditing(null)} />
      )}

      {dm && !editing && (current
        ? <Tonight note={current} secret={secretOf(current)} previous={previousSession(notes, current)} prevSecret={previousSession(notes, current) && secretOf(previousSession(notes, current)!)}
            openLeads={openLeads.filter(r => r.note.id !== current.id).length} label={label(current)}
            onWriteUp={() => setEditing(current)} onDelete={() => setConfirm(current)} />
        : (
          <div className="glass thin sessions-start">
            {notes.length === 0 && <p>{t('sessions.emptyDm')}</p>}
            <button type="button" className="glass-btn prominent" onClick={() => { void start() }}>{t(notes.length ? 'sessions.start' : 'sessions.startFirst')}</button>
          </div>
        ))}

      {(visible.length > 4 || query) && (
        <input className="glass-field sessions-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('sessions.search')} aria-label={t('sessions.search')} />
      )}
      {query && list.length === 0 && <p className="muted small">{t('sessions.noMatch')}</p>}

      {list.length > 0 && (
        <ul className="sessions-list">
          {list.map(n => (
            <li key={n.id}>
              <button type="button" className="glass thin session-card" onClick={() => view(n)}>
                <span className="kind">{label(n)}</span>
                <strong dir="auto">{nameOfNote(t, n)}</strong>
                {sessionPeek(n, secretOf(n)) && <span className="sessions-peek" dir="auto">{sessionPeek(n, secretOf(n))}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {leads.length > 0 && !query && (
        <details className="glass thin sessions-leads" open={openLeads.length > 0 && openLeads.length <= 6}>
          <summary>{t('sessions.allLeads', { n: openLeads.length })}</summary>
          <ul>
            {leads.map(({ lead, note }) => (
              <li key={lead.id} className={lead.doneAt ? 'done' : ''}>
                {dm
                  ? <label className="row"><input type="checkbox" checked={!!lead.doneAt} onChange={() => { void saveNote(toggleLead(note, lead.id)) }}
                      aria-label={lead.doneAt ? t('sessions.leadOpen') : t('sessions.leadDone')} /><bdi>{lead.text}</bdi></label>
                  : <span>{lead.doneAt ? '✓ ' : '• '}<bdi>{lead.text}</bdi></span>}
                <span className="muted small"> · {t('sessions.leadFrom', { n: note.number })}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {open && (
        <Viewer note={open} secret={secretOf(open)} label={label(open)}
          older={visible[visible.indexOf(open) + 1]} newer={visible[visible.indexOf(open) - 1]} onGo={view}
          onEdit={() => { setOpenId(null); setEditing(open) }}
          onDelete={() => setConfirm(open)} onClose={() => setOpenId(null)} />
      )}
      <ConfirmDialog open={!!confirm}
        title={confirm ? t('sessions.confirmDelete', { name: nameOfNote(t, confirm) }) : ''}
        yes={t('common.delete')} onYes={() => { void doConfirm() }} onClose={() => setConfirm(null)} />
    </section>
  )
}

/** What a session card previews: the private notes, else the jots. */
function sessionPeek(n: SessionNote, s: SessionSecret): string {
  return peek(s.notes.trim() || s.jots.map(j => j.text).join(' · ') || n.people.join(' · '))
}

/** A short preview without markup. */
function peek(text: string): string {
  const plain = text.replace(/\n+\s*[-*]\s+/g, ' · ').replace(/^\s*[-*]\s+/, '').replace(/\|\|/g, '').replace(/\*\*?|\[\[|\]\]|^#+\s*|^>\s*|^-\s*/gm, '').replace(/\s+/g, ' ').trim()
  return plain.length > 160 ? plain.slice(0, 157).trimEnd() + '…' : plain
}

/** The session being played: jot box, what's gathered so far, last session's plan. */
function Tonight({ note, secret, previous, prevSecret, openLeads, label, onWriteUp, onDelete }: {
  note: SessionNote
  secret: SessionSecret
  previous?: SessionNote
  prevSecret?: SessionSecret
  openLeads: number
  label: string
  onWriteUp: () => void
  onDelete: () => void
}) {
  const { t, locale } = useI18n()
  const [kind, setKind] = useState<JotKind>('moment')
  const [text, setText] = useState('')
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })

  const add = async () => {
    const line = text.trim()
    if (!line) return
    setText('')
    if (kind === 'moment') await saveSecret(addJot(secret, line))
    else if (kind === 'lead') await saveNote(addLead(note, line))
    else await saveNote({ ...note, [kind === 'person' ? 'people' : 'loot']: addToList(kind === 'person' ? note.people : note.loot, line) })
  }
  const gathered: { key: MessageKey; items: string[] }[] = [
    { key: 'sessions.met', items: note.people }, { key: 'sessions.found', items: note.loot }, { key: 'sessions.leads', items: note.leads.map(l => l.text) },
  ]

  return (
    <div className="glass sessions-tonight">
      <div className="row spread wrap">
        <div>
          <span className="glass-eyebrow">{t('sessions.inPlay')}</span>
          <h4>{note.title.trim() || label}</h4>
          {note.title.trim() && <span className="muted small">{label}</span>}
        </div>
        <span className="kind draft-tag">{t('sessions.onlyYou')}</span>
      </div>

      {(prevSecret?.nextTime.trim() || openLeads > 0) && (
        <details className="sessions-plan" open>
          <summary>{t('sessions.fromLastTime')}{previous && <span className="muted small"> · {t('sessions.numberLabel', { n: previous.number })}</span>}</summary>
          {prevSecret?.nextTime.trim() && <p className="sessions-pre">{prevSecret.nextTime}</p>}
          {openLeads > 0 && <p className="muted small">{t('sessions.openLeadsShort', { count: openLeads })}</p>}
        </details>
      )}

      <form className="sessions-jot" onSubmit={e => { e.preventDefault(); void add() }}>
        <div className="glass-segmented sessions-kinds" role="radiogroup" aria-label={t('sessions.kind')}>
          {JOT_KINDS.map(k => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}>
              <span aria-hidden="true">{k.icon}</span> {t(`sessions.kind.${k.id}` as MessageKey)}
            </button>
          ))}
        </div>
        <div className="row">
          <input className="glass-field" value={text} onChange={e => setText(e.target.value)} aria-label={t('sessions.jotLabel')}
            placeholder={t(`sessions.place.${kind}` as MessageKey)} enterKeyHint="done" />
          <button type="submit" className="glass-btn prominent" disabled={!text.trim()}>{t('sessions.jotAdd')}</button>
        </div>
        <p className="hint">{t('sessions.jotHint')}</p>
      </form>

      {secret.jots.length > 0 && (
        <div>
          <span className="small strong">{t('sessions.jots', { n: secret.jots.length })}</span>
          <ol className="sessions-jots">
            {secret.jots.map(j => (
              <li key={j.id} className="row">
                <time className="muted small" dateTime={j.at}>{time(j.at)}</time>
                <span dir="auto">{j.text}</span>
                <button type="button" className="glass-btn small ghost icon" aria-label={t('sessions.removeJot')} title={t('sessions.removeJot')}
                  onClick={() => { void saveSecret(removeJot(secret, j.id)) }}>✕</button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {gathered.some(g => g.items.length) && (
        <dl className="sessions-gathered">
          {gathered.filter(g => g.items.length).map(g => (
            <div key={g.key}><dt>{t(g.key)}</dt><dd><bdi>{g.items.join(' · ')}</bdi></dd></div>
          ))}
        </dl>
      )}

      <div className="row wrap spread">
        <span className="hint">{t('sessions.writeUpHint')}</span>
        <div className="row wrap">
          <button type="button" className="glass-btn small ghost" onClick={onDelete}>{t('common.delete')}</button>
          <button type="button" className="glass-btn prominent" onClick={onWriteUp}>{t('sessions.writeUp')}</button>
        </div>
      </div>
    </div>
  )
}

/** Write-up form: the part players read, then the part only the DM sees. */
function Editor({ note, secret, label, onDone }: {
  note: SessionNote
  secret: SessionSecret
  label: string
  onDone: () => void
}) {
  const { t } = useI18n()
  const [number, setNumber] = useState(String(note.number))
  const [playedOn, setPlayedOn] = useState(note.playedOn)
  const [title, setTitle] = useState(note.title)
  const [people, setPeople] = useState(listToLines(note.people))
  const [loot, setLoot] = useState(listToLines(note.loot))
  const [leads, setLeads] = useState(listToLines(note.leads.map(l => l.text)))
  const [notes, setNotes] = useState(secret.notes)
  const [nextTime, setNextTime] = useState(secret.nextTime)
  const [busy, setBusy] = useState(false)

  const build = (): SessionNote => ({
    ...note, number: Math.max(1, Math.round(Number(number)) || note.number), playedOn: playedOn || note.playedOn, title: title.trim(),
    people: linesToList(people), loot: linesToList(loot), leads: linesToLeads(leads, note.leads),
  })
  const save = async () => {
    setBusy(true)
    try {
      await saveNote(build())
      await saveSecret({ ...secret, notes, nextTime })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="glass sessions-editor" onSubmit={e => { e.preventDefault(); void save() }} aria-label={label}>
      <div className="sessions-editor-top">
        <label className="field"><span>{t('sessions.f.number')}</span>
          <input className="glass-field" type="number" min={1} inputMode="numeric" value={number} onChange={e => setNumber(e.target.value)} /></label>
        <label className="field"><span>{t('sessions.f.date')}</span>
          <input className="glass-field" type="date" value={playedOn} onChange={e => setPlayedOn(e.target.value)} /></label>
      </div>
      <label className="field"><span>{t('sessions.f.title')}</span>
        <input className="glass-field" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('sessions.f.titlePlace')} /></label>

      <p className="hint">{t('sessions.f.storyHint')}</p>
      <div className="sessions-editor-lists">
        <label className="field"><span>{t('sessions.f.people')}</span>
          <textarea className="glass-field" rows={3} value={people} onChange={e => setPeople(e.target.value)} /></label>
        <label className="field"><span>{t('sessions.f.loot')}</span>
          <textarea className="glass-field" rows={3} value={loot} onChange={e => setLoot(e.target.value)} /></label>
        <label className="field"><span>{t('sessions.f.leads')}</span>
          <textarea className="glass-field" rows={3} value={leads} onChange={e => setLeads(e.target.value)} /></label>
      </div>

      <div className="sessions-private">
        <label className="field"><span>{t('sessions.f.notes')}</span>
          <textarea className="glass-field" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('sessions.f.notesPlace')} /></label>
        <label className="field"><span>{t('sessions.f.nextTime')}</span>
          <textarea className="glass-field" rows={2} value={nextTime} onChange={e => setNextTime(e.target.value)} placeholder={t('sessions.f.nextTimePlace')} /></label>
      </div>

      <div className="row wrap sessions-editor-actions">
        <button type="button" className="glass-btn ghost" onClick={onDone}>{t('common.cancel')}</button>
        <button type="submit" className="glass-btn prominent" disabled={busy}>{t('sessions.save')}</button>
      </div>
    </form>
  )
}

/** One session, full screen: who they met, what they found, leads, private notes, jots and the plan. */
function Viewer({ note: n, secret, label, older, newer, onGo, onEdit, onDelete, onClose }: {
  note: SessionNote
  secret: SessionSecret
  label: string
  older?: SessionNote
  newer?: SessionNote
  onGo: (n: SessionNote) => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const lists: { key: MessageKey; items: string[] }[] = [{ key: 'sessions.met', items: n.people }, { key: 'sessions.found', items: n.loot }]
  const hasPrivate = secret.notes.trim() || secret.nextTime.trim() || secret.jots.length > 0

  return (
    <div className="ff-handout-viewer ff-sessions-viewer" role="dialog" aria-modal="true" aria-label={nameOfNote(t, n)} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="glass-sheet viewer-body note">
        <header className="row spread">
          <div>
            <span className="kind">{label} · <span className="draft-tag">{t('sessions.onlyYou')}</span></span>
            <h3 dir="auto">{nameOfNote(t, n)}</h3>
          </div>
          <button autoFocus type="button" className="glass-btn small ghost icon" onClick={onClose} aria-label={t('sessions.close')}>✕</button>
        </header>
        {lists.filter(l => l.items.length).map(l => (
          <div key={l.key} className="sessions-chips">
            <span className="small strong">{t(l.key)}</span>
            <ul>{l.items.map(x => <li key={x} className="chip" dir="auto">{x}</li>)}</ul>
          </div>
        ))}
        {n.leads.length > 0 && (
          <div className="sessions-chips">
            <span className="small strong">{t('sessions.leads')}</span>
            <ul className="sessions-lead-list">
              {n.leads.map(l => <li key={l.id} className={l.doneAt ? 'done' : ''}>{l.doneAt ? '✓' : '•'} <bdi>{l.text}</bdi></li>)}
            </ul>
          </div>
        )}
        {hasPrivate && (
          <div className="sessions-private-box">
            {secret.notes.trim() && <p className="sessions-pre">{secret.notes}</p>}
            {secret.nextTime.trim() && <p className="sessions-pre"><strong>{t('sessions.f.nextTime')}:</strong> {secret.nextTime}</p>}
            {secret.jots.length > 0 && (
              <details><summary className="small">{t('sessions.jots', { n: secret.jots.length })}</summary>
                <ul>{secret.jots.map(j => <li key={j.id}>{j.text}</li>)}</ul>
              </details>
            )}
          </div>
        )}
        <footer className="row wrap spread">
          <div className="row">
            {older && <button type="button" className="glass-btn small ghost" onClick={() => onGo(older)}>{t('sessions.prev')}</button>}
            {newer && <button type="button" className="glass-btn small ghost" onClick={() => onGo(newer)}>{t('sessions.next')}</button>}
          </div>
          <div className="row wrap">
            <button type="button" className="glass-btn small ghost" onClick={onDelete}>{t('common.delete')}</button>
            <button type="button" className="glass-btn small prominent" onClick={onEdit}>{t('sessions.edit')}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

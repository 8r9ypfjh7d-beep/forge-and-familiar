// Party notes: what players (and the DM) write about their campaign. Each player writes on their character
// sheet ("My notes", story mode) while playing; typing is kept as a draft on the device and others see a note
// only after Save. The campaign page and the DM screen show every note the reader may see, newest first.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/locales/en'
import { EntryBody } from '../lore/EntryView'
import { visibleHandouts } from '../lore/logic'
import { listHandouts, onHandoutsChanged } from '../lore/store'
import type { LoreEntry } from '../lore/types'
import { requestOpenEntry } from '../lore/Codex'
import { usePartyNames } from '../lore/useNames'
import type { Party } from '../party/types'
import { listNotes as listSessions, refreshNotes as refreshSessions, saveNote as saveSession } from '../sessions/store'
import { unshare } from '../sessions/logic'
import { watchNotes } from './cloud'
import { canEdit, feed, isEmpty, myNotes, newNote, normalizeAudience, peek, recapNoteId, recapToNote, today } from './logic'
import { clearDraft, deleteNote, getDraft, hasNote, listDrafts, listNotes, onNotesChanged, pendingCount, refreshNotes, saveDraft, saveNote } from './store'
import { CATEGORY_ICONS, NOTE_CATEGORIES, type NoteCategory, type NoteDraft, type NoteKind, type PartyNote } from './types'
import '../lore/lore.css'
import './notes.css'

type T = ReturnType<typeof useI18n>['t']

/** One party's notes and this player's unsaved drafts, kept fresh from the server. */
export function usePartyNotes(party: Party, userId: string) {
  const { t } = useI18n()
  const [notes, setNotes] = useState<PartyNote[]>([])
  const [drafts, setDrafts] = useState<NoteDraft[]>([])
  const [pending, setPending] = useState(0)
  const partyId = party.id
  const dm = party.dmId === userId
  useEffect(() => {
    let live = true
    const load = () => {
      listNotes(partyId).then(l => { if (live) setNotes(l) })
      setDrafts(listDrafts(partyId, userId))
      setPending(pendingCount(partyId))
    }
    load()
    const off = onNotesChanged(load)
    const refresh = () => { void refreshNotes(partyId) }
    refresh()
    const offCloud = watchNotes(partyId, refresh)
    window.addEventListener('online', refresh)
    return () => { live = false; off(); offCloud(); window.removeEventListener('online', refresh) }
  }, [partyId, userId])
  // The DM's shared session recaps moved here: each becomes a diary note by the DM, shared with the party.
  // The server did it once for cloud campaigns; this catches recaps kept on the DM's device.
  useEffect(() => {
    if (!dm) return
    let live = true
    const words = { session: (n: number) => t('sessions.numberLabel', { n }), people: t('notes.recap.people'), loot: t('notes.recap.loot'), leads: t('notes.recap.leads') }
    void (async () => {
      await refreshSessions(partyId).catch(() => undefined)
      for (const s of await listSessions(partyId)) {
        if (!live || !s.sharedAt) continue
        if (!hasNote(recapNoteId(s.id))) await saveNote(recapToNote(s, words))
        await saveSession(unshare(s))
      }
    })()
    return () => { live = false }
  }, [dm, partyId, t])
  return { notes, drafts, pending }
}

function useLore(party: Party, userId: string) {
  const [lore, setLore] = useState<LoreEntry[]>([])
  useEffect(() => {
    let live = true
    const load = () => { listHandouts(party.id).then(l => { if (live) setLore(l) }) }
    load()
    const off = onHandoutsChanged(load)
    return () => { live = false; off() }
  }, [party.id])
  return useMemo(() => visibleHandouts(lore, party, userId), [lore, party, userId])
}

function useDate() {
  const { locale } = useI18n()
  return (ymd?: string) => {
    if (!ymd) return ''
    const [y, m, d] = ymd.split('-').map(Number)
    return y ? new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }) : ''
  }
}

export const titleOf = (t: T, n: PartyNote) => n.title.trim() || t(n.kind === 'diary' ? 'notes.untitledDiary' : 'notes.untitledPage')

/** Who reads it, in plain words, for the writer and the DM. */
function audienceLabel(t: T, n: PartyNote, nameOf: (id: string) => string): string {
  if (n.to === 'all') return t('notes.to.allShort')
  if (n.to === 'me') return t('notes.to.meShort')
  return t('notes.to.someShort', { names: n.to.map(nameOf).join(', ') })
}

/** The campaign's notes: on the campaign page and as the Notes tab of the DM screen. */
export function PartyNotes({ party, userId, onOpenLore }: { party: Party; userId: string; onOpenLore?: () => void }) {
  const { t } = useI18n()
  const nameOf = usePartyNames()
  const { notes, drafts, pending } = usePartyNotes(party, userId)
  const lore = useLore(party, userId)
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState<NoteCategory | ''>('')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ note: PartyNote; isNew: boolean } | null>(null)
  const all = feed(notes, party, userId)
  const list = feed(notes, party, userId, { author: author || undefined, category: category || undefined, query })
  const writers = [...new Set(all.map(n => n.authorId))]
  const open = all.find(n => n.id === openId)
  const member = party.dmId === userId || party.members.some(m => m.userId === userId)
  const unsaved = drafts.filter(d => d.isNew)

  const openLore = (e: LoreEntry) => {
    setOpenId(null)
    onOpenLore?.()
    requestOpenEntry(e.id)
    setTimeout(() => document.getElementById('lore-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
  }

  return (
    <section className="ff-notes" aria-labelledby="party-notes-title">
      <div className="row spread wrap">
        <h3 id="party-notes-title">{t('notes.partyTitle')}</h3>
        {member && !editing && <NewButtons onNew={kind => setEditing({ note: newNote(party.id, userId, kind), isNew: true })} />}
      </div>
      <p className="hint">{t(party.dmId === userId ? 'notes.dmHint' : 'notes.partyHint')}</p>
      {pending > 0 && <p className="hint" role="status">☁️ {t('notes.waiting')}</p>}

      {editing && <NoteEditor key={editing.note.id} party={party} userId={userId} note={editing.note} isNew={editing.isNew} nameOf={nameOf} onDone={() => setEditing(null)} />}
      {!editing && unsaved.length > 0 && (
        <ul className="notes-list">
          {unsaved.map(d => <li key={d.note.id}><NoteCard note={d.note} draft nameOf={nameOf} onOpen={() => setEditing({ note: d.note, isNew: true })} /></li>)}
        </ul>
      )}

      {all.length === 0 && !editing && <p className="muted small">{t('notes.emptyParty')}</p>}
      {all.length > 0 && (
        <div className="notes-filters">
          {writers.length > 1 && (
            <select className="glass-field" value={author} onChange={e => setAuthor(e.target.value)} aria-label={t('notes.filter.who')}>
              <option value="">{t('notes.filter.everyone')}</option>
              {writers.map(id => <option key={id} value={id}>{id === userId ? t('notes.filter.me') : nameOf(id)}</option>)}
            </select>
          )}
          <CategoryChips value={category} onChange={c => setCategory(c === category ? '' : c)} />
          {all.length > 6 && (
            <input className="glass-field" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('notes.search')} aria-label={t('notes.search')} />
          )}
        </div>
      )}
      {all.length > 0 && list.length === 0 && <p className="muted small">{t('notes.noMatch')}</p>}
      {list.length > 0 && (
        <ul className="notes-list">
          {list.map(n => (
            <li key={n.id}><NoteCard note={n} mine={n.authorId === userId} showAudience={n.authorId === userId || party.dmId === userId} nameOf={nameOf}
              author={n.authorId === userId ? t('notes.byMe') : nameOf(n.authorId)} draft={!!getDraft(n.id)} onOpen={() => setOpenId(n.id)} /></li>
          ))}
        </ul>
      )}

      {open && (
        <NoteViewer note={open} party={party} userId={userId} lore={lore} nameOf={nameOf} onOpenLore={openLore}
          onEdit={() => { setOpenId(null); setEditing({ note: open, isNew: false }) }} onClose={() => setOpenId(null)} />
      )}
    </section>
  )
}

/** "My notes" on the character sheet: the player's own notes in the campaign in play, written while playing. */
export function MyNotes({ party, userId, children }: { party: Party; userId: string; children?: React.ReactNode }) {
  const { t } = useI18n()
  const nameOf = usePartyNames()
  const { notes, drafts, pending } = usePartyNotes(party, userId)
  const lore = useLore(party, userId)
  const [editing, setEditing] = useState<{ note: PartyNote; isNew: boolean } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const mine = myNotes(notes, party.id, userId)
  const unsaved = drafts.filter(d => d.isNew)
  const open = mine.find(n => n.id === openId)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? mine : mine.slice(0, 5)

  return (
    <section className="card ff-notes my-notes" aria-labelledby="my-notes-title">
      <div className="row spread wrap">
        <h2 id="my-notes-title">{t('notes.myTitle')}</h2>
        {!editing && <NewButtons onNew={kind => setEditing({ note: newNote(party.id, userId, kind), isNew: true })} />}
      </div>
      {pending > 0 && <p className="hint" role="status">☁️ {t('notes.waiting')}</p>}
      {editing && <NoteEditor key={editing.note.id} party={party} userId={userId} note={editing.note} isNew={editing.isNew} nameOf={nameOf} onDone={() => setEditing(null)} />}
      {!editing && (
        <>
          {mine.length === 0 && unsaved.length === 0 && <p className="muted small">{t('notes.emptyMine', { party: party.name })}</p>}
          {(unsaved.length > 0 || mine.length > 0) && (
            <ul className="notes-list compact">
              {unsaved.map(d => <li key={d.note.id}><NoteCard note={d.note} draft nameOf={nameOf} onOpen={() => setEditing({ note: d.note, isNew: true })} /></li>)}
              {shown.map(n => (
                <li key={n.id}><NoteCard note={n} mine showAudience nameOf={nameOf} draft={!!getDraft(n.id)}
                  onOpen={() => (getDraft(n.id) ? setEditing({ note: n, isNew: false }) : setOpenId(n.id))} /></li>
              ))}
            </ul>
          )}
          {mine.length > shown.length && <button type="button" className="glass-btn small ghost" onClick={() => setShowAll(true)}>{t('notes.showAll', { n: mine.length })}</button>}
          <p className="hint">{t('notes.whereShared')}</p>
          {children}
        </>
      )}
      {open && (
        <NoteViewer note={open} party={party} userId={userId} lore={lore} nameOf={nameOf} onOpenLore={() => setOpenId(null)}
          onEdit={() => { setOpenId(null); setEditing({ note: open, isNew: false }) }} onClose={() => setOpenId(null)} />
      )}
    </section>
  )
}

function NewButtons({ onNew }: { onNew: (kind: NoteKind) => void }) {
  const { t } = useI18n()
  return (
    <div className="row wrap notes-new">
      <button type="button" className="glass-btn small prominent" onClick={() => onNew('diary')}>📔 {t('notes.newDiary')}</button>
      <button type="button" className="glass-btn small" onClick={() => onNew('page')}>📄 {t('notes.newPage')}</button>
    </div>
  )
}

function CategoryChips({ value, onChange, label }: { value: NoteCategory | ''; onChange: (c: NoteCategory) => void; label?: string }) {
  const { t } = useI18n()
  return (
    <div className="row wrap notes-cats" role="group" aria-label={label ?? t('notes.filter.category')}>
      {NOTE_CATEGORIES.map(c => (
        <button key={c} type="button" className={`chip${value === c ? ' on' : ''}`} aria-pressed={value === c} onClick={() => onChange(c)}>
          <span aria-hidden="true">{CATEGORY_ICONS[c]}</span> {t(`notes.cat.${c}` as MessageKey)}
        </button>
      ))}
    </div>
  )
}

function NoteCard({ note: n, mine, showAudience, draft, author, nameOf, onOpen }: {
  note: PartyNote
  mine?: boolean
  showAudience?: boolean
  draft?: boolean
  author?: string
  nameOf: (id: string) => string
  onOpen: () => void
}) {
  const { t } = useI18n()
  const date = useDate()
  const bits = [author, n.kind === 'diary' ? date(n.playedOn) : t('notes.kind.page'), n.category ? `${CATEGORY_ICONS[n.category]} ${t(`notes.cat.${n.category}` as MessageKey)}` : ''].filter(Boolean)
  return (
    <button type="button" className={`glass thin note-card${mine && n.to === 'me' ? ' private' : ''}${draft ? ' has-draft' : ''}`} onClick={onOpen}>
      <span className="kind">{bits.join(' · ')}</span>
      <strong dir="auto">{titleOf(t, n)}</strong>
      {n.text.trim() && <span className="notes-peek" dir="auto">{peek(n.text)}</span>}
      <span className="row wrap note-tags">
        {showAudience && <span className="note-to">{audienceLabel(t, n, nameOf)}</span>}
        {draft && <span className="draft-tag">{t('notes.unsaved')}</span>}
      </span>
    </button>
  )
}

/** Write or edit one note. Typing is kept on this device as a draft; Save is what shares it. */
function NoteEditor({ party, userId, note: base, isNew, nameOf, onDone }: {
  party: Party
  userId: string
  note: PartyNote
  isNew: boolean
  nameOf: (id: string) => string
  onDone: () => void
}) {
  const { t } = useI18n()
  const start = getDraft(base.id)?.note ?? base
  const [note, setNote] = useState<PartyNote>(start)
  const [touched, setTouched] = useState(!!getDraft(base.id))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)
  const players = party.members.map(m => m.userId).filter(id => id !== party.dmId && id !== userId)
  const choosing = Array.isArray(note.to)
  const set = (patch: Partial<PartyNote>) => { setNote(n => ({ ...n, ...patch })); setTouched(true) }

  // Keep the draft on this device a moment after each change, so a closed app or a dead battery loses nothing.
  useEffect(() => {
    if (!touched) return
    const id = setTimeout(() => saveDraft(note, isNew), 400)
    return () => clearTimeout(id)
  }, [note, touched, isNew])

  const wrap = (mark: string) => {
    const el = textRef.current
    const s = el?.selectionStart ?? note.text.length
    const e = el?.selectionEnd ?? note.text.length
    const words = note.text.slice(s, e) || t('lore.fmt.sample')
    set({ text: note.text.slice(0, s) + mark + words + mark + note.text.slice(e) })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + mark.length, s + mark.length + words.length) })
  }

  const save = async () => {
    setBusy(true)
    try {
      await saveNote({ ...note, title: note.title.trim(), to: normalizeAudience(note.to, party, userId) })
      clearDraft(note.id)
      onDone()
    } finally {
      setBusy(false)
    }
  }
  const close = () => {
    // An untouched new note leaves nothing behind; anything typed stays as a draft to finish later.
    if (!touched) clearDraft(note.id)
    else saveDraft(note, isNew, false)
    onDone()
  }
  const discard = () => { clearDraft(note.id); onDone() }
  const remove = async () => {
    try {
      await deleteNote(note.id)
      onDone()
    } catch {
      setError(t('notes.deleteFailed'))
    }
  }
  const audience = (choice: 'me' | 'all' | 'some') => set({ to: choice === 'some' ? (Array.isArray(note.to) ? note.to : []) : choice })
  const toggle = (id: string) => {
    const now = Array.isArray(note.to) ? note.to : []
    set({ to: now.includes(id) ? now.filter(x => x !== id) : [...now, id] })
  }

  return (
    <form className="glass notes-editor" onSubmit={e => { e.preventDefault(); void save() }} aria-label={titleOf(t, note)}>
      <div className="glass-segmented" role="radiogroup" aria-label={t('notes.kind.label')}>
        {(['diary', 'page'] as NoteKind[]).map(k => (
          <button key={k} type="button" role="radio" aria-checked={note.kind === k}
            onClick={() => set(k === 'diary' ? { kind: k, playedOn: note.playedOn ?? today() } : { kind: k })}>
            {k === 'diary' ? '📔' : '📄'} {t(`notes.kind.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      <div className="notes-editor-top">
        <label className="field"><span>{t('notes.f.title')}</span>
          <input className="glass-field" value={note.title} onChange={e => set({ title: e.target.value })}
            placeholder={t(note.kind === 'diary' ? 'notes.f.titleDiary' : 'notes.f.titlePage')} dir="auto" /></label>
        {note.kind === 'diary' && (
          <label className="field"><span>{t('notes.f.date')}</span>
            <input className="glass-field" type="date" value={note.playedOn ?? ''} onChange={e => set({ playedOn: e.target.value })} /></label>
        )}
      </div>
      <label className="field"><span className="strong">{t('notes.f.text')}</span>
        <textarea ref={textRef} className="glass-field" rows={8} value={note.text} onChange={e => set({ text: e.target.value })} dir="auto"
          placeholder={t(note.kind === 'diary' ? 'notes.f.textDiary' : 'notes.f.textPage')} /></label>
      <div className="row wrap lore-format" role="toolbar" aria-label={t('notes.f.text')}>
        <button type="button" className="glass-btn small ghost" onClick={() => wrap('**')}><b>{t('lore.fmt.bold')}</b></button>
        <button type="button" className="glass-btn small ghost" onClick={() => wrap('*')}><i>{t('lore.fmt.italic')}</i></button>
        <span className="hint">{t('notes.f.linkHint')}</span>
      </div>

      <div className="field"><span>{t('notes.f.category')}</span>
        <CategoryChips value={note.category ?? ''} label={t('notes.f.category')}
          onChange={c => set({ category: note.category === c ? undefined : c })} />
      </div>

      <fieldset className="notes-audience">
        <legend>{t('notes.f.who')}</legend>
        <div className="glass-segmented" role="radiogroup" aria-label={t('notes.f.who')}>
          <button type="button" role="radio" aria-checked={note.to === 'me'} onClick={() => audience('me')}>🔒 {t('notes.to.me')}</button>
          <button type="button" role="radio" aria-checked={note.to === 'all'} onClick={() => audience('all')}>👥 {t('notes.to.all')}</button>
          {players.length > 0 && <button type="button" role="radio" aria-checked={choosing} onClick={() => audience('some')}>✋ {t('notes.to.some')}</button>}
        </div>
        {choosing && (
          <div className="row wrap notes-players">
            {players.map(id => (
              <label key={id} className="chip"><input type="checkbox" checked={(note.to as string[]).includes(id)} onChange={() => toggle(id)} /> <bdi>{nameOf(id)}</bdi></label>
            ))}
          </div>
        )}
        <p className="hint">{t(party.dmId === userId ? 'notes.to.hintDm' : 'notes.to.hint')}</p>
      </fieldset>

      {error && <p className="notes-error" role="alert">{error}</p>}
      <p className="hint" role="status">{touched ? t(isNew ? 'notes.draftNew' : 'notes.draftEdit') : ''}</p>
      <div className="row wrap notes-editor-actions">
        {!isNew && canEdit(base, userId) && <button type="button" className="glass-btn small ghost" onClick={() => setConfirmDelete(true)}>{t('common.delete')}</button>}
        {touched && <button type="button" className="glass-btn ghost" onClick={discard}>{t(isNew ? 'notes.discard' : 'notes.discardChanges')}</button>}
        <button type="button" className="glass-btn" onClick={close}>{t('notes.close')}</button>
        <button type="submit" className="glass-btn prominent" disabled={busy || isEmpty(note)}>{t('notes.save')}</button>
      </div>
      <ConfirmDialog open={confirmDelete} title={t('notes.confirmDelete', { name: titleOf(t, note) })} yes={t('common.delete')}
        onYes={() => { void remove() }} onClose={() => setConfirmDelete(false)} />
    </form>
  )
}

/** One note, full screen, with [[links]] to lore entries the reader can see. */
function NoteViewer({ note: n, party, userId, lore, nameOf, onOpenLore, onEdit, onClose }: {
  note: PartyNote
  party: Party
  userId: string
  lore: LoreEntry[]
  nameOf: (id: string) => string
  onOpenLore: (e: LoreEntry) => void
  onEdit: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const date = useDate()
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const asEntry: LoreEntry = { id: n.id, partyId: n.partyId, fromId: n.authorId, kind: 'note', title: n.title, text: n.text, to: 'all', seenBy: {}, createdAt: n.createdAt, updatedAt: n.updatedAt }
  const mine = n.authorId === userId
  const bits = [mine ? t('notes.byMe') : nameOf(n.authorId), n.kind === 'diary' ? date(n.playedOn) : t('notes.kind.page'),
    n.category ? `${CATEGORY_ICONS[n.category]} ${t(`notes.cat.${n.category}` as MessageKey)}` : ''].filter(Boolean)
  return (
    <div className="ff-handout-viewer ff-notes-viewer" role="dialog" aria-modal="true" aria-label={titleOf(t, n)} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="glass-sheet viewer-body note">
        <header className="row spread">
          <div>
            <span className="kind">{bits.join(' · ')}</span>
            <h3 dir="auto">{titleOf(t, n)}</h3>
            {(mine || party.dmId === userId) && <span className="note-to">{audienceLabel(t, n, nameOf)}</span>}
          </div>
          <button autoFocus type="button" className="glass-btn small ghost icon" onClick={onClose} aria-label={t('notes.close')}>✕</button>
        </header>
        {n.text.trim() && <div dir="auto"><EntryBody entry={asEntry} open="all" visible={lore} onOpen={onOpenLore} /></div>}
        {canEdit(n, userId) && (
          <footer className="row wrap spread">
            <span />
            <button type="button" className="glass-btn small prominent" onClick={onEdit}>{t('notes.edit')}</button>
          </footer>
        )}
      </div>
    </div>
  )
}

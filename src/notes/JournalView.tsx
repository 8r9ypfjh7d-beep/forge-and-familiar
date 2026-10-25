import { useEffect, useMemo, useState } from 'react'
import type { Character } from '../model/character'
import { listSessions, onSessionsChanged, type Session } from '../recap'
import { getCharacter, onCharactersChanged } from '../storage'
import {
  dateOf, emptyJournal, formatDate, journalToText, lootTotalGp, newLoot, newNote, newNpc, newObjective, newQuest,
  questProgress, removeById, searchJournal, sessionDates, setQuestStatus, sortLoot, sortNpcs, sortQuests, timeline, today, upsert,
} from './journal'
import { getJournal, onJournalChanged, updateJournal } from './store'
import type { Attitude, Journal, Loot, Npc, Quest, QuestStatus, SessionDate, SessionNote } from './types'
import './notes.css'

type Tab = 'sessions' | 'quests' | 'people' | 'loot'
type Change = (j: Journal) => Journal

const ATTITUDES: Attitude[] = ['friendly', 'neutral', 'hostile', 'unknown']
const STATUS_LABEL: Record<QuestStatus, string> = { active: 'Active', done: 'Done', failed: 'Failed' }

export function JournalView({ characterId, userId, onBack, onOpenSheet }: {
  characterId: string
  userId: string
  onBack: () => void
  onOpenSheet: (id: string) => void
}) {
  const [owner, setOwner] = useState<Character | null | undefined>(undefined)
  const [journal, setJournal] = useState<Journal>(() => emptyJournal(characterId))
  const [recaps, setRecaps] = useState<Session[]>([])
  const [tab, setTab] = useState<Tab>('sessions')
  const [query, setQuery] = useState('')
  const [date, setDate] = useState<SessionDate | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    const loadChar = () => getCharacter(characterId).then(c => { if (live) setOwner(c ?? null) })
    const loadJournal = () => getJournal(characterId).then(j => { if (live) setJournal(j) })
    const loadRecaps = () => listSessions(userId).then(l => { if (live) setRecaps(l.filter(s => s.characterIds.includes(characterId))) })
    loadChar()
    loadJournal()
    loadRecaps()
    const off1 = onCharactersChanged(id => { if (!id || id === characterId) loadChar() })
    const off2 = onJournalChanged(id => { if (id === characterId) loadJournal() })
    const off3 = onSessionsChanged(loadRecaps)
    return () => { live = false; off1(); off2(); off3() }
  }, [characterId, userId])

  const activeRecap = recaps.find(s => !s.endedAt)
  // New records are stamped with the chosen session date: a running recap's day, else today.
  const stamp = date ?? (activeRecap ? dateOf(activeRecap.startedAt) : today())
  const shown = useMemo(() => searchJournal(journal, query), [journal, query])

  const commit = (change: Change) => {
    setJournal(change)
    updateJournal(characterId, change)
  }
  const add = <T extends { id: string }>(field: 'notes' | 'npcs' | 'quests' | 'loot', item: T) => {
    commit(j => ({ ...j, [field]: upsert(j[field] as unknown as T[], item) }))
    setEditing(item.id)
    setQuery('')
  }

  if (owner === undefined) return <div className="ff-notes"><p className="hint">Loading…</p></div>
  if (owner === null) {
    return (
      <div className="ff-notes">
        <p>This character could not be found.</p>
        <button type="button" className="btn" onClick={onBack}>Back</button>
      </div>
    )
  }

  const activeQuests = journal.quests.filter(q => q.status === 'active').length
  const pastDates = sessionDates(journal)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(journalToText(owner.name, journal))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked; nothing to fall back to.
    }
  }

  return (
    <div className="ff-notes">
      <header className="notes-head">
        <button type="button" className="btn ghost" onClick={onBack} aria-label="Back to characters">←</button>
        <div className="grow">
          <h2>{owner.name}'s journal</h2>
          <p className="muted small">Session notes, quests, people met and loot, stamped by the session they happened in.</p>
        </div>
        <button type="button" className="btn small" onClick={copy}>{copied ? 'Copied' : 'Copy as text'}</button>
        <button type="button" className="btn small" onClick={() => onOpenSheet(owner.id)}>Open sheet</button>
      </header>

      <div className="panel toolbar">
        <label className="stamp">
          <span className="small strong">Session date</span>
          <input type="date" value={stamp} onChange={e => setDate(e.target.value || null)} list="ff-notes-dates" />
          <datalist id="ff-notes-dates">{pastDates.map(d => <option key={d} value={d} />)}</datalist>
        </label>
        <span className="hint grow">
          {activeRecap && !date ? `Recording "${activeRecap.title}". New entries go under that session.` : 'New entries are stamped with this date.'}
        </span>
        <input type="search" className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the journal" aria-label="Search the journal" />
      </div>

      <nav className="row tabs" aria-label="Journal sections">
        <TabChip tab="sessions" current={tab} onPick={setTab}>Sessions</TabChip>
        <TabChip tab="quests" current={tab} onPick={setTab}>Quests{activeQuests ? ` · ${activeQuests} open` : ''}</TabChip>
        <TabChip tab="people" current={tab} onPick={setTab}>People{journal.npcs.length ? ` · ${journal.npcs.length}` : ''}</TabChip>
        <TabChip tab="loot" current={tab} onPick={setTab}>Loot{journal.loot.length ? ` · ${journal.loot.length}` : ''}</TabChip>
      </nav>

      {tab === 'sessions' && (
        <Sessions
          journal={shown}
          recaps={recaps}
          searching={!!query.trim()}
          editing={editing}
          setEditing={setEditing}
          onAdd={() => add('notes', newNote(stamp, defaultRecap(recaps, stamp)?.id))}
          stamp={stamp}
          onSave={n => commit(j => ({ ...j, notes: upsert(j.notes, { ...n, updatedAt: new Date().toISOString() }) }))}
          onDelete={id => commit(j => ({ ...j, notes: removeById(j.notes, id) }))}
          onJump={(t, id) => { setTab(t); setEditing(id) }}
        />
      )}
      {tab === 'quests' && (
        <Quests
          list={shown.quests}
          stamp={stamp}
          editing={editing}
          setEditing={setEditing}
          onAdd={() => add('quests', newQuest(stamp))}
          onSave={q => commit(j => ({ ...j, quests: upsert(j.quests, q) }))}
          onDelete={id => commit(j => ({ ...j, quests: removeById(j.quests, id) }))}
        />
      )}
      {tab === 'people' && (
        <People
          list={shown.npcs}
          editing={editing}
          setEditing={setEditing}
          onAdd={() => add('npcs', newNpc(stamp))}
          onSave={n => commit(j => ({ ...j, npcs: upsert(j.npcs, n) }))}
          onDelete={id => commit(j => ({ ...j, npcs: removeById(j.npcs, id) }))}
        />
      )}
      {tab === 'loot' && (
        <LootList
          list={shown.loot}
          editing={editing}
          setEditing={setEditing}
          onAdd={() => add('loot', newLoot(stamp))}
          onSave={l => commit(j => ({ ...j, loot: upsert(j.loot, l) }))}
          onDelete={id => commit(j => ({ ...j, loot: removeById(j.loot, id) }))}
        />
      )}
    </div>
  )
}

/** The recap a new note should link to: the running one, else one recorded on that day. */
function defaultRecap(recaps: Session[], date: SessionDate): Session | undefined {
  return recaps.find(s => !s.endedAt && dateOf(s.startedAt) === date) ?? recaps.find(s => dateOf(s.startedAt) === date)
}

function TabChip({ tab, current, onPick, children }: { tab: Tab; current: Tab; onPick: (t: Tab) => void; children: React.ReactNode }) {
  return <button type="button" className={`chip ${tab === current ? 'on' : ''}`} aria-pressed={tab === current} onClick={() => onPick(tab)}>{children}</button>
}

interface ListProps<T> {
  editing: string | null
  setEditing: (id: string | null) => void
  onAdd: () => void
  onSave: (item: T) => void
  onDelete: (id: string) => void
}

function Sessions({ journal, recaps, searching, stamp, onJump, ...p }: ListProps<SessionNote> & {
  journal: Journal
  recaps: Session[]
  searching: boolean
  stamp: SessionDate
  onJump: (tab: Tab, id: string) => void
}) {
  const days = timeline(journal)
  return (
    <section className="list">
      <div className="row">
        <button type="button" className="btn primary" onClick={p.onAdd}>+ Note for {formatDate(stamp)}</button>
      </div>
      {days.length === 0 && (
        <div className="panel empty">
          <p>{searching ? 'Nothing matches that search.' : 'No sessions yet. Add a note after your next game, or log a quest, person or piece of loot.'}</p>
        </div>
      )}
      {days.map(d => (
        <article key={d.date} className="panel day">
          <h3>{formatDate(d.date)}</h3>
          {d.notes.map(n => p.editing === n.id
            ? <NoteEditor key={n.id} note={n} recaps={recaps} onSave={p.onSave} onDelete={p.onDelete} onDone={() => p.setEditing(null)} />
            : (
              <div key={n.id} className="note">
                <div className="row spread-tight">
                  <h4>{n.title || 'Session notes'}</h4>
                  <button type="button" className="btn ghost small" onClick={() => p.setEditing(n.id)}>Edit</button>
                </div>
                {n.recapSessionId && <p className="hint">Recap: {recaps.find(r => r.id === n.recapSessionId)?.title ?? 'deleted session'}</p>}
                {n.body.trim() ? <p className="body">{n.body}</p> : <p className="hint">Empty note.</p>}
              </div>
            ))}
          <DayLinks label="Met" items={d.npcsMet.map(n => ({ id: n.id, text: n.name || 'Unnamed' }))} onPick={id => onJump('people', id)} />
          <DayLinks label="New quests" items={d.questsStarted.map(q => ({ id: q.id, text: q.title || 'Untitled' }))} onPick={id => onJump('quests', id)} />
          <DayLinks label="Quests closed" items={d.questsClosed.map(q => ({ id: q.id, text: `${q.title || 'Untitled'} (${q.status === 'done' ? 'done' : 'failed'})` }))} onPick={id => onJump('quests', id)} />
          <DayLinks label="Loot" items={d.loot.map(l => ({ id: l.id, text: (l.qty > 1 ? `${l.qty}× ` : '') + (l.name || 'Item') }))} onPick={id => onJump('loot', id)} />
        </article>
      ))}
    </section>
  )
}

function DayLinks({ label, items, onPick }: { label: string; items: { id: string; text: string }[]; onPick: (id: string) => void }) {
  if (!items.length) return null
  return (
    <p className="day-links">
      <span className="small strong">{label}:</span>
      {items.map(i => <button key={i.id} type="button" className="chip" onClick={() => onPick(i.id)}>{i.text}</button>)}
    </p>
  )
}

function NoteEditor({ note, recaps, onSave, onDelete, onDone }: {
  note: SessionNote
  recaps: Session[]
  onSave: (n: SessionNote) => void
  onDelete: (id: string) => void
  onDone: () => void
}) {
  const set = (patch: Partial<SessionNote>) => onSave({ ...note, ...patch })
  return (
    <div className="note editing">
      <div className="fields two">
        <Text label="Title" value={note.title} placeholder="The ambush at Triboar" onChange={title => set({ title })} autoFocus />
        <DateField label="Session date" value={note.date} onChange={date => set({ date })} />
      </div>
      <label className="field">
        <span className="small strong">What happened</span>
        <textarea rows={6} value={note.body} onChange={e => set({ body: e.target.value })} placeholder="Where you went, who you fought, what you learned…" />
      </label>
      {recaps.length > 0 && (
        <label className="field">
          <span className="small strong">Linked recap</span>
          <select value={note.recapSessionId ?? ''} onChange={e => set({ recapSessionId: e.target.value || undefined })}>
            <option value="">None</option>
            {recaps.map(r => <option key={r.id} value={r.id}>{r.title} · {formatDate(dateOf(r.startedAt))}</option>)}
          </select>
        </label>
      )}
      <EditorActions onDone={onDone} onDelete={() => confirm('Delete this note?') && onDelete(note.id)} />
    </div>
  )
}

function Quests({ list, stamp, ...p }: ListProps<Quest> & { list: Quest[]; stamp: SessionDate }) {
  const [filter, setFilter] = useState<QuestStatus | 'all'>('all')
  const quests = sortQuests(list).filter(q => filter === 'all' || q.status === filter || q.id === p.editing)
  return (
    <section className="list">
      <div className="row">
        <button type="button" className="btn primary" onClick={p.onAdd}>+ New quest</button>
        {(['all', 'active', 'done', 'failed'] as const).map(f => (
          <button key={f} type="button" className={`chip ${filter === f ? 'on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>
      {quests.length === 0 && <div className="panel empty"><p>No quests here.</p></div>}
      <div className="cards">
        {quests.map(q => p.editing === q.id
          ? <QuestEditor key={q.id} quest={q} stamp={stamp} onSave={p.onSave} onDelete={p.onDelete} onDone={() => p.setEditing(null)} />
          : <QuestCard key={q.id} quest={q} stamp={stamp} onSave={p.onSave} onEdit={() => p.setEditing(q.id)} />)}
      </div>
    </section>
  )
}

function QuestCard({ quest: q, stamp, onSave, onEdit }: { quest: Quest; stamp: SessionDate; onSave: (q: Quest) => void; onEdit: () => void }) {
  const { done, total } = questProgress(q)
  return (
    <article className={`panel card quest status-${q.status}`}>
      <header>
        <h3>{q.title || 'Untitled quest'}</h3>
        <span className="tag">{STATUS_LABEL[q.status]}</span>
      </header>
      {(q.giver || q.reward) && <p className="small muted">{[q.giver && `From ${q.giver}`, q.reward && `Reward: ${q.reward}`].filter(Boolean).join(' · ')}</p>}
      {total > 0 && (
        <>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Objectives done"><div style={{ width: `${(done / total) * 100}%` }} /></div>
          <ul className="plain objectives">
            {q.objectives.map(o => (
              <li key={o.id}>
                <label>
                  <input type="checkbox" checked={o.done} onChange={() => onSave({ ...q, objectives: q.objectives.map(x => x.id === o.id ? { ...x, done: !x.done } : x) })} />
                  <span className={o.done ? 'struck' : ''}>{o.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {q.notes.trim() && <p className="body small">{q.notes}</p>}
      <p className="hint">Started {formatDate(q.startedOn)}{q.closedOn ? ` · ${q.status === 'done' ? 'completed' : 'failed'} ${formatDate(q.closedOn)}` : ''}</p>
      <div className="row">
        {q.status === 'active'
          ? <button type="button" className="btn small" onClick={() => onSave(setQuestStatus(q, 'done', stamp))}>Mark done</button>
          : <button type="button" className="btn small" onClick={() => onSave(setQuestStatus(q, 'active', stamp))}>Reopen</button>}
        <button type="button" className="btn ghost small" onClick={onEdit}>Edit</button>
      </div>
    </article>
  )
}

function QuestEditor({ quest: q, stamp, onSave, onDelete, onDone }: {
  quest: Quest
  stamp: SessionDate
  onSave: (q: Quest) => void
  onDelete: (id: string) => void
  onDone: () => void
}) {
  const [step, setStep] = useState('')
  const set = (patch: Partial<Quest>) => onSave({ ...q, ...patch })
  const addStep = () => {
    if (!step.trim()) return
    set({ objectives: [...q.objectives, newObjective(step.trim())] })
    setStep('')
  }
  return (
    <article className="panel card editing">
      <Text label="Quest" value={q.title} placeholder="Find the missing caravan" onChange={title => set({ title })} autoFocus />
      <div className="fields two">
        <Text label="Given by" value={q.giver} placeholder="Sildar Hallwinter" onChange={giver => set({ giver })} />
        <Text label="Reward" value={q.reward} placeholder="50 gp" onChange={reward => set({ reward })} />
      </div>
      <div className="fields two">
        <label className="field">
          <span className="small strong">Status</span>
          <select value={q.status} onChange={e => onSave(setQuestStatus(q, e.target.value as QuestStatus, stamp))}>
            {(Object.keys(STATUS_LABEL) as QuestStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <DateField label="Started" value={q.startedOn} onChange={startedOn => set({ startedOn })} />
      </div>
      <div className="field">
        <span className="small strong">Objectives</span>
        <ul className="plain objectives">
          {q.objectives.map(o => (
            <li key={o.id} className="row">
              <input type="checkbox" aria-label={`Done: ${o.text}`} checked={o.done} onChange={() => set({ objectives: q.objectives.map(x => x.id === o.id ? { ...x, done: !x.done } : x) })} />
              <input className="grow" aria-label="Objective" value={o.text} onChange={e => set({ objectives: q.objectives.map(x => x.id === o.id ? { ...x, text: e.target.value } : x) })} />
              <button type="button" className="btn ghost small" aria-label={`Remove ${o.text}`} onClick={() => set({ objectives: removeById(q.objectives, o.id) })}>✕</button>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={e => { e.preventDefault(); addStep() }}>
          <input className="grow" value={step} onChange={e => setStep(e.target.value)} placeholder="Add an objective" aria-label="New objective" />
          <button className="btn small" disabled={!step.trim()}>Add</button>
        </form>
      </div>
      <label className="field">
        <span className="small strong">Notes</span>
        <textarea rows={3} value={q.notes} onChange={e => set({ notes: e.target.value })} />
      </label>
      <EditorActions onDone={onDone} onDelete={() => confirm('Delete this quest?') && onDelete(q.id)} />
    </article>
  )
}

function People({ list, ...p }: ListProps<Npc> & { list: Npc[] }) {
  return (
    <section className="list">
      <div className="row"><button type="button" className="btn primary" onClick={p.onAdd}>+ New person</button></div>
      {list.length === 0 && <div className="panel empty"><p>No one logged yet. Add the NPCs you meet so you remember their names next session.</p></div>}
      <div className="cards">
        {sortNpcs(list).map(n => p.editing === n.id
          ? <NpcEditor key={n.id} npc={n} onSave={p.onSave} onDelete={p.onDelete} onDone={() => p.setEditing(null)} />
          : (
            <article key={n.id} className={`panel card npc att-${n.attitude} ${n.alive ? '' : 'dead'}`}>
              <header>
                <h3>{n.name || 'Unnamed'}</h3>
                <span className="tag">{n.alive ? n.attitude : 'dead'}</span>
              </header>
              {(n.role || n.place) && <p className="small muted">{[n.role, n.place].filter(Boolean).join(' · ')}</p>}
              {n.notes.trim() && <p className="body small">{n.notes}</p>}
              <p className="hint">Met {formatDate(n.metOn)}</p>
              <div className="row"><button type="button" className="btn ghost small" onClick={() => p.setEditing(n.id)}>Edit</button></div>
            </article>
          ))}
      </div>
    </section>
  )
}

function NpcEditor({ npc: n, onSave, onDelete, onDone }: { npc: Npc; onSave: (n: Npc) => void; onDelete: (id: string) => void; onDone: () => void }) {
  const set = (patch: Partial<Npc>) => onSave({ ...n, ...patch })
  return (
    <article className="panel card editing">
      <Text label="Name" value={n.name} placeholder="Toblen Stonehill" onChange={name => set({ name })} autoFocus />
      <div className="fields two">
        <Text label="Who they are" value={n.role} placeholder="Innkeeper" onChange={role => set({ role })} />
        <Text label="Where" value={n.place} placeholder="Phandalin" onChange={place => set({ place })} />
      </div>
      <div className="fields two">
        <label className="field">
          <span className="small strong">Attitude</span>
          <select value={n.attitude} onChange={e => set({ attitude: e.target.value as Attitude })}>
            {ATTITUDES.map(a => <option key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</option>)}
          </select>
        </label>
        <DateField label="First met" value={n.metOn} onChange={metOn => set({ metOn })} />
      </div>
      <label className="row check">
        <input type="checkbox" checked={!n.alive} onChange={e => set({ alive: !e.target.checked })} /> Dead
      </label>
      <label className="field">
        <span className="small strong">Notes</span>
        <textarea rows={3} value={n.notes} onChange={e => set({ notes: e.target.value })} placeholder="What they want, what they told you" />
      </label>
      <EditorActions onDone={onDone} onDelete={() => confirm('Delete this person?') && onDelete(n.id)} />
    </article>
  )
}

function LootList({ list, ...p }: ListProps<Loot> & { list: Loot[] }) {
  const total = lootTotalGp(list)
  return (
    <section className="list">
      <div className="row">
        <button type="button" className="btn primary" onClick={p.onAdd}>+ Add loot</button>
        {total > 0 && <span className="muted small">Known value: {total.toLocaleString()} gp</span>}
      </div>
      {list.length === 0 && <div className="panel empty"><p>No loot logged. Record what you found and where, even the things you sold.</p></div>}
      <div className="cards">
        {sortLoot(list).map(l => p.editing === l.id
          ? <LootEditor key={l.id} loot={l} onSave={p.onSave} onDelete={p.onDelete} onDone={() => p.setEditing(null)} />
          : (
            <article key={l.id} className="panel card loot">
              <header>
                <h3>{l.qty > 1 ? `${l.qty}× ` : ''}{l.name || 'Item'}</h3>
                {l.valueGp !== undefined && <span className="tag">{l.valueGp.toLocaleString()} gp</span>}
              </header>
              {l.source && <p className="small muted">From {l.source}</p>}
              {l.notes.trim() && <p className="body small">{l.notes}</p>}
              <p className="hint">Found {formatDate(l.foundOn)}</p>
              <div className="row"><button type="button" className="btn ghost small" onClick={() => p.setEditing(l.id)}>Edit</button></div>
            </article>
          ))}
      </div>
    </section>
  )
}

function LootEditor({ loot: l, onSave, onDelete, onDone }: { loot: Loot; onSave: (l: Loot) => void; onDelete: (id: string) => void; onDone: () => void }) {
  const set = (patch: Partial<Loot>) => onSave({ ...l, ...patch })
  return (
    <article className="panel card editing">
      <Text label="Item" value={l.name} placeholder="Potion of healing" onChange={name => set({ name })} autoFocus />
      <div className="fields three">
        <label className="field">
          <span className="small strong">Qty</span>
          <input type="number" min={1} value={l.qty} onChange={e => set({ qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
        </label>
        <label className="field">
          <span className="small strong">Value (gp)</span>
          <input type="number" min={0} value={l.valueGp ?? ''} onChange={e => set({ valueGp: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <DateField label="Found" value={l.foundOn} onChange={foundOn => set({ foundOn })} />
      </div>
      <Text label="Where from" value={l.source} placeholder="Goblin chief's chest" onChange={source => set({ source })} />
      <label className="field">
        <span className="small strong">Notes</span>
        <textarea rows={2} value={l.notes} onChange={e => set({ notes: e.target.value })} placeholder="Who took it, sold for…" />
      </label>
      <EditorActions onDone={onDone} onDelete={() => confirm('Delete this loot?') && onDelete(l.id)} />
    </article>
  )
}

function Text({ label, value, placeholder, onChange, autoFocus }: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <label className="field">
      <span className="small strong">{label}</span>
      <input value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function DateField({ label, value, onChange }: { label: string; value: SessionDate; onChange: (v: SessionDate) => void }) {
  return (
    <label className="field">
      <span className="small strong">{label}</span>
      <input type="date" value={value} onChange={e => e.target.value && onChange(e.target.value)} />
    </label>
  )
}

function EditorActions({ onDone, onDelete }: { onDone: () => void; onDelete: () => void }) {
  return (
    <div className="row spread-tight">
      <button type="button" className="btn primary small" onClick={onDone}>Done</button>
      <button type="button" className="btn ghost small bad" onClick={onDelete}>Delete</button>
    </div>
  )
}

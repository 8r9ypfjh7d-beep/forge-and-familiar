// The Codex: the campaign's lore book. The DM writes chapters of typed entries in advance and reveals
// them as the party discovers things; players read what they have found, by chapter or as a timeline.
import { useEffect, useState } from 'react'
import { ConfirmDialog, PromptDialog } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n/useI18n'
import type { Party } from '../party/types'
import { EntryBody, metaKey, picture, typeKey } from './EntryView'
import { shrinkImage } from './image'
import { splitDocument } from './importDoc'
import {
  chaptersFor, closedBlocks, isDm, isUnread, moveEntry, nextOrder, openBlocks, problems, recipients, searchEntries,
  send, setBlockRevealed, tableLink, timeline, toggleTonight, tonightQueue, unreadCount, unsend, visibleHandouts,
} from './logic'
import { readableText } from './markup'
import { watchHandouts } from './cloud'
import {
  deleteChapter, deleteHandout, HandoutSpaceError, listChapters, listHandouts, markHandoutSeen, onHandoutsChanged,
  pinned, refreshHandouts, saveChapter, saveHandout, togglePin,
} from './store'
import { ENTRY_TYPES, META_FIELDS, PICTURE_TYPES, type EntryType, type LoreChapter, type LoreEntry } from './types'
import './lore.css'

const OPEN_EVENT = 'ff:lore-open'
let pendingOpen: string | null = null

/** Asks the Codex on screen (or the next one to mount) to open an entry, e.g. from the reveal moment. */
export function requestOpenEntry(id: string) {
  pendingOpen = id
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }))
}

function useCodex(partyId: string, userId: string) {
  const [entries, setEntries] = useState<LoreEntry[]>([])
  const [chapters, setChapters] = useState<LoreChapter[]>([])
  const [pins, setPins] = useState<string[]>([])
  useEffect(() => {
    let live = true
    const load = () => {
      listHandouts(partyId).then(l => { if (live) setEntries(l) })
      listChapters(partyId).then(l => { if (live) setChapters(l) })
      setPins(pinned(userId))
    }
    load()
    const off = onHandoutsChanged(load)
    // Cloud party: fetch now and on every change from another device.
    const refresh = () => { void refreshHandouts(partyId) }
    refresh()
    const offCloud = watchHandouts(partyId, refresh)
    return () => { live = false; off(); offCloud() }
  }, [partyId, userId])
  return { entries, chapters, pins }
}

/** "2 new" pill for a party card. Renders nothing when the player has read everything. */
export function HandoutBadge({ party, userId }: { party: Party; userId: string }) {
  const { t } = useI18n()
  const n = unreadCount(useCodex(party.id, userId).entries, party, userId)
  return n > 0 ? <span className="ff-handout-badge">{t('lore.newCount', { n })}</span> : null
}

type Mode = 'book' | 'timeline'

/** The Codex section of a campaign: the DM writes and reveals, players read. */
export function Codex({ party, userId, nameOf }: { party: Party; userId: string; nameOf: (userId: string) => string }) {
  const { t } = useI18n()
  const { entries, chapters, pins } = useCodex(party.id, userId)
  const [mode, setMode] = useState<Mode>('book')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<LoreEntry | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [newChapter, setNewChapter] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'entry' | 'chapter'; id: string; title: string } | null>(null)
  const dm = isDm(party, userId)
  const visible = visibleHandouts(entries, party, userId)
  const filtered = query.trim() ? searchEntries(visible, party, userId, query) : visible
  const groups = chaptersFor(chapters, filtered, party, userId)
  const tonight = dm ? tonightQueue(entries) : []
  const pinnedList = visible.filter(e => pins.includes(e.id))
  const open = visible.find(h => h.id === openId)

  const view = (h: LoreEntry) => {
    setOpenId(h.id)
    if (isUnread(h, party, userId)) markHandoutSeen(h.id, userId)
  }

  // Opened from the reveal moment, possibly before this Codex was on screen.
  useEffect(() => {
    const take = () => {
      const id = pendingOpen
      if (id && visible.some(e => e.id === id)) { pendingOpen = null; view(visible.find(e => e.id === id)!) }
    }
    take()
    window.addEventListener(OPEN_EVENT, take)
    return () => window.removeEventListener(OPEN_EVENT, take)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length])

  const addChapter = async (title: string) => {
    const now = new Date().toISOString()
    await saveChapter({ id: crypto.randomUUID(), partyId: party.id, title, order: chapters.length, teasers: 0, createdAt: now, updatedAt: now })
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    if (confirmDelete.kind === 'entry') await deleteHandout(confirmDelete.id)
    else await deleteChapter(confirmDelete.id)
  }

  return (
    <section className="ff-handouts ff-lore" aria-labelledby="lore-title">
      <div className="row spread wrap">
        <h3 id="lore-title">{t('lore.title')}</h3>
        <div className="glass-segmented" role="radiogroup" aria-label={t('lore.view')}>
          {(['book', 'timeline'] as Mode[]).map(m => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>{t(m === 'book' ? 'lore.book' : 'lore.timeline')}</button>
          ))}
        </div>
      </div>
      {dm && !editing && (
        <div className="row wrap lore-dm-actions">
          <button className="glass-btn small prominent" onClick={() => setEditing('new')}>{t('lore.newEntry')}</button>
          <button className="glass-btn small" onClick={() => setNewChapter(true)}>{t('lore.newChapter')}</button>
          <button className="glass-btn small" onClick={() => setImporting(true)}>{t('lore.pasteDoc')}</button>
        </div>
      )}
      {(visible.length > 3 || query) && (
        <input className="glass-field lore-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('lore.search')} aria-label={t('lore.search')} />
      )}

      {dm && tonight.length > 0 && !editing && (
        <div className="glass thin tonight">
          <span className="glass-eyebrow">{t('lore.tonight')}</span>
          <ul>
            {tonight.map(e => (
              <li key={e.id} className="row">
                <button className="tonight-title" onClick={() => view(e)}>{e.title}</button>
                <button className="glass-btn small prominent" disabled={problems(e).length > 0} onClick={() => saveHandout(send(e))}>{t('lore.reveal')}</button>
                <button className="glass-btn small ghost icon" aria-label={t('lore.unqueue')} onClick={() => saveHandout(toggleTonight(entries, e))}>✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dm && editing && (
        <Composer
          key={editing === 'new' ? 'new' : editing.id}
          party={party}
          userId={userId}
          chapters={chapters}
          entries={entries}
          initial={editing === 'new' ? undefined : editing}
          nameOf={nameOf}
          onDone={() => setEditing(null)}
        />
      )}

      {visible.length === 0 && groups.length === 0 ? (
        dm ? (
          !editing && (
            <div className="glass thin lore-empty-dm">
              <p>{t('lore.emptyDm')}</p>
              <button className="glass-btn prominent" onClick={() => setEditing('new')}>{t('lore.firstEntry')}</button>
            </div>
          )
        ) : <p className="muted small">{t('lore.emptyPlayer')}</p>
      ) : mode === 'timeline' ? (
        <Timeline entries={timeline(filtered, party, userId)} onOpen={view} />
      ) : (
        <>
          {!dm && pinnedList.length > 0 && (
            <ChapterSection title={t('lore.pinned')} entries={pinnedList} party={party} userId={userId} nameOf={nameOf} chapters={chapters} all={entries}
              onOpen={view} onEdit={setEditing} onDelete={e => setConfirmDelete({ kind: 'entry', id: e.id, title: e.title })} />
          )}
          {groups.map(g => (
            <ChapterSection
              key={g.chapter?.id ?? 'loose'}
              chapter={g.chapter ?? undefined}
              title={g.chapter?.title ?? (groups.length > 1 || chapters.length ? t('lore.unsorted') : '')}
              entries={g.entries}
              party={party}
              userId={userId}
              nameOf={nameOf}
              chapters={chapters}
              all={entries}
              onOpen={view}
              onEdit={setEditing}
              onDelete={e => setConfirmDelete({ kind: 'entry', id: e.id, title: e.title })}
              onDeleteChapter={g.chapter ? () => setConfirmDelete({ kind: 'chapter', id: g.chapter!.id, title: g.chapter!.title }) : undefined}
            />
          ))}
        </>
      )}

      {open && (
        <Viewer entry={open} party={party} userId={userId} visible={visible} pinned={pins.includes(open.id)}
          onOpen={view} onEdit={dm ? () => { setOpenId(null); setEditing(open) } : undefined} onClose={() => setOpenId(null)} />
      )}
      {importing && <ImportDialog party={party} userId={userId} chapters={chapters} entries={entries} onClose={() => setImporting(false)} />}
      <PromptDialog open={newChapter} title={t('lore.chapterName')} yes={t('lore.addChapter')} placeholder={t('lore.chapterExample')}
        onSubmit={v => { void addChapter(v) }} onClose={() => setNewChapter(false)} />
      <ConfirmDialog open={!!confirmDelete} title={t(confirmDelete?.kind === 'chapter' ? 'lore.confirmDeleteChapter' : 'lore.confirmDelete', { name: confirmDelete?.title ?? '' })}
        yes={t('common.delete')} onYes={() => { void doDelete() }} onClose={() => setConfirmDelete(null)} />
    </section>
  )
}

/** Kept for older imports: the section used to be called Hand-outs. */
export const Handouts = Codex

function ChapterSection({ chapter, title, entries, party, userId, nameOf, chapters, all, onOpen, onEdit, onDelete, onDeleteChapter }: {
  chapter?: LoreChapter
  title: string
  entries: LoreEntry[]
  party: Party
  userId: string
  nameOf: (id: string) => string
  chapters: LoreChapter[]
  all: LoreEntry[]
  onOpen: (e: LoreEntry) => void
  onEdit: (e: LoreEntry) => void
  onDelete: (e: LoreEntry) => void
  onDeleteChapter?: () => void
}) {
  const { t } = useI18n()
  const dm = isDm(party, userId)
  const [renaming, setRenaming] = useState(false)
  const i = chapter ? chapters.findIndex(c => c.id === chapter.id) : -1
  const swap = async (dir: -1 | 1) => {
    const other = chapters[i + dir]
    if (!chapter || !other) return
    await saveChapter({ ...chapter, order: other.order })
    await saveChapter({ ...other, order: chapter.order })
  }
  const teasers = !dm && chapter ? chapter.teasers : 0

  return (
    <div className="lore-chapter">
      {title && (
        <div className="row spread chapter-head">
          <h4>{title}</h4>
          {dm && chapter && (
            <div className="row">
              <button className="glass-btn small ghost icon" aria-label={t('lore.moveUp')} disabled={i <= 0} onClick={() => swap(-1)}>↑</button>
              <button className="glass-btn small ghost icon" aria-label={t('lore.moveDown')} disabled={i >= chapters.length - 1} onClick={() => swap(1)}>↓</button>
              <button className="glass-btn small ghost" onClick={() => setRenaming(true)}>{t('lore.rename')}</button>
              {onDeleteChapter && <button className="glass-btn small ghost" onClick={onDeleteChapter}>{t('common.delete')}</button>}
            </div>
          )}
        </div>
      )}
      {entries.length === 0 && teasers === 0 && dm && <p className="muted small">{t('lore.chapterEmpty')}</p>}
      <ul className="handout-grid">
        {entries.map(h => (
          <li key={h.id}>
            <EntryCard entry={h} party={party} userId={userId} nameOf={nameOf} all={all} onOpen={() => onOpen(h)} onEdit={() => onEdit(h)} onDelete={() => onDelete(h)} />
          </li>
        ))}
        {teasers > 0 && <li><div className="glass handout teaser"><span>?</span><span className="small muted">{t('lore.teaser', { n: teasers })}</span></div></li>}
      </ul>
      {chapter && (
        <PromptDialog open={renaming} title={t('lore.renameChapter')} yes={t('lore.rename')} placeholder={chapter.title}
          onSubmit={v => { void saveChapter({ ...chapter, title: v }) }} onClose={() => setRenaming(false)} />
      )}
    </div>
  )
}

function EntryCard({ entry: h, party, userId, nameOf, all, onOpen, onEdit, onDelete }: {
  entry: LoreEntry
  party: Party
  userId: string
  nameOf: (id: string) => string
  all: LoreEntry[]
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t, locale } = useI18n()
  const dm = isDm(party, userId)
  const unread = isUnread(h, party, userId)
  const link = h.kind === 'table' ? tableLink(h.url) : null
  const reach = recipients(h, party)
  const seen = reach.filter(id => h.seenBy[id])
  const toLabel = h.to === 'all' ? t('lore.everyone') : reach.map(nameOf).join(', ') || t('lore.nobody')
  const src = picture(h)
  const secrets = dm ? closedBlocks(h) : 0
  const preview = readableText(h.text, openBlocks(h, party, userId))

  return (
    <article className={`glass handout ${h.kind} ${h.sentAt ? '' : 'draft'} ${unread ? 'unread' : ''}`}>
      <button className="handout-open" onClick={onOpen} aria-label={t('lore.open', { name: h.title })}>
        {src
          ? <img src={src} alt="" />
          : h.kind === 'table'
            ? <span className="table-peek"><span aria-hidden="true">🗺️</span>{link && t('handouts.tableOn', { site: link.site })}</span>
            : <span className={`note-peek ${h.kind}`}>{preview || h.meta?.from || ''}</span>}
      </button>
      <div className="handout-meta">
        <div className="row wrap">
          <span className={`kind ${h.kind}`}>{t(typeKey(h.kind))}</span>
          {!h.sentAt && <span className="kind draft-tag">{t('lore.draft')}</span>}
          {!h.sentAt && h.teaser && <span className="kind draft-tag">{t('lore.teaserTag')}</span>}
          {h.tonight !== undefined && !h.sentAt && <span className="kind tonight-tag">★ {t('lore.tonight')}</span>}
          {unread && <span className="new-tag">{t('lore.new')}</span>}
          {secrets > 0 && <span className="kind secret-tag">{t('lore.secretsLeft', { n: secrets })}</span>}
        </div>
        <h4>{h.title}</h4>
        {dm ? (
          <p className="muted small">
            {t('lore.to', { who: toLabel })}
            {h.sentAt && <> · <span title={seen.map(nameOf).join(', ') || undefined}>{t('lore.seenBy', { n: seen.length, of: reach.length })}</span></>}
          </p>
        ) : (
          <p className="muted small">{h.sentAt && new Date(h.sentAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</p>
        )}
        {dm && (
          <div className="row wrap">
            {h.sentAt
              ? <button className="glass-btn small" onClick={() => saveHandout(unsend(h))}>{t('lore.takeBack')}</button>
              : <>
                <button className="glass-btn small prominent" disabled={problems(h).length > 0} onClick={() => saveHandout(send(h))}>{t('lore.reveal')}</button>
                <button className="glass-btn small ghost icon" aria-pressed={h.tonight !== undefined} aria-label={t('lore.queueTonight')} title={t('lore.queueTonight')}
                  onClick={() => saveHandout(toggleTonight(all, h))}>{h.tonight !== undefined ? '★' : '☆'}</button>
              </>}
            <button className="glass-btn small" onClick={onEdit}>{t('lore.edit')}</button>
            <button className="glass-btn small ghost icon" aria-label={t('lore.moveUp')} onClick={() => moveEntry(all, h.id, -1).forEach(e => saveHandout(e))}>↑</button>
            <button className="glass-btn small ghost icon" aria-label={t('lore.moveDown')} onClick={() => moveEntry(all, h.id, 1).forEach(e => saveHandout(e))}>↓</button>
            <button className="glass-btn small ghost" onClick={onDelete}>{t('common.delete')}</button>
          </div>
        )}
      </div>
    </article>
  )
}

function Timeline({ entries, onOpen }: { entries: LoreEntry[]; onOpen: (e: LoreEntry) => void }) {
  const { t, locale } = useI18n()
  if (!entries.length) return <p className="muted small">{t('lore.timelineEmpty')}</p>
  const dayOf = (e: LoreEntry) => new Date(e.sentAt!).toLocaleDateString(locale, { dateStyle: 'medium' })
  return (
    <ol className="lore-timeline">
      {entries.map((e, i) => {
        const day = dayOf(e)
        const head = i === 0 || day !== dayOf(entries[i - 1])
        return (
          <li key={e.id}>
            {head && <span className="timeline-day">{day}</span>}
            <button className="timeline-item" onClick={() => onOpen(e)}>
              <span className="kind">{t(typeKey(e.kind))}</span>
              <span className="timeline-title">{e.title}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Composer({ party, userId, chapters, entries, initial, nameOf, onDone }: {
  party: Party
  userId: string
  chapters: LoreChapter[]
  entries: LoreEntry[]
  initial?: LoreEntry
  nameOf: (id: string) => string
  onDone: () => void
}) {
  const { t } = useI18n()
  const [kind, setKind] = useState<EntryType>(initial?.kind ?? 'note')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [image, setImage] = useState(initial?.image)
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl)
  const [url, setUrl] = useState(initial?.url ?? '')
  const [meta, setMeta] = useState<NonNullable<LoreEntry['meta']>>(initial?.meta ?? {})
  const [chapterId, setChapterId] = useState(initial?.chapterId ?? chapters[0]?.id ?? '')
  const [teaser, setTeaser] = useState(initial?.teaser ?? false)
  const [to, setTo] = useState<LoreEntry['to']>(initial?.to ?? 'all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const players = party.members.map(m => m.userId).filter(id => id !== party.dmId)
  const hasPicture = PICTURE_TYPES.includes(kind)

  const draft = {
    kind, title, text, to, teaser, meta,
    image: hasPicture ? image : undefined,
    imageUrl: hasPicture ? imageUrl : undefined,
    url: kind === 'table' ? tableLink(url)?.url ?? url.trim() : undefined,
    chapterId: chapterId || undefined,
  }
  const missing = problems(draft)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      setImage(await shrinkImage(file, kind === 'map' ? 'map' : 'image'))
      setImageUrl(undefined)
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('lore.badImage'))
    } finally {
      setBusy(false)
    }
  }

  const save = async (andSend: boolean) => {
    const now = new Date().toISOString()
    const base: LoreEntry = initial ?? { id: crypto.randomUUID(), partyId: party.id, fromId: userId, seenBy: {}, createdAt: now, updatedAt: now, ...draft }
    const order = initial && (initial.chapterId ?? '') === chapterId ? initial.order : nextOrder(entries, chapterId || undefined)
    const next = { ...base, ...draft, order, title: title.trim(), text: text.trim() }
    try {
      await saveHandout(andSend ? send(next) : next)
      onDone()
    } catch (e) {
      setError(e instanceof HandoutSpaceError ? t('lore.noSpace') : t('lore.saveFailed'))
    }
  }

  const togglePlayer = (id: string) => {
    // From "Everyone", picking a player means just that player.
    if (to === 'all') return setTo([id])
    setTo(to.includes(id) ? to.filter(x => x !== id) : [...to, id])
  }

  return (
    <form className="glass composer" onSubmit={e => { e.preventDefault(); if (!missing.length) save(true) }}>
      <div className="row wrap">
        <div className="field grow">
          <label htmlFor="lore-kind">{t('lore.kind')}</label>
          <select id="lore-kind" className="glass-field" value={kind} onChange={e => setKind(e.target.value as EntryType)}>
            {ENTRY_TYPES.map(k => <option key={k} value={k}>{t(typeKey(k))}</option>)}
          </select>
        </div>
        <div className="field grow">
          <label htmlFor="lore-chapter">{t('lore.chapter')}</label>
          <select id="lore-chapter" className="glass-field" value={chapterId} onChange={e => setChapterId(e.target.value)}>
            <option value="">{t('lore.unsorted')}</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="handout-title">{t('lore.entryTitle')}</label>
        <input id="handout-title" className="glass-field" value={title} onChange={e => setTitle(e.target.value)} placeholder={t(`lore.example.${kind}` as `lore.example.${EntryType}`)} />
      </div>

      {META_FIELDS[kind].length > 0 && (
        <div className="row wrap meta-fields">
          {META_FIELDS[kind].map(f => (
            <div key={f} className="field grow">
              <label htmlFor={`lore-meta-${f}`}>{t(metaKey(f))}</label>
              <input id={`lore-meta-${f}`} className="glass-field" value={meta[f] ?? ''} onChange={e => setMeta({ ...meta, [f]: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {kind === 'table' && (
        <div className="field">
          <label htmlFor="handout-url">{t('handouts.tableLink')}</label>
          <input id="handout-url" className="glass-field" type="url" inputMode="url" dir="ltr" value={url}
            onChange={e => setUrl(e.target.value)} placeholder="https://www.owlbear.rodeo/room/…" aria-describedby="handout-url-hint" />
          <span id="handout-url-hint" className={`small ${url.trim() && !tableLink(url) ? 'bad' : 'muted'}`}>
            {url.trim() && !tableLink(url) ? t('handouts.tableBad') : t('handouts.tableHint')}
          </span>
        </div>
      )}

      {hasPicture && (
        <div className="field">
          <label htmlFor="handout-file">{kind === 'map' ? t('lore.mapImage') : kind === 'image' ? t('lore.picture') : t('lore.pictureOptional')}</label>
          <input id="handout-file" type="file" accept="image/*" onChange={e => pick(e.target.files?.[0])} />
          {busy && <span className="muted small">{t('lore.preparingImage')}</span>}
          {(imageUrl || image) && !busy && <img className="composer-preview" src={imageUrl ?? image} alt="" />}
        </div>
      )}

      {kind !== 'table' && (
        <div className="field">
          <label htmlFor="handout-text">{kind === 'image' || kind === 'map' ? t('lore.caption') : t('lore.text')}</label>
          <textarea id="handout-text" className="glass-field" rows={kind === 'image' || kind === 'map' ? 2 : 8} value={text} onChange={e => setText(e.target.value)}
            placeholder={t('lore.textHint')} />
          <span className="small muted">{t('lore.markupHint')}</span>
        </div>
      )}

      <fieldset className="field recipients">
        <legend>{t('lore.revealTo')}</legend>
        <div className="row wrap">
          <button type="button" className={`glass-chip ${to === 'all' ? 'on' : ''}`} aria-pressed={to === 'all'} onClick={() => setTo('all')}>{t('lore.everyone')}</button>
          {players.map(id => (
            <button key={id} type="button" className={`glass-chip ${to !== 'all' && to.includes(id) ? 'on' : ''}`}
              aria-pressed={to !== 'all' && to.includes(id)} onClick={() => togglePlayer(id)}>
              {nameOf(id)}
            </button>
          ))}
        </div>
        {players.length === 0 && <p className="muted small">{t('lore.noPlayers')}</p>}
      </fieldset>

      {!initial?.sentAt && (
        <label className="row small teaser-toggle">
          <input type="checkbox" checked={teaser} onChange={e => setTeaser(e.target.checked)} />
          <span>{t('lore.teaserToggle')}</span>
        </label>
      )}

      {error && <p className="bad small" role="alert">{error}</p>}
      <div className="row wrap">
        <button className="glass-btn prominent" disabled={missing.length > 0 || busy}>{initial?.sentAt ? t('lore.save') : t('lore.revealNow')}</button>
        {!initial?.sentAt && <button type="button" className="glass-btn" disabled={missing.length > 0 || busy} onClick={() => save(false)}>{t('lore.saveDraft')}</button>}
        <button type="button" className="glass-btn ghost" onClick={onDone}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

function Viewer({ entry: h, party, userId, visible, pinned: isPinned, onOpen, onEdit, onClose }: {
  entry: LoreEntry
  party: Party
  userId: string
  visible: LoreEntry[]
  pinned: boolean
  onOpen: (e: LoreEntry) => void
  onEdit?: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const dm = isDm(party, userId)
  const reach = recipients(h, party)
  const seen = reach.filter(id => h.seenBy[id])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="ff-handout-viewer" role="dialog" aria-modal="true" aria-label={h.title} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`glass-sheet viewer-body ${h.kind}`}>
        <header className="row spread">
          <div>
            <span className="kind">{t(typeKey(h.kind))}{!h.sentAt && <> · {t('lore.draft')}</>}</span>
            <h3>{h.title}</h3>
          </div>
          <button autoFocus className="glass-btn small ghost icon" onClick={onClose} aria-label={t('lore.close')}>✕</button>
        </header>
        <EntryBody entry={h} open={openBlocks(h, party, userId)} visible={visible} onOpen={onOpen}
          onToggleBlock={dm ? (i, open) => { void saveHandout(setBlockRevealed(h, i, open)) } : undefined} />
        <footer className="row wrap spread">
          {dm ? (
            <>
              <span className="muted small">{h.sentAt ? t('lore.seenBy', { n: seen.length, of: reach.length }) : t('lore.draftHint')}</span>
              <div className="row wrap">
                {h.sentAt
                  ? <button className="glass-btn small" onClick={() => saveHandout(unsend(h))}>{t('lore.takeBack')}</button>
                  : <button className="glass-btn small prominent" disabled={problems(h).length > 0} onClick={() => saveHandout(send(h))}>{t('lore.reveal')}</button>}
                {onEdit && <button className="glass-btn small" onClick={onEdit}>{t('lore.edit')}</button>}
              </div>
            </>
          ) : (
            <button className="glass-btn small" aria-pressed={isPinned} onClick={() => togglePin(userId, h.id)}>{isPinned ? t('lore.unpin') : t('lore.pin')}</button>
          )}
        </footer>
      </div>
    </div>
  )
}

function ImportDialog({ party, userId, chapters, entries, onClose }: { party: Party; userId: string; chapters: LoreChapter[]; entries: LoreEntry[]; onClose: () => void }) {
  const { t } = useI18n()
  const [doc, setDoc] = useState('')
  const [busy, setBusy] = useState(false)
  const parsed = splitDocument(doc, t('lore.overview'), t('lore.imported'))
  const count = parsed.reduce((n, c) => n + c.entries.length, 0)

  const run = async () => {
    setBusy(true)
    const now = new Date().toISOString()
    let order = chapters.length
    const known = new Map(chapters.map(c => [c.title.toLowerCase(), c]))
    const all = [...entries]
    for (const c of parsed) {
      let chapter = known.get(c.title.toLowerCase())
      if (!chapter) {
        chapter = await saveChapter({ id: crypto.randomUUID(), partyId: party.id, title: c.title, order: order++, teasers: 0, createdAt: now, updatedAt: now })
        known.set(c.title.toLowerCase(), chapter)
      }
      for (const e of c.entries) {
        const entry: LoreEntry = {
          id: crypto.randomUUID(), partyId: party.id, fromId: userId, kind: e.kind, title: e.title, text: e.text, to: 'all', seenBy: {},
          chapterId: chapter.id, order: nextOrder(all, chapter.id), createdAt: now, updatedAt: now,
        }
        all.push(entry)
        await saveHandout(entry)
      }
    }
    setBusy(false)
    onClose()
  }

  return (
    <div className="ff-handout-viewer" role="dialog" aria-modal="true" aria-label={t('lore.pasteDoc')} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="glass-sheet viewer-body note">
        <header className="row spread"><h3>{t('lore.pasteDoc')}</h3><button className="glass-btn small ghost icon" onClick={onClose} aria-label={t('lore.close')}>✕</button></header>
        <p className="muted small">{t('lore.pasteHint')}</p>
        <textarea className="glass-field" rows={12} value={doc} onChange={e => setDoc(e.target.value)} placeholder={t('lore.pasteExample')} autoFocus />
        <div className="row wrap spread">
          <span className="small muted">{t('lore.pastePreview', { chapters: parsed.length, entries: count })}</span>
          <button className="glass-btn prominent" disabled={!count || busy} onClick={run}>{t('lore.importDrafts')}</button>
        </div>
      </div>
    </div>
  )
}

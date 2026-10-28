import { useCallback, useEffect, useRef, useState } from 'react'
import type { Party } from '../party/types'
import { shrinkImage } from './image'
import { isDm, isUnread, problems, recipients, send, unreadCount, unsend, visibleHandouts } from './logic'
import { watchHandouts } from './cloud'
import { deleteHandout, HandoutSpaceError, listHandouts, markHandoutSeen, onHandoutsChanged, refreshHandouts, saveHandout } from './store'
import type { Handout, HandoutKind } from './types'
import './handouts.css'

const KIND_LABEL: Record<HandoutKind, string> = { note: 'Note', image: 'Picture', map: 'Map' }

function useHandouts(partyId: string): Handout[] {
  const [list, setList] = useState<Handout[]>([])
  useEffect(() => {
    let live = true
    const load = () => listHandouts(partyId).then(l => { if (live) setList(l) })
    load()
    const off = onHandoutsChanged(load)
    // Cloud party: fetch now and on every change from another device.
    const refresh = () => { void refreshHandouts(partyId) }
    refresh()
    const offCloud = watchHandouts(partyId, refresh)
    return () => { live = false; off(); offCloud() }
  }, [partyId])
  return list
}

/** "2 new" pill for a party card. Renders nothing when the player has read everything. */
export function HandoutBadge({ party, userId }: { party: Party; userId: string }) {
  const n = unreadCount(useHandouts(party.id), party, userId)
  return n > 0 ? <span className="ff-handout-badge">{n} new hand-out{n === 1 ? '' : 's'}</span> : null
}

/** Hand-outs section of a party: the DM writes and sends, players read. */
export function Handouts({ party, userId, nameOf }: { party: Party; userId: string; nameOf: (userId: string) => string }) {
  const all = useHandouts(party.id)
  const [editing, setEditing] = useState<Handout | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const dm = isDm(party, userId)
  const list = visibleHandouts(all, party, userId)
  const open = list.find(h => h.id === openId)

  const view = (h: Handout) => {
    setOpenId(h.id)
    if (isUnread(h, party, userId)) markHandoutSeen(h.id, userId)
  }

  return (
    <section className="ff-handouts" aria-labelledby="handouts-title">
      <div className="row spread">
        <h3 id="handouts-title">Hand-outs</h3>
        {dm && !editing && <button className="btn primary small" onClick={() => setEditing('new')}>+ New hand-out</button>}
      </div>

      {dm && editing && (
        <Composer
          key={editing === 'new' ? 'new' : editing.id}
          party={party}
          userId={userId}
          initial={editing === 'new' ? undefined : editing}
          nameOf={nameOf}
          onDone={() => setEditing(null)}
        />
      )}

      {list.length === 0 ? (
        <p className="muted small">
          {dm
            ? 'Prepare notes, pictures, and maps, then send them to the whole party or to one player.'
            : 'Nothing yet. Notes, pictures, and maps your DM shares will show up here.'}
        </p>
      ) : (
        <ul className="handout-grid">
          {list.map(h => (
            <li key={h.id}>
              <HandoutCard
                handout={h}
                party={party}
                userId={userId}
                nameOf={nameOf}
                onOpen={() => view(h)}
                onEdit={() => setEditing(h)}
              />
            </li>
          ))}
        </ul>
      )}

      {open && <Viewer handout={open} onClose={() => setOpenId(null)} />}
    </section>
  )
}

function HandoutCard({ handout: h, party, userId, nameOf, onOpen, onEdit }: {
  handout: Handout
  party: Party
  userId: string
  nameOf: (id: string) => string
  onOpen: () => void
  onEdit: () => void
}) {
  const dm = isDm(party, userId)
  const unread = isUnread(h, party, userId)
  const reach = recipients(h, party)
  const seen = reach.filter(id => h.seenBy[id])
  const toLabel = h.to === 'all' ? 'Everyone' : reach.map(nameOf).join(', ') || 'Nobody in the party'

  return (
    <article className={`panel handout ${h.sentAt ? '' : 'draft'} ${unread ? 'unread' : ''}`}>
      <button className="handout-open" onClick={onOpen} aria-label={`Open ${h.title}`}>
        {h.image
          ? <img src={h.image} alt="" />
          : <span className="note-peek">{h.text}</span>}
      </button>
      <div className="handout-meta">
        <div className="row">
          <span className={`kind ${h.kind}`}>{KIND_LABEL[h.kind]}</span>
          {!h.sentAt && <span className="kind draft-tag">Draft</span>}
          {unread && <span className="new-tag">New</span>}
        </div>
        <h4>{h.title}</h4>
        {dm ? (
          <p className="muted small">
            To {toLabel}
            {h.sentAt && <> · <span title={seen.map(nameOf).join(', ') || undefined}>seen by {seen.length} of {reach.length}</span></>}
          </p>
        ) : (
          <p className="muted small">{h.sentAt && new Date(h.sentAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
        )}
        {dm && (
          <div className="row">
            {h.sentAt
              ? <button className="btn small" onClick={() => saveHandout(unsend(h))}>Take back</button>
              : <button className="btn primary small" disabled={problems(h).length > 0} onClick={() => saveHandout(send(h))}>Send</button>}
            <button className="btn small" onClick={onEdit}>Edit</button>
            <button className="btn ghost small" onClick={() => confirm(`Delete "${h.title}"?`) && deleteHandout(h.id)}>Delete</button>
          </div>
        )}
      </div>
    </article>
  )
}

function Composer({ party, userId, initial, nameOf, onDone }: {
  party: Party
  userId: string
  initial?: Handout
  nameOf: (id: string) => string
  onDone: () => void
}) {
  const [kind, setKind] = useState<HandoutKind>(initial?.kind ?? 'note')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [image, setImage] = useState(initial?.image)
  const [to, setTo] = useState<Handout['to']>(initial?.to ?? 'all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const players = party.members.map(m => m.userId).filter(id => id !== party.dmId)

  const draft = { kind, title, text, image: kind === 'note' ? undefined : image, to }
  const missing = problems(draft)

  const pick = async (file: File | undefined, k: HandoutKind) => {
    if (!file || k === 'note') return
    setBusy(true)
    setError('')
    try {
      setImage(await shrinkImage(file, k))
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image couldn't be read.")
    } finally {
      setBusy(false)
    }
  }

  const save = async (andSend: boolean) => {
    const now = new Date().toISOString()
    const base: Handout = initial ?? { id: crypto.randomUUID(), partyId: party.id, fromId: userId, seenBy: {}, createdAt: now, updatedAt: now, ...draft }
    const next = { ...base, ...draft, title: title.trim(), text: text.trim() }
    try {
      await saveHandout(andSend ? send(next) : next)
      onDone()
    } catch (e) {
      setError(e instanceof HandoutSpaceError
        ? 'This device is out of space. Delete an old hand-out or use a smaller picture.'
        : 'Could not save the hand-out.')
    }
  }

  const togglePlayer = (id: string) => {
    // From "Everyone", picking a player means just that player.
    if (to === 'all') return setTo([id])
    setTo(to.includes(id) ? to.filter(x => x !== id) : [...to, id])
  }

  return (
    <form className="panel composer" onSubmit={e => { e.preventDefault(); if (!missing.length) save(true) }}>
      <div className="row" role="radiogroup" aria-label="Kind of hand-out">
        {(Object.keys(KIND_LABEL) as HandoutKind[]).map(k => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="handout-title">Title</label>
        <input id="handout-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'map' ? 'Map of Phandalin' : kind === 'image' ? 'The stranger at the inn' : "Letter from Gundren"} />
      </div>

      {kind !== 'note' && (
        <div className="field">
          <label htmlFor="handout-file">{kind === 'map' ? 'Map image' : 'Picture'}</label>
          <input id="handout-file" type="file" accept="image/*" onChange={e => pick(e.target.files?.[0], kind)} />
          {busy && <span className="muted small">Preparing image…</span>}
          {image && !busy && <img className="composer-preview" src={image} alt="Preview" />}
        </div>
      )}

      <div className="field">
        <label htmlFor="handout-text">{kind === 'note' ? 'Text' : 'Caption (optional)'}</label>
        <textarea id="handout-text" rows={kind === 'note' ? 7 : 2} value={text} onChange={e => setText(e.target.value)}
          placeholder={kind === 'note' ? 'Write it the way the players will read it.' : ''} />
      </div>

      <fieldset className="field recipients">
        <legend>Send to</legend>
        <div className="row">
          <button type="button" className={`chip ${to === 'all' ? 'on' : ''}`} aria-pressed={to === 'all'} onClick={() => setTo('all')}>Everyone</button>
          {players.map(id => (
            <button key={id} type="button" className={`chip ${to !== 'all' && to.includes(id) ? 'on' : ''}`}
              aria-pressed={to !== 'all' && to.includes(id)} onClick={() => togglePlayer(id)}>
              {nameOf(id)}
            </button>
          ))}
        </div>
        {players.length === 0 && <p className="muted small">No players have joined yet. You can still prepare hand-outs as drafts.</p>}
      </fieldset>

      {error && <p className="bad small" role="alert">{error}</p>}
      <div className="row">
        <button className="btn primary" disabled={missing.length > 0 || busy}>{initial?.sentAt ? 'Save' : 'Send now'}</button>
        {!initial?.sentAt && <button type="button" className="btn" disabled={missing.length > 0 || busy} onClick={() => save(false)}>Save as draft</button>}
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

function Viewer({ handout: h, onClose }: { handout: Handout; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="ff-handout-viewer" role="dialog" aria-modal="true" aria-label={h.title} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`viewer-body ${h.kind}`}>
        <header className="row spread">
          <h3>{h.title}</h3>
          <button ref={closeRef} className="btn ghost small" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {h.kind === 'map' && h.image ? <MapView src={h.image} alt={h.title} />
          : h.image ? <img className="viewer-image" src={h.image} alt={h.title} /> : null}
        {h.text && <div className={h.kind === 'note' ? 'parchment' : 'caption'}>{h.text}</div>}
      </div>
    </div>
  )
}

const ZOOMS = [1, 1.5, 2, 3, 4]

/** Map with zoom steps and drag to pan. */
function MapView({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  const setZoomKeepingCentre = useCallback((next: number) => {
    const el = box.current
    if (!el) return setZoom(next)
    const cx = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth
    const cy = (el.scrollTop + el.clientHeight / 2) / el.scrollHeight
    setZoom(next)
    requestAnimationFrame(() => {
      el.scrollLeft = cx * el.scrollWidth - el.clientWidth / 2
      el.scrollTop = cy * el.scrollHeight - el.clientHeight / 2
    })
  }, [])

  return (
    <div className="map-view">
      <div
        ref={box}
        className={`map-scroll ${zoom > 0 ? 'zoomed' : ''}`}
        onPointerDown={e => {
          const el = box.current!
          drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
          el.setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          const d = drag.current
          if (!d) return
          box.current!.scrollLeft = d.left - (e.clientX - d.x)
          box.current!.scrollTop = d.top - (e.clientY - d.y)
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
      >
        <img src={src} alt={alt} draggable={false} style={{ width: `${ZOOMS[zoom] * 100}%` }} />
      </div>
      <div className="row map-tools">
        <button className="btn small" onClick={() => setZoomKeepingCentre(Math.max(0, zoom - 1))} disabled={zoom === 0} aria-label="Zoom out">−</button>
        <span className="small muted num">{ZOOMS[zoom]}×</span>
        <button className="btn small" onClick={() => setZoomKeepingCentre(Math.min(ZOOMS.length - 1, zoom + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in">+</button>
        <button className="btn ghost small" onClick={() => setZoom(0)} disabled={zoom === 0}>Fit</button>
      </div>
    </div>
  )
}

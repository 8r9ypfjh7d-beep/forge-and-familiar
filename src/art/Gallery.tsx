// The sheet's Art card: portrait, battle map token art and a gallery of more pictures, with a viewer.
// Read-only sheets (the DM, a watcher) see the pictures without the buttons.
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { ArtPiece, Character } from '../model/character'
import type { Apply } from '../sheet/types'
import { canUpload, removeArt, storeArt } from './cloud'
import { ArtImageError } from './image'
import { addPieces, droppedArt, galleryOf, MAX_GALLERY, removePiece, setArt, setCaption, tokenArt, type ArtKind } from './logic'
import { PositionDialog } from './Position'
import './art.css'

export function ArtCard({ character, apply, readOnly }: { character: Character; apply: Apply; readOnly?: boolean }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState<ArtKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localNote, setLocalNote] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  // A new portrait or token waits here while the player positions it.
  const [framing, setFraming] = useState<{ kind: 'portrait' | 'token'; file: File } | null>(null)
  const pick = (kind: 'portrait' | 'token', files: File[]) => {
    if (files[0]?.type.startsWith('image/')) setFraming({ kind, file: files[0] })
    else void upload(kind, files)
  }
  const gallery = galleryOf(character)
  const token = tokenArt(character)

  const change = (label: string, fn: (c: Character) => Character) => {
    const gone = droppedArt(character, fn(character))
    apply(label, fn)
    if (gone.length) void removeArt(gone)
  }

  const upload = async (kind: ArtKind, files: File[]) => {
    if (!files.length) return
    setBusy(kind); setError(null)
    try {
      const stored = await Promise.all(files.slice(0, MAX_GALLERY).map(f => storeArt(f, kind, character.id)))
      setLocalNote(stored.some(s => !s.uploaded))
      if (kind === 'gallery') change(t('art.added', { n: stored.length }), c => addPieces(c, stored.map(s => ({ id: crypto.randomUUID(), url: s.url }))))
      else change(t(kind === 'portrait' ? 'art.portraitSet' : 'art.tokenSet'), c => setArt(c, kind, stored[0].url))
    } catch (e) {
      setError(t(e instanceof ArtImageError && e.message === 'not-image' ? 'art.notImage' : 'art.unreadable'))
    } finally { setBusy(null) }
  }

  const piece = gallery.find(p => p.id === open)
  return (
    <section className="card art-card" aria-labelledby="art-title">
      <h2 id="art-title">{t('art.title')}</h2>
      <div className="art-main">
        <figure className="art-slot">
          {character.portrait
            ? <button type="button" className="art-portrait" onClick={() => setOpen('portrait')} aria-label={t('art.viewPortrait')}><img src={character.portrait} alt="" /></button>
            : <div className="art-portrait portrait-empty" aria-hidden="true">{character.name.slice(0, 1)}</div>}
          <figcaption>{t('art.portrait')}</figcaption>
          {!readOnly && (
            <div className="art-actions">
              <FilePick label={character.portrait ? t('art.change') : t('art.upload')} busy={busy === 'portrait'} onFiles={f => pick('portrait', f)} />
              {character.portrait && <button type="button" className="glass-btn small" onClick={() => change(t('art.portraitRemoved'), c => setArt(c, 'portrait', undefined))}>{t('common.remove')}</button>}
            </div>
          )}
        </figure>
        <figure className="art-slot">
          {token
            ? <div className="art-token"><img src={token} alt="" /></div>
            : <div className="art-token portrait-empty" aria-hidden="true">{character.name.slice(0, 1)}</div>}
          <figcaption>{t('art.token')}{!character.token && character.portrait ? <span className="muted small art-hint">{t('art.tokenFromPortrait')}</span> : null}</figcaption>
          {!readOnly && (
            <div className="art-actions">
              <FilePick label={character.token ? t('art.change') : t('art.upload')} busy={busy === 'token'} onFiles={f => pick('token', f)} />
              {character.token && <button type="button" className="glass-btn small" onClick={() => change(t('art.tokenRemoved'), c => setArt(c, 'token', undefined))}>{t('common.remove')}</button>}
            </div>
          )}
        </figure>
      </div>

      <div className="art-gallery-head">
        <h3 className="sub-title">{t('art.gallery')} <span className="muted small">{gallery.length}/{MAX_GALLERY}</span></h3>
        {!readOnly && gallery.length < MAX_GALLERY && <FilePick multiple label={t('art.addPictures')} busy={busy === 'gallery'} onFiles={f => upload('gallery', f.slice(0, MAX_GALLERY - gallery.length))} />}
      </div>
      {gallery.length === 0
        ? <p className="muted small">{t(readOnly ? 'art.emptyReadOnly' : 'art.empty')}</p>
        : (
          <ul className="art-grid plain">
            {gallery.map(p => (
              <li key={p.id}>
                <button type="button" className="art-thumb" onClick={() => setOpen(p.id)} aria-label={p.caption || t('art.viewPicture')}>
                  <img src={p.url} alt="" loading="lazy" />
                  {p.caption && <span className="art-thumb-caption">{p.caption}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      {error && <p className="cs-warn" role="alert">{error}</p>}
      {localNote && !error && <p className="muted small" role="status">{t(canUpload() ? 'art.uploadFailed' : 'art.keptOnDevice')}</p>}

      {framing && (
        <PositionDialog key={framing.file.name + framing.file.lastModified} file={framing.file} round={framing.kind === 'token'}
          onClose={() => setFraming(null)} onDone={file => { const kind = framing.kind; setFraming(null); void upload(kind, [file]) }} />
      )}
      <ArtViewer
        open={!!open && (open === 'portrait' ? !!character.portrait : !!piece)}
        url={open === 'portrait' ? character.portrait : piece?.url}
        piece={piece} readOnly={readOnly} isPortrait={open === 'portrait'}
        isToken={!!piece && character.token === piece.url} isMainPortrait={!!piece && character.portrait === piece.url}
        onClose={() => setOpen(null)}
        onCaption={text => piece && change(t('art.captionSaved'), c => setCaption(c, piece.id, text))}
        onPortrait={() => piece && change(t('art.portraitSet'), c => setArt(c, 'portrait', piece.url))}
        onToken={() => piece && change(t('art.tokenSet'), c => setArt(c, 'token', piece.url))}
        onRemove={() => { if (piece) { setOpen(null); change(t('art.removed'), c => removePiece(c, piece.id)) } }}
      />
    </section>
  )
}

function FilePick({ label, busy, multiple, onFiles }: { label: string; busy: boolean; multiple?: boolean; onFiles: (f: File[]) => void }) {
  const { t } = useI18n()
  return (
    <label className={`glass-btn small${busy ? ' disabled' : ''}`} aria-busy={busy}>
      {busy ? t('art.uploading') : label}
      <input type="file" accept="image/*" hidden multiple={multiple} disabled={busy}
        onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; onFiles(files) }} />
    </label>
  )
}

function ArtViewer({ open, url, piece, readOnly, isPortrait, isToken, isMainPortrait, onClose, onCaption, onPortrait, onToken, onRemove }: {
  open: boolean; url?: string; piece?: ArtPiece; readOnly?: boolean; isPortrait: boolean; isToken: boolean; isMainPortrait: boolean
  onClose: () => void; onCaption: (text: string) => void; onPortrait: () => void; onToken: () => void; onRemove: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const [caption, setText] = useState(piece?.caption ?? '')
  const [forId, setForId] = useState(piece?.id)
  if (forId !== piece?.id) { setForId(piece?.id); setText(piece?.caption ?? '') }
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  const save = () => { if (piece && caption.trim() !== (piece.caption ?? '')) onCaption(caption) }
  return (
    <dialog ref={ref} className="art-viewer glass-sheet glass-dialog" aria-label={piece?.caption || t(isPortrait ? 'art.portrait' : 'art.viewPicture')}
      onCancel={e => { e.preventDefault(); save(); onClose() }}>
      {open && url && (
        <>
          <img className="art-viewer-img" src={url} alt={piece?.caption ?? ''} />
          {piece && (readOnly
            ? piece.caption && <p className="art-viewer-caption">{piece.caption}</p>
            : (
              <input className="glass-field" value={caption} maxLength={120} placeholder={t('art.captionPlaceholder')} aria-label={t('art.caption')}
                onChange={e => setText(e.target.value)} onBlur={save} />
            ))}
          <div className="art-viewer-actions">
            {piece && !readOnly && (
              <>
                <button type="button" className="glass-btn small" disabled={isMainPortrait} onClick={onPortrait}>{isMainPortrait ? t('art.isPortrait') : t('art.usePortrait')}</button>
                <button type="button" className="glass-btn small" disabled={isToken} onClick={onToken}>{isToken ? t('art.isToken') : t('art.useToken')}</button>
                <button type="button" className="glass-btn small danger" onClick={onRemove}>{t('common.remove')}</button>
              </>
            )}
            <button type="button" className="glass-btn prominent small" onClick={() => { save(); onClose() }}>{t('art.close')}</button>
          </div>
        </>
      )}
    </dialog>
  )
}

// How one entry reads: the body by type (parchment letter, poster, verse...), hidden blocks as redacted
// bars until revealed, [[links]] to other entries the reader may see, and a zoomable map.
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/locales/en'
import { resolveLink, tableLink } from './logic'
import { parseEntry, type Block, type Inline } from './markup'
import { META_FIELDS, type EntryType, type LoreEntry, type MetaField } from './types'

export const typeKey = (k: EntryType) => `lore.type.${k}` as MessageKey
export const metaKey = (f: MetaField) => `lore.meta.${f}` as MessageKey
export const picture = (h: LoreEntry) => h.imageUrl ?? h.image

/** Hidden blocks the reader sees, and for the DM a toggle per block. */
export interface EntryViewProps {
  entry: LoreEntry
  open: number[] | 'all'
  /** Entries links may point at (only ones the reader can see). */
  visible: LoreEntry[]
  onOpen?: (entry: LoreEntry) => void
  /** DM only: open or close a hidden block for the players. */
  onToggleBlock?: (index: number, open: boolean) => void
}

export function EntryBody({ entry: h, open, visible, onOpen, onToggleBlock }: EntryViewProps) {
  const { t } = useI18n()
  const link = h.kind === 'table' ? tableLink(h.url) : null
  const src = picture(h)
  const blocks = parseEntry(h.text, open)
  const meta = META_FIELDS[h.kind].filter(f => h.meta?.[f]?.trim())
  const line = (f: MetaField) => <span key={f} className={`meta-line ${f}`}><span className="meta-label">{t(metaKey(f))}</span> {h.meta![f]}</span>

  const text = blocks.length > 0 && (
    <div className={`lore-body ${h.kind}`}>
      {meta.filter(f => f !== 'signature' && f !== 'author').map(line)}
      {blocks.map((b, i) => <BlockView key={i} block={b} visible={visible} onOpen={onOpen} onToggleBlock={onToggleBlock} />)}
      {meta.filter(f => f === 'signature' || f === 'author').map(line)}
    </div>
  )

  return (
    <>
      {h.kind === 'map' && src ? <MapView src={src} alt={h.title} />
        : src ? <img className="viewer-image" src={src} alt={h.title} /> : null}
      {link && (
        <div className="table-open">
          <a className="glass-btn prominent" href={link.url} target="_blank" rel="noopener noreferrer">{t('handouts.openTable')} ↗</a>
          <span className="muted small">{t('handouts.tableOn', { site: link.site })}</span>
        </div>
      )}
      {text}
    </>
  )
}

function BlockView({ block: b, visible, onOpen, onToggleBlock }: { block: Block; visible: LoreEntry[]; onOpen?: (e: LoreEntry) => void; onToggleBlock?: (i: number, open: boolean) => void }) {
  const { t } = useI18n()
  const inl = (list: Inline[]) => <InlineView list={list} visible={visible} onOpen={onOpen} onToggleBlock={onToggleBlock} />
  switch (b.t) {
    case 'p': return <p>{inl(b.inl)}</p>
    case 'h': return b.level === 1 ? <h4>{inl(b.inl)}</h4> : <h5>{inl(b.inl)}</h5>
    case 'ul': return <ul>{b.items.map((it, i) => <li key={i}>{inl(it)}</li>)}</ul>
    case 'quote': return <blockquote>{inl(b.inl)}</blockquote>
    case 'hr': return <hr />
    case 'hidden':
      return (
        <div className={`hidden-block ${b.open ? 'open' : 'closed'}`}>
          {b.open
            ? b.blocks.map((x, i) => <BlockView key={i} block={x} visible={visible} onOpen={onOpen} onToggleBlock={onToggleBlock} />)
            : <span className="redacted" aria-label={t('lore.hiddenAria')} style={{ ['--w' as string]: Math.min(100, 12 + b.words * 6) + '%' }} />}
          {onToggleBlock && (
            <button type="button" className={`glass-btn small ${b.open ? '' : 'prominent'}`} onClick={() => onToggleBlock(b.index, !b.open)}>
              {b.open ? t('lore.hideBlock') : t('lore.revealBlock')}
            </button>
          )}
        </div>
      )
  }
}

function InlineView({ list, visible, onOpen, onToggleBlock }: { list: Inline[]; visible: LoreEntry[]; onOpen?: (e: LoreEntry) => void; onToggleBlock?: (i: number, open: boolean) => void }) {
  const { t } = useI18n()
  return (
    <>
      {list.map((x, i): ReactNode => {
        if (x.t === 'b') return <strong key={i}>{x.s}</strong>
        if (x.t === 'i') return <em key={i}>{x.s}</em>
        if (x.t === 'hidden') {
          return (
            <span key={i} className={`hidden-inline ${x.open ? 'open' : 'closed'}`}>
              {x.open
                ? <InlineView list={x.inl} visible={visible} onOpen={onOpen} onToggleBlock={onToggleBlock} />
                : <span className="redacted inline" aria-label={t('lore.hiddenAria')} style={{ ['--w' as string]: `${Math.min(14, 2 + x.words * 3)}ch` }} />}
              {onToggleBlock && (
                <button type="button" className="reveal-run" aria-label={x.open ? t('lore.hideBlock') : t('lore.revealBlock')} title={x.open ? t('lore.hideBlock') : t('lore.revealBlock')}
                  onClick={() => onToggleBlock(x.index, !x.open)}>{x.open ? '🙈' : '👁'}</button>
              )}
            </span>
          )
        }
        if (x.t === 'link') {
          const target = resolveLink(x.title, visible)
          return target && onOpen
            ? <button key={i} type="button" className="lore-link" onClick={() => onOpen(target)}>{x.title}</button>
            : <span key={i}>{x.title}</span>
        }
        return <span key={i}>{x.s}</span>
      })}
    </>
  )
}

const ZOOMS = [1, 1.5, 2, 3, 4]

/** Map with zoom steps and drag to pan. */
export function MapView({ src, alt }: { src: string; alt: string }) {
  const { t } = useI18n()
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
        <button className="glass-btn small" onClick={() => setZoomKeepingCentre(Math.max(0, zoom - 1))} disabled={zoom === 0} aria-label={t('lore.zoomOut')}>−</button>
        <span className="small muted num">{ZOOMS[zoom]}×</span>
        <button className="glass-btn small" onClick={() => setZoomKeepingCentre(Math.min(ZOOMS.length - 1, zoom + 1))} disabled={zoom === ZOOMS.length - 1} aria-label={t('lore.zoomIn')}>+</button>
        <button className="glass-btn small ghost" onClick={() => setZoom(0)} disabled={zoom === 0}>{t('lore.fit')}</button>
      </div>
    </div>
  )
}

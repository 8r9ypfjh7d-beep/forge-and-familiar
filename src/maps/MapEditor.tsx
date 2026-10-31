// The DM's map editor: paint terrain cell by cell or by dragging a rectangle, put a picture under the grid and fit
// the grid to it, add labels, cover and reveal fog, and mark the edge the party enters from. Every change goes
// out through onChange; the Maps tab saves it.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { PromptDialog } from '../builder/ConfirmDialog'
import { shrinkImage } from '../lore/image'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/locales/en'
import {
  clampCells, coverFog, fitPicture, inBounds, labelAt, paintRect, rectBetween, removePicture, resizeMap, revealFog, setLabel, setPicture,
} from './logic'
import { cellAtPoint, cellName, describeCell, drawMap, TERRAIN_GLYPH } from './render'
import { MAX_CELLS, MIN_CELLS, type BattleMapDef, type Cell, type Diagonals, type Edge, type Rect, type Terrain } from './types'

type Tool = 'pan' | Terrain | 'label' | 'cover' | 'reveal'
const TOOLS: Tool[] = ['pan', 'floor', 'wall', 'difficult', 'water', 'door', 'doorOpen', 'hazard', 'stairs', 'label', 'cover', 'reveal']
const TOOL_GLYPH: Record<Tool, string> = { ...TERRAIN_GLYPH, pan: '✋', floor: '◻', wall: '■', label: 'Aa', cover: '▒', reveal: '☀' }
const EDGES: (Edge | 'none')[] = ['none', 'n', 's', 'e', 'w']
const ZOOMS = [16, 22, 30, 40, 52]

export function MapEditor({ map, onChange, onBack, status }: { map: BattleMapDef; onChange: (m: BattleMapDef) => void; onBack: () => void; status?: string }) {
  const { t } = useI18n()
  const [tool, setTool] = useState<Tool>('wall')
  const [phone] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 559px)').matches)
  const [zoom, setZoom] = useState(2)
  const [drag, setDrag] = useState<{ from: Cell; to: Cell } | null>(null)
  const [cursor, setCursor] = useState<Cell>({ x: 0, y: 0 })
  const [labelCell, setLabelCell] = useState<Cell | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [picture, setPictureEl] = useState<HTMLImageElement | null>(null)
  const px = ZOOMS[zoom]

  // Decode the picture once per source.
  const src = map.picture?.src
  useEffect(() => {
    const img = new Image()
    let live = true
    img.onload = () => { if (live) setPictureEl(img) }
    if (src) img.src = src
    return () => { live = false }
  }, [src])
  const pictureEl = src && picture?.src === src ? picture : null

  const highlight: Rect | null = drag ? rectBetween(drag.from, drag.to) : null
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawMap(ctx, map, { cellPx: px, picture: pictureEl, fog: 'dm', highlight })
  }, [map, px, pictureEl, highlight])

  const apply = useCallback((rect: Rect) => {
    if (tool === 'pan') return
    if (tool === 'label') { setLabelCell({ x: rect.x, y: rect.y }); return }
    if (tool === 'cover') onChange(coverFog(map, rect))
    else if (tool === 'reveal') onChange(revealFog(map, rect))
    else onChange(paintRect(map, rect, tool))
  }, [tool, map, onChange])

  const cellFromEvent = (e: PointerEvent<HTMLCanvasElement>): Cell => {
    const r = e.currentTarget.getBoundingClientRect()
    const c = cellAtPoint(px, e.clientX - r.left, e.clientY - r.top)
    return { x: Math.min(map.width - 1, Math.max(0, c.x)), y: Math.min(map.height - 1, Math.max(0, c.y)) }
  }
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'pan') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const c = cellFromEvent(e)
    setCursor(c)
    setDrag({ from: c, to: c })
  }
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = cellFromEvent(e)
    if (drag) setDrag({ from: drag.from, to: c })
    else if (e.pointerType === 'mouse') setCursor(c)
  }
  const up = () => {
    if (!drag) return
    apply(rectBetween(drag.from, drag.to))
    setDrag(null)
  }

  const key = (e: KeyboardEvent<HTMLCanvasElement>) => {
    // The map is a picture of the room: it never mirrors in Hebrew, so arrows move the way they point.
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (dx || dy) {
      e.preventDefault()
      setCursor(c => ({ x: Math.min(map.width - 1, Math.max(0, c.x + dx)), y: Math.min(map.height - 1, Math.max(0, c.y + dy)) }))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      apply({ ...cursor, w: 1, h: 1 })
    }
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const src = await shrinkImage(file, 'map')
      const img = await decode(src)
      onChange(setPicture(map, { src, width: img.width, height: img.height }, map.width))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('maps.badImage'))
    } finally {
      setBusy(false)
    }
  }

  const sizeField = (field: 'width' | 'height') => (
    <label className="maps-num">
      <span>{t(field === 'width' ? 'maps.width' : 'maps.height')}</span>
      <input type="number" min={MIN_CELLS} max={MAX_CELLS} value={map[field]} disabled={!!map.picture}
        onChange={e => onChange(resizeMap(map, field === 'width' ? clampCells(+e.target.value) : map.width, field === 'height' ? clampCells(+e.target.value) : map.height))} />
    </label>
  )

  const cellLine = (c: Cell) => {
    const d = describeCell(map, c.x, c.y)
    const what = [t(d.terrain === 'floor' ? 'maps.floor' : `maps.tool.${d.terrain}` as MessageKey), d.label, d.fog ? t('maps.fog') : ''].filter(Boolean).join(', ')
    return t('maps.cell', { cell: cellName(c.x, c.y), what })
  }

  const existing = labelCell ? labelAt(map, labelCell.x, labelCell.y) : undefined
  const canvasLabel = t('maps.canvas', { w: map.width, h: map.height })

  return (
    <div className="ff-maps-editor">
      <div className="maps-head">
        <button type="button" className="glass-btn" onClick={onBack}>{t('common.backArrow')} {t('maps.back')}</button>
        <input className="glass-field maps-name" value={map.name} placeholder={t('maps.untitled')} aria-label={t('maps.name')}
          onChange={e => onChange({ ...map, name: e.target.value })} />
        {status && <span className="hint maps-status" role="status">{status}</span>}
      </div>

      {/* Set once per map, so folded on phones: the tools and the grid share the first screen there. */}
      <details className="maps-setup" open={!phone}>
      <summary className="maps-setup-sum">{t('maps.setup')}</summary>
      <div className="maps-settings">
        {sizeField('width')}
        {sizeField('height')}
        <label className="maps-num">
          <span>{t('maps.diagonals')}</span>
          <select value={map.diagonals} onChange={e => onChange({ ...map, diagonals: e.target.value as Diagonals })}>
            <option value="5">{t('maps.diag.5')}</option>
            <option value="5-10-5">{t('maps.diag.5-10-5')}</option>
          </select>
        </label>
        <label className="maps-num">
          <span>{t('maps.partyEdge')}</span>
          <select value={map.partyEdge ?? 'none'} onChange={e => onChange({ ...map, partyEdge: e.target.value === 'none' ? undefined : e.target.value as Edge })}>
            {EDGES.map(e => <option key={e} value={e}>{t(`maps.edge.${e}` as MessageKey)}</option>)}
          </select>
        </label>
      </div>

      <div className="maps-picture">
        <span className="maps-picture-title">{t('maps.picture')}</span>
        <label className={`glass-btn maps-file${busy ? ' is-busy' : ''}`}>
          <input type="file" accept="image/*" disabled={busy} onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          {map.picture ? t('maps.replacePicture') : t('maps.addPicture')}
        </label>
        {map.picture && <button type="button" className="glass-btn" onClick={() => onChange(removePicture(map))}>{t('maps.removePicture')}</button>}
        {error && <p className="hint maps-error" role="alert">{error}</p>}
        {map.picture && (
          <div className="maps-fit">
            <label><span>{t('maps.cellSize')}</span>
              <input type="range" min={Math.max(4, Math.ceil(map.picture.width / MAX_CELLS))} max={Math.floor(map.picture.width / MIN_CELLS)} step={0.5}
                value={map.picture.cell} onChange={e => onChange(fitPicture(map, { cell: +e.target.value }))} /></label>
            <label><span>{t('maps.offsetX')}</span>
              <input type="range" min={0} max={Math.floor(map.picture.cell)} step={1} value={map.picture.offsetX}
                onChange={e => onChange(fitPicture(map, { offsetX: +e.target.value }))} /></label>
            <label><span>{t('maps.offsetY')}</span>
              <input type="range" min={0} max={Math.floor(map.picture.cell)} step={1} value={map.picture.offsetY}
                onChange={e => onChange(fitPicture(map, { offsetY: +e.target.value }))} /></label>
            <p className="hint">{t('maps.pictureHint')}</p>
          </div>
        )}
      </div>

      </details>

      <div className="maps-tools" role="toolbar" aria-label={t('maps.tools')}>
        {TOOLS.map(id => (
          <button key={id} type="button" className={`glass-chip maps-tool${tool === id ? ' on' : ''}`} title={t(`maps.tool.${id}` as MessageKey)} aria-pressed={tool === id} onClick={() => setTool(id)}>
            <span className="maps-tool-glyph" aria-hidden="true" data-terrain={id}>{TOOL_GLYPH[id]}</span>
            <span className="maps-tool-name">{t(`maps.tool.${id}` as MessageKey)}</span>
          </button>
        ))}
      </div>
      <p className="hint">{t('maps.toolHint')}</p>

      <div className="maps-zoom">
        <button type="button" className="glass-btn" aria-label={t('maps.zoomOut')} disabled={zoom === 0} onClick={() => setZoom(z => z - 1)}>−</button>
        <button type="button" className="glass-btn" aria-label={t('maps.zoomIn')} disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(z => z + 1)}>+</button>
        <span className="hint maps-cell" aria-live="polite">{cellLine(cursor)}</span>
      </div>

      <div className={`maps-scroll${tool === 'pan' ? ' is-pan' : ''}`}>
        <canvas ref={canvasRef} className="maps-canvas" width={map.width * px} height={map.height * px} tabIndex={0} role="img" aria-label={canvasLabel}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)} onKeyDown={key} />
      </div>

      <PromptDialog open={!!labelCell} title={t('maps.labelAsk', { cell: labelCell ? cellName(labelCell.x, labelCell.y) : '' })} yes={t('maps.saveLabel')}
        placeholder={existing?.text ?? t('maps.labelPlaceholder')}
        onSubmit={text => {
          if (labelCell && inBounds(map, labelCell.x, labelCell.y)) onChange(setLabel(map, { id: existing?.id ?? crypto.randomUUID(), ...labelCell, text }))
          setLabelCell(null)
        }}
        onClose={() => setLabelCell(null)} />
    </div>
  )
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('bad image'))
    img.src = src
  })
}

/** A small read-only drawing of a map for list rows. */
export function MapThumb({ map }: { map: BattleMapDef }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const px = Math.max(2, Math.floor(120 / Math.max(map.width, map.height)))
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    if (!map.picture) { drawMap(ctx, map, { cellPx: px, fog: 'dm', labels: false }); return }
    const img = new Image()
    img.onload = () => { if (ref.current) drawMap(ctx, map, { cellPx: px, picture: img, fog: 'dm', labels: false }) }
    img.src = map.picture.src
    drawMap(ctx, map, { cellPx: px, fog: 'dm', labels: false })
  }, [map, px])
  return <canvas ref={ref} className="maps-thumb" width={map.width * px} height={map.height * px} aria-hidden="true" />
}

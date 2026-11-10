// "Position the picture": drag a new portrait or token under a square frame (and zoom) before it is saved,
// so the card and the round token show the face, not the middle of the picture.
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useI18n } from '../i18n'
import { CENTRED, dragFraming, framedSquare, type Framing } from './logic'

const VIEW = 240
const OUT_MAX = 1024

/** Cuts the framed square out of a picture as a JPEG file. */
async function cut(img: HTMLImageElement, f: Framing, name: string): Promise<File> {
  const { sx, sy, side } = framedSquare(img.naturalWidth, img.naturalHeight, f)
  const out = Math.round(Math.min(side, OUT_MAX))
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#1d1a24'
  ctx.fillRect(0, 0, out, out)
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9))
  if (!blob) throw new Error('unreadable')
  return new File([blob], name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

export function PositionDialog({ file, round, onDone, onClose }: {
  /** The picture just picked. */
  file: File
  /** Token art: shows the round cut. */
  round: boolean
  /** The square file to save, or the picture as picked ("Keep whole picture"). */
  onDone: (file: File) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [f, setF] = useState<Framing>(CENTRED)
  const drag = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.() }, [])

  const box = size ? framedSquare(size.w, size.h, f) : null
  const scale = box ? VIEW / box.side : 1
  const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; (e.target as Element).setPointerCapture?.(e.pointerId) }
  const move = (e: PointerEvent) => {
    if (!drag.current || !size) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    setF(v => dragFraming(size.w, size.h, v, dx, dy, VIEW))
  }
  const use = async () => {
    if (!img.current) return
    try { onDone(await cut(img.current, f, file.name)) } catch { onDone(file) }
  }

  return (
    <dialog ref={ref} className="confirm-dialog art-position glass-sheet glass-dialog" aria-labelledby="art-position-title" onCancel={e => { e.preventDefault(); onClose() }}>
      <p id="art-position-title" className="confirm-dialog-title">{t('art.position')}</p>
      <p className="muted small">{t('art.positionHint')}</p>
      <div dir="ltr" className={`art-position-view${round ? ' round' : ''}`} style={{ inlineSize: VIEW, blockSize: VIEW }}
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
        onKeyDown={e => {
          const step = { ArrowLeft: [12, 0], ArrowRight: [-12, 0], ArrowUp: [0, 12], ArrowDown: [0, -12] }[e.key]
          if (step && size) { e.preventDefault(); setF(v => dragFraming(size.w, size.h, v, step[0], step[1], VIEW)) }
        }}
        tabIndex={0} role="img" aria-label={t('art.positionHint')}>
        {url && <img ref={img} src={url} alt="" draggable={false} onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={box && size ? { inlineSize: size.w * scale, blockSize: size.h * scale, left: 0, top: 0, transform: `translate(${-box.sx * scale}px, ${-box.sy * scale}px)` } : { opacity: 0 }} />}
      </div>
      <label className="art-position-zoom small">
        {t('art.zoom')}
        <input type="range" min={1} max={3} step={0.05} value={f.zoom} onChange={e => setF(v => ({ ...v, zoom: Number(e.target.value) }))} />
      </label>
      <div className="confirm-dialog-actions">
        <button type="button" className="glass-btn prominent" disabled={!size} onClick={use}>{t('art.positionUse')}</button>
        <button type="button" className="glass-btn" onClick={() => onDone(file)}>{t('art.positionSkip')}</button>
      </div>
    </dialog>
  )
}

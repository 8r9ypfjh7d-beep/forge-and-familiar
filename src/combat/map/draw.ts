// Canvas painting for the battle map: picture, grid, terrain, labels, fog, a planned path and a measure line.
// Pure apart from the canvas context it is given. Colours come in as a palette read from the page's CSS tokens,
// so the canvas follows light, dark and high-contrast modes.
import { cellKey, terrainAt } from '../../maps/logic'
import type { BattleMapDef, Cell, Terrain } from '../../maps/types'
import type { CellKey } from '../types'
import { CELL_PX, type Viewport } from './viewport'

export interface Palette {
  ink: string
  muted: string
  line: string
  panel: string
  accent: string
  good: string
  bad: string
  warn: string
  water: string
  /** True paints every terrain with a glyph too, and heavier edges. */
  highContrast: boolean
}

/** A glyph per terrain so the map reads without colour. */
export const TERRAIN_GLYPH: Partial<Record<Terrain, string>> = {
  difficult: '∴', water: '≈', door: '▯', doorOpen: '▱', hazard: '☠', stairs: '≣',
}

export interface DrawOptions {
  map: BattleMapDef
  view: Viewport
  /** Covered cells. The DM sees through fog (dim), players see dark glass. */
  fog: CellKey[]
  seeThroughFog: boolean
  picture?: HTMLImageElement | null
  /** Cells of a planned move, start first. */
  path?: Cell[]
  pathTone?: 'ok' | 'warn' | 'bad'
  /** Two cells to measure between. */
  measure?: [Cell, Cell | null]
  /** Cells to outline (fog brush drag, pending destination). */
  highlight?: Cell[]
  palette: Palette
}

const alpha = (hex: string, a: number) => {
  // Accepts #rgb, #rrggbb, or any CSS colour (passed through with color-mix unsupported on canvas: fall back).
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function terrainFill(t: Terrain, p: Palette): string | null {
  switch (t) {
    case 'wall': return p.ink
    case 'difficult': return alpha(p.warn, 0.35)
    case 'water': return alpha(p.water, 0.45)
    case 'door': return alpha(p.warn, 0.8)
    case 'doorOpen': return alpha(p.warn, 0.25)
    case 'hazard': return alpha(p.bad, 0.4)
    case 'stairs': return alpha(p.muted, 0.3)
    default: return null
  }
}

/** Paints the whole board into a canvas that is already sized to the box (device pixels handled by the caller). */
export function drawBoard(ctx: CanvasRenderingContext2D, boxW: number, boxH: number, o: DrawOptions) {
  const { map, view, palette: p } = o
  ctx.clearRect(0, 0, boxW, boxH)
  ctx.save()
  ctx.translate(view.tx, view.ty)
  ctx.scale(view.scale, view.scale)
  const W = map.width * CELL_PX, H = map.height * CELL_PX

  // Floor.
  ctx.fillStyle = alpha(p.panel, 0.9)
  ctx.fillRect(0, 0, W, H)
  if (o.picture && map.picture) {
    const k = CELL_PX / map.picture.cell
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip()
    ctx.drawImage(o.picture, -map.picture.offsetX * k, -map.picture.offsetY * k, map.picture.width * k, map.picture.height * k)
    ctx.restore()
  }

  // Terrain.
  const fontPx = Math.round(CELL_PX * 0.55)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (const key of Object.keys(map.terrain)) {
    const [xs, ys] = key.split(',')
    const x = Number(xs), y = Number(ys)
    const t = map.terrain[key]
    const fill = terrainFill(t, p)
    if (!fill) continue
    ctx.fillStyle = fill
    ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX)
    const glyph = TERRAIN_GLYPH[t]
    if (glyph && (p.highContrast || t !== 'difficult' || view.scale >= 0.6)) {
      ctx.fillStyle = t === 'door' ? p.panel : p.ink
      ctx.font = `${fontPx}px ${p.highContrast ? 'sans-serif' : 'serif'}`
      ctx.fillText(glyph, x * CELL_PX + CELL_PX / 2, y * CELL_PX + CELL_PX / 2)
    }
  }

  // Grid.
  ctx.strokeStyle = alpha(p.ink, p.highContrast ? 0.6 : 0.18)
  ctx.lineWidth = p.highContrast ? 1.5 : 1
  ctx.beginPath()
  for (let x = 0; x <= map.width; x++) { ctx.moveTo(x * CELL_PX, 0); ctx.lineTo(x * CELL_PX, H) }
  for (let y = 0; y <= map.height; y++) { ctx.moveTo(0, y * CELL_PX); ctx.lineTo(W, y * CELL_PX) }
  ctx.stroke()

  // Labels: small pills.
  if (view.scale >= 0.45) {
    ctx.font = `600 ${Math.round(CELL_PX * 0.3)}px sans-serif`
    for (const l of map.labels) {
      const cx = l.x * CELL_PX + CELL_PX / 2, cy = l.y * CELL_PX + CELL_PX * 0.82
      const w = ctx.measureText(l.text).width + 10, h = CELL_PX * 0.36
      ctx.fillStyle = alpha(p.panel, 0.85)
      roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fill()
      ctx.fillStyle = p.ink
      ctx.fillText(l.text, cx, cy)
    }
  }

  // Path and measure.
  if (o.path && o.path.length > 1) {
    const tone = o.pathTone === 'bad' ? p.bad : o.pathTone === 'warn' ? p.warn : p.accent
    ctx.fillStyle = alpha(tone, 0.22)
    for (const c of o.path) ctx.fillRect(c.x * CELL_PX, c.y * CELL_PX, CELL_PX, CELL_PX)
    ctx.strokeStyle = tone; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
    ctx.beginPath()
    o.path.forEach((c, i) => { const px = c.x * CELL_PX + CELL_PX / 2, py = c.y * CELL_PX + CELL_PX / 2; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) })
    ctx.stroke()
  }
  if (o.measure) {
    const [a, b] = o.measure
    ctx.fillStyle = alpha(p.accent, 0.3)
    ctx.fillRect(a.x * CELL_PX, a.y * CELL_PX, CELL_PX, CELL_PX)
    if (b) {
      ctx.fillRect(b.x * CELL_PX, b.y * CELL_PX, CELL_PX, CELL_PX)
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.moveTo(a.x * CELL_PX + CELL_PX / 2, a.y * CELL_PX + CELL_PX / 2)
      ctx.lineTo(b.x * CELL_PX + CELL_PX / 2, b.y * CELL_PX + CELL_PX / 2)
      ctx.stroke(); ctx.setLineDash([])
    }
  }
  if (o.highlight?.length) {
    ctx.strokeStyle = p.accent; ctx.lineWidth = 2
    for (const c of o.highlight) ctx.strokeRect(c.x * CELL_PX + 1, c.y * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2)
  }

  // Fog.
  if (o.fog.length) {
    const set = new Set<string>(o.fog)
    ctx.fillStyle = o.seeThroughFog ? alpha(p.ink, 0.35) : alpha(p.ink, 0.92)
    for (const key of set) {
      const [xs, ys] = key.split(',')
      ctx.fillRect(Number(xs) * CELL_PX, Number(ys) * CELL_PX, CELL_PX, CELL_PX)
    }
    if (o.seeThroughFog) {
      // Hatch so the DM can tell fog from a dark floor.
      ctx.strokeStyle = alpha(p.panel, 0.5); ctx.lineWidth = 1
      ctx.beginPath()
      for (const key of set) {
        const [xs, ys] = key.split(',')
        const x = Number(xs) * CELL_PX, y = Number(ys) * CELL_PX
        ctx.moveTo(x, y + CELL_PX); ctx.lineTo(x + CELL_PX, y)
      }
      ctx.stroke()
    }
  }

  // Outer edge.
  ctx.strokeStyle = alpha(p.ink, 0.5); ctx.lineWidth = 2
  ctx.strokeRect(0, 0, W, H)
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

/** True when a cell of a footprint is under fog. */
export const footprintInFog = (x: number, y: number, size: number, fog: CellKey[]): boolean => {
  const set = new Set<string>(fog)
  for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) if (set.has(cellKey(x + dx, y + dy))) return true
  return false
}

/** Whether a cell is a wall or closed door, for the DM's fog brush summary. */
export const isSolid = (map: BattleMapDef, x: number, y: number) => ['wall', 'door'].includes(terrainAt(map, x, y))

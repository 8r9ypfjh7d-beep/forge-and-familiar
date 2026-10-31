// Paints a map onto a canvas: picture, terrain, grid, labels, fog. Shared by the editor and the battle map,
// so a map looks the same to the DM and the players. Colours come from the page's design tokens when they
// resolve, with plain fallbacks for canvases drawn off-screen (thumbnails).
import { cellKey, parseKey, terrainAt } from './logic'
import type { BattleMapDef, Cell, Rect, Terrain } from './types'

export interface DrawOptions {
  /** Pixels per cell. */
  cellPx: number
  /** The loaded picture, when the map has one and it has finished loading. */
  picture?: HTMLImageElement | null
  /** DM: fog as a see-through veil; player: solid cover; none: not drawn. */
  fog?: 'dm' | 'player' | 'none'
  /** A rectangle being dragged in the editor. */
  highlight?: Rect | null
  /** Cells to outline (a selected token's path). */
  path?: Cell[]
  /** Whether the party edge is drawn. */
  partyEdge?: boolean
  labels?: boolean
}

/** Glyphs for terrain so it reads without colour (high contrast, colour-blind players). */
export const TERRAIN_GLYPH: Record<Terrain, string> = {
  floor: '', wall: '', difficult: '⁂', water: '≈', door: '▮', doorOpen: '▯', hazard: '✕', stairs: '≡',
}

const FALLBACK: Record<string, string> = {
  '--bg': '#f6f1e7', '--panel': '#fffdf8', '--ink': '#2a2118', '--muted': '#7a6b5a', '--line': '#e2d7c4',
  '--accent': '#8c2f1b', '--good': '#2f6b3a', '--bad': '#a3271b', '--warn': '#93600c', '--temp': '#3b6fb0',
}

export function tokenColour(name: string, el?: Element | null): string {
  if (typeof getComputedStyle === 'function' && el) {
    const v = getComputedStyle(el).getPropertyValue(name).trim()
    if (v) return v
  }
  return FALLBACK[name] ?? '#000'
}

function withAlpha(colour: string, alpha: number): string {
  const m = colour.match(/^#([0-9a-f]{6})$/i)
  if (!m) return colour
  const n = parseInt(m[1], 16)
  return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${alpha})`
}

export function terrainFill(t: Terrain, c: (name: string) => string): string | null {
  switch (t) {
    case 'wall': return c('--ink')
    case 'difficult': return withAlpha(c('--warn'), 0.35)
    case 'water': return withAlpha(c('--temp'), 0.4)
    case 'door': return c('--accent')
    case 'doorOpen': return withAlpha(c('--accent'), 0.35)
    case 'hazard': return withAlpha(c('--bad'), 0.4)
    case 'stairs': return withAlpha(c('--muted'), 0.35)
    default: return null
  }
}

/** Draws the whole map at (0, 0); the canvas is expected to be width × cellPx by height × cellPx. */
export function drawMap(ctx: CanvasRenderingContext2D, map: BattleMapDef, opts: DrawOptions) {
  const { cellPx: px } = opts
  const c = (name: string) => tokenColour(name, ctx.canvas)
  const W = map.width * px, H = map.height * px
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = map.picture ? c('--panel') : withAlpha(c('--bg'), 1)
  ctx.fillRect(0, 0, W, H)
  if (map.picture && opts.picture) {
    const p = map.picture
    const scale = px / p.cell
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.clip()
    ctx.drawImage(opts.picture, -p.offsetX * scale, -p.offsetY * scale, p.width * scale, p.height * scale)
    ctx.restore()
  }
  // Terrain cells.
  ctx.font = `${Math.round(px * 0.55)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [k, t] of Object.entries(map.terrain)) {
    const { x, y } = parseKey(k)
    const fill = terrainFill(t, c)
    if (!fill) continue
    ctx.fillStyle = fill
    ctx.fillRect(x * px, y * px, px, px)
    const glyph = TERRAIN_GLYPH[t]
    if (glyph && px >= 14) {
      ctx.fillStyle = t === 'wall' || t === 'door' ? c('--panel') : c('--ink')
      ctx.fillText(glyph, x * px + px / 2, y * px + px / 2)
    }
  }
  // Grid.
  ctx.strokeStyle = withAlpha(c('--ink'), map.picture ? 0.35 : 0.18)
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= map.width; x++) { ctx.moveTo(x * px + 0.5, 0); ctx.lineTo(x * px + 0.5, H) }
  for (let y = 0; y <= map.height; y++) { ctx.moveTo(0, y * px + 0.5); ctx.lineTo(W, y * px + 0.5) }
  ctx.stroke()
  // Party edge.
  if (opts.partyEdge !== false && map.partyEdge) {
    ctx.strokeStyle = c('--good')
    ctx.lineWidth = Math.max(3, px / 8)
    ctx.beginPath()
    const e = map.partyEdge, o = ctx.lineWidth / 2
    if (e === 'n') { ctx.moveTo(0, o); ctx.lineTo(W, o) }
    if (e === 's') { ctx.moveTo(0, H - o); ctx.lineTo(W, H - o) }
    if (e === 'w') { ctx.moveTo(o, 0); ctx.lineTo(o, H) }
    if (e === 'e') { ctx.moveTo(W - o, 0); ctx.lineTo(W - o, H) }
    ctx.stroke()
  }
  // Path.
  if (opts.path?.length) {
    ctx.strokeStyle = c('--accent')
    ctx.lineWidth = Math.max(2, px / 10)
    ctx.beginPath()
    opts.path.forEach((p, i) => {
      const cx = p.x * px + px / 2, cy = p.y * px + px / 2
      if (i) ctx.lineTo(cx, cy)
      else ctx.moveTo(cx, cy)
    })
    ctx.stroke()
  }
  // Labels.
  if (opts.labels !== false && px >= 12) {
    ctx.font = `600 ${Math.max(9, Math.round(px * 0.34))}px system-ui, sans-serif`
    for (const l of map.labels) {
      const text = l.text
      const w = ctx.measureText(text).width + px * 0.3
      const x = l.x * px + px / 2, y = l.y * px + px * 0.82
      ctx.fillStyle = withAlpha(c('--panel'), 0.85)
      ctx.fillRect(x - w / 2, y - px * 0.22, w, px * 0.44)
      ctx.fillStyle = c('--ink')
      ctx.fillText(text, x, y)
    }
  }
  // Fog.
  if (opts.fog !== 'none' && map.fog.length) {
    ctx.fillStyle = opts.fog === 'player' ? withAlpha(c('--ink'), 0.92) : withAlpha(c('--ink'), 0.45)
    for (const k of map.fog) {
      const { x, y } = parseKey(k)
      ctx.fillRect(x * px, y * px, px, px)
    }
  }
  // Drag rectangle.
  if (opts.highlight) {
    const r = opts.highlight
    ctx.strokeStyle = c('--accent')
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(r.x * px + 1, r.y * px + 1, r.w * px - 2, r.h * px - 2)
    ctx.setLineDash([])
  }
}

/** Which cell a point on the canvas falls in, in canvas pixels. */
export function cellAtPoint(px: number, x: number, y: number): Cell {
  return { x: Math.floor(x / px), y: Math.floor(y / px) }
}

/** Short description of a cell for screen readers: "C4, wall". */
export function describeCell(map: BattleMapDef, x: number, y: number): string {
  const t = terrainAt(map, x, y)
  const label = map.labels.find(l => l.x === x && l.y === y)?.text
  return [cellName(x, y), t === 'floor' ? '' : t, label ?? '', map.fog.includes(cellKey(x, y)) ? 'fog' : ''].filter(Boolean).join(', ')
}

/** "A1" style cell names: columns as letters, rows as numbers from 1. */
export function cellName(x: number, y: number): string {
  let col = ''
  let n = x
  do { col = String.fromCharCode(65 + (n % 26)) + col; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return `${col}${y + 1}`
}

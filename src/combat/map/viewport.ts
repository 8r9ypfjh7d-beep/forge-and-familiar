// Pure camera maths for the battle map: zoom, pan, pinch and cell hit-testing.
// No React, no DOM. The view shows map pixels scaled by `scale` and shifted by (tx, ty) screen pixels.

export interface Viewport {
  /** Screen pixels per map pixel (map pixels are CELL_PX per cell). */
  scale: number
  /** Screen offset of the map origin. */
  tx: number
  ty: number
}

/** Map pixels per grid cell at scale 1. Tokens are 44 px tap targets at scale 1. */
export const CELL_PX = 44
export const MIN_SCALE = 0.25
export const MAX_SCALE = 4

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

/** A viewport that fits the whole grid into a box, centred, with a small margin. */
export function fitViewport(cols: number, rows: number, boxW: number, boxH: number, margin = 8): Viewport {
  const mapW = cols * CELL_PX
  const mapH = rows * CELL_PX
  const scale = clampScale(Math.min((boxW - margin * 2) / mapW, (boxH - margin * 2) / mapH))
  return { scale, tx: (boxW - mapW * scale) / 2, ty: (boxH - mapH * scale) / 2 }
}

/** Zoom by a factor around a screen point so that point stays put. */
export function zoomAt(v: Viewport, factor: number, sx: number, sy: number): Viewport {
  const scale = clampScale(v.scale * factor)
  const k = scale / v.scale
  return { scale, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k }
}

export const pan = (v: Viewport, dx: number, dy: number): Viewport => ({ ...v, tx: v.tx + dx, ty: v.ty + dy })

/** Two-finger gesture: from the previous finger pair to the current one. */
export function pinch(v: Viewport, prev: [Pt, Pt], next: [Pt, Pt]): Viewport {
  const d0 = dist(prev[0], prev[1]) || 1
  const d1 = dist(next[0], next[1]) || 1
  const m0 = mid(prev[0], prev[1])
  const m1 = mid(next[0], next[1])
  const zoomed = zoomAt(v, d1 / d0, m0.x, m0.y)
  return pan(zoomed, m1.x - m0.x, m1.y - m0.y)
}

export interface Pt { x: number; y: number }
export interface Cell { x: number; y: number }

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Screen point → grid cell, or null outside the grid. */
export function cellAt(v: Viewport, sx: number, sy: number, cols: number, rows: number): Cell | null {
  const x = Math.floor((sx - v.tx) / (v.scale * CELL_PX))
  const y = Math.floor((sy - v.ty) / (v.scale * CELL_PX))
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null
  return { x, y }
}

/** Screen rectangle of a cell footprint (w × h cells). */
export function cellRect(v: Viewport, x: number, y: number, w = 1, h = 1) {
  const s = v.scale * CELL_PX
  return { left: v.tx + x * s, top: v.ty + y * s, width: w * s, height: h * s }
}

/** Move the view so a footprint's centre sits in the middle of the box. */
export function centreOn(v: Viewport, x: number, y: number, w: number, h: number, boxW: number, boxH: number): Viewport {
  const s = v.scale * CELL_PX
  return { ...v, tx: boxW / 2 - (x + w / 2) * s, ty: boxH / 2 - (y + h / 2) * s }
}

/** Keep at least `keep` screen pixels of the map visible on each side so it cannot be lost off-screen. */
export function clampPan(v: Viewport, cols: number, rows: number, boxW: number, boxH: number, keep = 80): Viewport {
  const mapW = cols * CELL_PX * v.scale
  const mapH = rows * CELL_PX * v.scale
  const tx = Math.min(boxW - keep, Math.max(keep - mapW, v.tx))
  const ty = Math.min(boxH - keep, Math.max(keep - mapH, v.ty))
  return { ...v, tx, ty }
}

/**
 * Fit the grid, but never below `minCell` screen pixels per cell: a big grid on a phone is shown at `minCell`
 * instead, centred on `focus` (or the middle of the grid) and scrollable, so tokens stay tappable.
 */
export function fitTappable(cols: number, rows: number, boxW: number, boxH: number, minCell: number, focus?: { x: number; y: number; size: number }): Viewport {
  const fitted = fitViewport(cols, rows, boxW, boxH)
  if (fitted.scale * CELL_PX >= minCell) return fitted
  const at = focus ?? { x: cols / 2, y: rows / 2, size: 1 }
  const near = centreOn({ ...fitted, scale: minCell / CELL_PX }, at.x, at.y, at.size, at.size, boxW, boxH)
  return clampPan(near, cols, rows, boxW, boxH)
}

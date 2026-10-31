import { describe, expect, it } from 'vitest'
import { CELL_PX, cellAt, cellRect, centreOn, clampPan, fitViewport, pinch, zoomAt } from './viewport'

describe('battle map viewport', () => {
  it('fits the grid centred in the box', () => {
    const v = fitViewport(24, 16, 1000, 600)
    expect(v.scale).toBeCloseTo((600 - 16) / (16 * CELL_PX))
    expect(v.tx + (24 * CELL_PX * v.scale) / 2).toBeCloseTo(500)
    expect(v.ty).toBeCloseTo(8)
  })

  it('zooms around the pointer so the cell under it stays put', () => {
    const v = fitViewport(20, 20, 800, 800)
    const before = cellAt(v, 300, 300, 20, 20)
    const z = zoomAt(v, 2, 300, 300)
    expect(z.scale).toBeCloseTo(v.scale * 2)
    expect(cellAt(z, 300, 300, 20, 20)).toEqual(before)
  })

  it('clamps the scale', () => {
    const v = { scale: 1, tx: 0, ty: 0 }
    expect(zoomAt(v, 100, 0, 0).scale).toBe(4)
    expect(zoomAt(v, 0.001, 0, 0).scale).toBe(0.25)
  })

  it('pinch zooms by the finger distance ratio and follows the midpoint', () => {
    const v = { scale: 1, tx: 0, ty: 0 }
    const p = pinch(v, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 110, y: 110 }, { x: 310, y: 110 }])
    expect(p.scale).toBeCloseTo(2)
    // Midpoint moved from (150,100) to (210,110); the map point under the old midpoint follows it.
    expect(p.tx).toBeCloseTo(210 - 150 * 2)
    expect(p.ty).toBeCloseTo(110 - 100 * 2)
  })

  it('maps screen points to cells and back', () => {
    const v = { scale: 1, tx: 10, ty: 20 }
    expect(cellAt(v, 10 + CELL_PX * 2 + 1, 20 + CELL_PX * 3 + 1, 10, 10)).toEqual({ x: 2, y: 3 })
    expect(cellAt(v, 5, 25, 10, 10)).toBeNull()
    expect(cellAt(v, 10 + CELL_PX * 10, 25, 10, 10)).toBeNull()
    expect(cellRect(v, 2, 3, 2, 2)).toEqual({ left: 10 + 88, top: 20 + 132, width: 88, height: 88 })
  })

  it('centres a footprint and keeps part of the map on screen', () => {
    const v = centreOn({ scale: 1, tx: 0, ty: 0 }, 4, 4, 2, 2, 400, 400)
    expect(v.tx).toBe(200 - 5 * CELL_PX)
    const far = clampPan({ scale: 1, tx: 5000, ty: -5000 }, 10, 10, 400, 400)
    expect(far.tx).toBe(400 - 80)
    expect(far.ty).toBe(80 - 10 * CELL_PX)
  })
})

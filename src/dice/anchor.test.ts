import { describe, expect, it } from 'vitest'
import { placeUnder } from './ui/anchor'

const phone = { width: 390, height: 800 }
const box = (top: number, left: number, w = 80, h = 40) => ({ top, bottom: top + h, left, right: left + w })

describe('roll result under the tapped control', () => {
  const wide = { width: 1280, height: 800 }
  it('opens just below the control, lined up with its start edge', () => {
    expect(placeUnder(box(100, 40), 120, wide, false)).toEqual({ top: 146, left: 40, width: 380, above: false })
    expect(placeUnder(box(100, 40), 120, phone, false)).toEqual({ top: 146, left: 12, width: 366, above: false })
  })

  it('lines up with the right edge in Hebrew and stays on screen', () => {
    const p = placeUnder(box(100, 600, 80), 120, wide, true)
    expect(p.left + p.width).toBe(680)
    expect(placeUnder(box(100, 0, 40), 120, wide, true).left).toBe(12)
  })

  it('caps the width on wide screens and keeps a side gutter on phones', () => {
    expect(placeUnder(box(100, 900), 120, { width: 1280, height: 800 }, false)).toMatchObject({ left: 888, width: 380 })
    expect(placeUnder(box(100, 10), 120, { width: 320, height: 600 }, false)).toMatchObject({ left: 12, width: 296 })
  })

  it('flips above only when below would run off the screen', () => {
    expect(placeUnder(box(600, 40), 120, phone, false).above).toBe(false)
    expect(placeUnder(box(700, 40), 200, phone, false)).toMatchObject({ above: true, top: 494 })
  })
})

import { describe, expect, it } from 'vitest'
import { addPurses, convert, formatGp, formatPurse, fromCp, PURSE_DENOMS, splitLoot, toCp } from './coins'

describe('coins', () => {
  it('totals a purse in copper', () => {
    expect(toCp({ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 })).toBe(1000 + 200 + 50 + 30 + 4)
    expect(toCp({})).toBe(0)
    expect(toCp({ gp: -5, sp: 2.7, cp: NaN })).toBe(20)
  })

  it('makes the fewest coins', () => {
    expect(fromCp(1234)).toEqual({ pp: 1, gp: 2, sp: 3, cp: 4 })
    expect(fromCp(1234, PURSE_DENOMS)).toEqual({ gp: 12, sp: 3, cp: 4 })
    expect(fromCp(150, ['gp', 'ep', 'sp'])).toEqual({ gp: 1, ep: 1 })
    expect(fromCp(0)).toEqual({})
  })

  it('converts between denominations', () => {
    expect(convert(3, 'pp', 'gp')).toEqual({ coins: 30, leftoverCp: 0, exact: 30 })
    expect(convert(15, 'sp', 'gp')).toEqual({ coins: 1, leftoverCp: 50, exact: 1.5 })
    expect(convert(1, 'ep', 'sp').coins).toBe(5)
    expect(convert(2, 'gp', 'ep').coins).toBe(4)
  })

  it('splits loot evenly by value', () => {
    const s = splitLoot({ pp: 3 }, 2)
    expect(s.share).toEqual({ pp: 1, gp: 5 })
    expect(s.leftoverCp).toBe(0)

    const odd = splitLoot({ gp: 100, sp: 1 }, 3)
    expect(odd.shareCp).toBe(3336)
    expect(odd.leftoverCp).toBe(2)
    expect(odd.shareCp * 3 + odd.leftoverCp).toBe(toCp({ gp: 100, sp: 1 }))
  })

  it('pays shares in purse coins only when asked', () => {
    expect(splitLoot({ pp: 1, ep: 2 }, 4, PURSE_DENOMS).share).toEqual({ gp: 2, sp: 7, cp: 5 })
  })

  it('handles no shares', () => {
    expect(splitLoot({ gp: 7 }, 0)).toMatchObject({ shareCp: 0, leftoverCp: 700 })
  })

  it('adds and formats purses', () => {
    expect(addPurses({ gp: 1, cp: 5 }, { gp: 2, sp: 1 })).toEqual({ gp: 3, sp: 1, cp: 5 })
    expect(formatPurse({ gp: 1500, sp: 5 })).toBe('1,500 gp 5 sp')
    expect(formatPurse({})).toBe('0 cp')
    expect(formatGp(1234)).toBe('12.34 gp')
  })
})

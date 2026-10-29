import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { derive } from '../rules'
import { sheetLayout } from '../sheet/mode'
import { makeCharacter } from '../sheet/fixtures'
import { canPowerUp, getDressed, isPoweredUp, powerLevel, powerUp, POWER_UP_ACTION_ID, STRIP_LINES } from './powerup'
import { en } from '../i18n/locales/en'
import { he as heLocale } from '../i18n/locales/he'
const he = heLocale.messages

const tamirs = makeCharacter({ ownerId: 'acct-tamir' })

describe('Super Saiyan strip', () => {
  it('only shows on Tamir’s characters, right under the character card in both modes', () => {
    expect(canPowerUp(tamirs)).toBe(true)
    expect(canPowerUp({ ...tamirs, ownerId: 'acct-roy' })).toBe(false)
    for (const mode of ['story', 'combat'] as const) {
      expect(sheetLayout(mode, { dying: false, powerUp: true }).top).toEqual(['summary', 'powerUp', 'abilities'])
      expect(sheetLayout(mode, { dying: false }).top).toEqual(['summary', 'abilities'])
    }
    expect(sheetLayout('story', { dying: true, powerUp: true }).top[0]).toBe('death')
  })

  it('switches on a real buff that derive() reads, and getting dressed ends it', () => {
    const before = derive(tamirs)
    const on = powerUp(tamirs, 'Super Saiyan', 'no clothes')
    expect(isPoweredUp(on)).toBe(true)
    const after = derive(on)
    expect(after.speed).toBe(before.speed + 10)
    expect(after.initiative).toBe(before.initiative + 3)
    expect(after.armorClass.value).toBe(before.armorClass.value - 2)
    const off = getDressed(on)
    expect(isPoweredUp(off)).toBe(false)
    expect(derive(off).speed).toBe(before.speed)
    expect(off.customActions?.filter(a => a.id === POWER_UP_ACTION_ID)).toHaveLength(1)
  })

  it('stripping twice keeps one action', () => {
    const twice = powerUp(powerUp(tamirs, 'a', 'b'), 'a', 'b')
    expect(twice.customActions?.filter(a => a.id === POWER_UP_ACTION_ID)).toHaveLength(1)
    expect(getDressed(tamirs)).toBe(tamirs)
  })

  it('power level is always over 9000 and keeps climbing', () => {
    expect(powerLevel(1)).toBe(9001)
    expect(powerLevel(3)).toBeGreaterThan(powerLevel(2))
  })

  it('has every joke line in both languages', () => {
    for (let i = 1; i <= STRIP_LINES; i++) {
      expect(en).toHaveProperty(`powerup.line${i}`)
      expect(he).toHaveProperty(`powerup.line${i}`)
    }
  })

  it('effects CSS stays on logical properties', () => {
    for (const f of ['strip.fx.css', 'powerup.css']) {
      expect(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).not.toMatch(/(margin|padding|border)-(left|right|top|bottom)\b|[{;\s](left|right|top|bottom):/)
    }
  })
})

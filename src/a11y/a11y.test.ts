import { describe, expect, it } from 'vitest'
import { isTypingTarget, nextRadioIndex, shortcutKey } from './keyboard'
import { DEFAULT_SETTINGS, sanitize, toAttributes } from './settings'

describe('settings', () => {
  it('falls back to defaults for missing or bad data', () => {
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitize('nope')).toEqual(DEFAULT_SETTINGS)
    expect(sanitize({ highContrast: 'yes', textSize: 120, shortcuts: false })).toEqual({ ...DEFAULT_SETTINGS, shortcuts: false })
  })

  it('keeps valid values and drops unknown keys', () => {
    const s = sanitize({ highContrast: true, textSize: 130, extra: 1 })
    expect(s.highContrast).toBe(true)
    expect(s.textSize).toBe(130)
    expect(s).not.toHaveProperty('extra')
  })

  it('sets no attributes by default, so the normal look is untouched', () => {
    expect(Object.values(toAttributes(DEFAULT_SETTINGS)).every(v => v === null)).toBe(true)
  })

  it('maps each switch to its attribute', () => {
    const a = toAttributes({ ...DEFAULT_SETTINGS, highContrast: true, easyRead: true, reduceMotion: true, strongFocus: true, largeTargets: true })
    expect(a).toEqual({ 'data-contrast': 'high', 'data-easy-read': '', 'data-motion': 'reduce', 'data-focus': 'strong', 'data-targets': 'large' })
  })
})

describe('radio group keys', () => {
  it('moves and wraps with arrows', () => {
    expect(nextRadioIndex('ArrowRight', 0, 3)).toBe(1)
    expect(nextRadioIndex('ArrowDown', 2, 3)).toBe(0)
    expect(nextRadioIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(nextRadioIndex('ArrowUp', 1, 3)).toBe(0)
  })

  it('jumps with Home and End, ignores other keys', () => {
    expect(nextRadioIndex('Home', 2, 7)).toBe(0)
    expect(nextRadioIndex('End', 0, 7)).toBe(6)
    expect(nextRadioIndex('Enter', 0, 7)).toBeNull()
    expect(nextRadioIndex('ArrowRight', 0, 0)).toBeNull()
  })
})

describe('shortcuts', () => {
  const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
    ({ key: k, ctrlKey: false, altKey: false, metaKey: false, target: el('BUTTON'), ...extra }) as KeyboardEvent

  it('reads bare letters, lowercased', () => {
    expect(shortcutKey(key('d'))).toBe('d')
    expect(shortcutKey(key('D'))).toBe('d')
  })

  it('stays out of the way of typing and modifier keys', () => {
    expect(shortcutKey(key('d', { target: el('INPUT') }))).toBeNull()
    expect(shortcutKey(key('d', { target: el('DIV', true) }))).toBeNull()
    expect(shortcutKey(key('d', { ctrlKey: true }))).toBeNull()
    expect(shortcutKey(key('d', { altKey: true }))).toBeNull()
    expect(shortcutKey(key('Enter'))).toBeNull()
  })

  it('treats fields as typing targets', () => {
    expect(isTypingTarget(el('TEXTAREA'))).toBe(true)
    expect(isTypingTarget(el('SELECT'))).toBe(true)
    expect(isTypingTarget(el('BUTTON'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

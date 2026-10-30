import { describe, expect, it } from 'vitest'
import { foldText, matches } from './Compact'

describe('compact picker search', () => {
  it('ignores case and accents', () => {
    expect(foldText('Heroes of Faerûn')).toBe('heroes of faerun')
    expect(matches('FAERUN', ['Heroes of Faerûn'])).toBe(true)
  })

  it('needs every word, in any of the texts', () => {
    expect(matches('elf astral', ['Astral Elf', 'Spelljammer'])).toBe(true)
    expect(matches('elf volo', ['Astral Elf', 'Spelljammer'])).toBe(false)
    expect(matches('שדון', ['שדון אסטרלי', 'Astral Elf'])).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(matches('  ', ['Dwarf'])).toBe(true)
  })
})

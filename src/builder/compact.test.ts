import { describe, expect, it } from 'vitest'
import { bookRank, foldText, matches } from './Compact'

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

describe('book fold order', () => {
  it('puts the SRD first, then the core books, other books, homebrew last', () => {
    const groups = ["Sword Coast Adventurer's Guide", "Dungeon Master's Guide", "Xanathar's Guide to Everything", "Player's Handbook", "Tasha's Cauldron of Everything", 'Fizban', '']
    expect([...groups].sort((a, b) => bookRank(a) - bookRank(b)))
      .toEqual(['', "Player's Handbook", "Xanathar's Guide to Everything", "Tasha's Cauldron of Everything", "Dungeon Master's Guide", "Sword Coast Adventurer's Guide", 'Fizban'])
    expect(bookRank("Player's Handbook (2024)")).toBeLessThan(bookRank("Player's Handbook"))
    expect(bookRank("Player's Handbook · Legacy")).toBe(bookRank("Player's Handbook"))
    expect(bookRank('Homebrew', true)).toBeGreaterThan(bookRank('Fizban'))
  })
})

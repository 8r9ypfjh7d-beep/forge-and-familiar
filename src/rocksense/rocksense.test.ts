import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { he } from '../i18n/locales/he'
import { canSenseRock, MOISTURE_LEVELS, pickFact, pickMoisture, ROCK_FACTS } from './rocksense'

describe('stone sense', () => {
  it('is offered to dwarves and to Roy', () => {
    expect(canSenseRock({ raceId: 'dwarf', ownerId: 'x' })).toBe(true)
    expect(canSenseRock({ raceId: 'dwarf', subraceId: 'hill-dwarf', ownerId: 'x' })).toBe(true)
    expect(canSenseRock({ raceId: 'hb:pack:mountain-dwarf', ownerId: 'x' })).toBe(true)
    expect(canSenseRock({ raceId: 'human', ownerId: 'acct-roy' })).toBe(true)
    expect(canSenseRock({ raceId: 'elf', subraceId: 'high-elf', ownerId: 'acct-tamir' })).toBe(false)
  })

  it('picks every fact and never the same one twice in a row', () => {
    const seen = new Set<number>()
    for (let i = 0; i < ROCK_FACTS; i++) seen.add(pickFact(undefined, () => i / ROCK_FACTS))
    expect(seen.size).toBe(ROCK_FACTS)
    expect(pickFact(5, () => 4 / ROCK_FACTS)).not.toBe(5)
    expect(pickFact(ROCK_FACTS, () => 0.9999)).toBe(1)
    expect(pickMoisture(() => 0.9999)).toBe(MOISTURE_LEVELS)
  })

  it('has every fact and reading in English and Hebrew', () => {
    const keys = [
      ...Array.from({ length: ROCK_FACTS }, (_, i) => `rock.fact${i + 1}`),
      ...Array.from({ length: MOISTURE_LEVELS }, (_, i) => `rock.moist${i + 1}`),
    ]
    for (const k of keys) {
      expect((en as Record<string, string>)[k], k).toBeTruthy()
      expect((he.messages as Record<string, string>)[k], k).toBeTruthy()
    }
  })
})

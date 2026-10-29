import { describe, expect, it } from 'vitest'
import { STEPS } from '../builder/steps'
import { stepIssues } from '../builder/validate'
import { en } from '../i18n/locales/en'
import { he } from '../i18n/locales/he'
import { createCharacter, getMaxHp } from '../rules'
import { HOOK_COUNT, randomDraft, randomHookKey } from './generate'
import { randomName } from './names'

/** Small seeded generator so failures can be replayed. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

describe('random character', () => {
  for (const edition of ['2014', '2024'] as const) {
    it(`passes every builder step (${edition})`, () => {
      for (let seed = 1; seed <= 400; seed++) {
        const d = randomDraft('p1', edition, seeded(seed))
        for (const s of STEPS) expect({ seed, step: s.id, issues: stepIssues(s.id, d) }).toEqual({ seed, step: s.id, issues: [] })
        const c = createCharacter(d)
        expect(getMaxHp(c)).toBeGreaterThan(0)
        expect(c.state.currentHp).toBe(getMaxHp(c))
      }
    })
  }

  it('varies race and class', () => {
    const drafts = Array.from({ length: 200 }, (_, i) => randomDraft('p1', '2014', seeded(i + 1)))
    expect(new Set(drafts.map(d => d.raceId)).size).toBeGreaterThan(5)
    expect(new Set(drafts.map(d => d.classes[0].classId)).size).toBeGreaterThan(8)
  })
})

describe('random name and hook', () => {
  it('names every race, with a fallback', () => {
    for (const id of ['human', 'dwarf', 'elf', 'orc', 'goliath', 'my-homebrew']) expect(randomName(id, seeded(3))).toMatch(/^\S+/)
  })

  it('has every hook in English and Hebrew', () => {
    for (let n = 0; n < HOOK_COUNT; n++) {
      expect(en).toHaveProperty([`random.hook.${n}`])
      expect(he.messages).toHaveProperty([`random.hook.${n}`])
    }
    expect(randomHookKey(() => 0.999)).toBe(`random.hook.${HOOK_COUNT - 1}`)
  })
})

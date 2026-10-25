import { describe, expect, it } from 'vitest'
import type { RollResult } from '../dice/types'
import type { Character } from '../model/character'
import { getEffectiveMaxHp } from '../rules'
import { heal, longRest, rollDeathSave, setResourceUsed, setSlotUsed, shortRest, spendHitDie, takeDamage } from '../sheet/engine'
import { makeCharacter } from '../sheet/fixtures'
import { diffCharacter, track } from './diff'
import { endSession, recordCharacter, recordRolls, startSession } from './journal'
import { buildRecap, describeEvent, recapToText } from './recap'

const kinds = (before: Character, after: Character) => diffCharacter(track(before), after).map(e => e.kind)

function roll(partial: Partial<RollResult> & { natural?: number }): RollResult {
  const { natural, ...rest } = partial
  return {
    id: crypto.randomUUID(), notation: '1d20+5', type: 'attack', total: (natural ?? 10) + 5, terms: [], breakdown: '',
    timestamp: '2026-10-25T19:10:00.000Z', roller: { characterId: 'demo', characterName: 'Brannoc Ashvale' },
    ...(natural ? { d20: { mode: 'normal', natural, crit: natural === 20, fumble: natural === 1 } } : {}),
    ...rest,
  } as RollResult
}

describe('diffCharacter', () => {
  const c = makeCharacter()
  const max = getEffectiveMaxHp(c)

  it('sees damage, a drop to 0 and healing', () => {
    expect(diffCharacter(track(c), takeDamage(c, 7))).toEqual([{ kind: 'damage', amount: 7, hpAfter: max - 7, maxHp: max }])
    expect(kinds(c, takeDamage(c, max))).toEqual(['damage', 'down'])
    expect(kinds(c, takeDamage(c, max * 2))).toEqual(['damage', 'death'])
    const hurt = takeDamage(c, 10)
    expect(diffCharacter(track(hurt), heal(hurt, 4))).toEqual([{ kind: 'heal', amount: 4 }])
  })

  it('names the hit die spent on a short rest', () => {
    const hurt = takeDamage(c, 20)
    expect(diffCharacter(track(hurt), spendHitDie(hurt, 'd10', 6))[0]).toMatchObject({ kind: 'heal', hitDie: 'd10' })
  })

  it('infers long and short rests instead of listing every refresh', () => {
    const tired = setResourceUsed(setSlotUsed(takeDamage(c, 15), 1, 2), 'second-wind', 1)
    expect(kinds(tired, longRest(tired))).toEqual(['rest'])
    expect(diffCharacter(track(tired), longRest(tired))[0]).toEqual({ kind: 'rest', rest: 'long' })
    const surged = setResourceUsed(c, 'action-surge', 1)
    expect(diffCharacter(track(surged), shortRest(surged))).toEqual([{ kind: 'rest', rest: 'short' }])
  })

  it('tracks slots, loot, coins, XP and level ups', () => {
    expect(diffCharacter(track(c), setSlotUsed(c, 1, 1))).toEqual([{ kind: 'slot', level: 1, delta: 1 }])
    const richer: Character = {
      ...c, xp: c.xp + 450, coins: { ...c.coins, gp: c.coins.gp + 25 },
      inventory: [...c.inventory, { uid: 'x', itemId: 'dagger', qty: 2, equipped: false }],
      classes: [{ classId: 'fighter', level: 6 }, { classId: 'wizard', level: 2 }],
    }
    expect(diffCharacter(track(c), richer)).toEqual([
      { kind: 'item', itemId: 'dagger', name: 'Dagger', delta: 2 },
      { kind: 'coins', delta: { cp: 0, sp: 0, gp: 25 } },
      { kind: 'xp', amount: 450 },
      { kind: 'levelUp', from: 7, to: 8 },
    ])
  })

  it('sees conditions and a character becoming stable', () => {
    const prone: Character = { ...c, state: { ...c.state, conditions: ['prone'] } }
    expect(diffCharacter(track(c), prone)).toEqual([{ kind: 'condition', condition: 'prone', added: true }])
    const down = takeDamage(c, max)
    const saved = rollDeathSave(rollDeathSave(rollDeathSave(down, 12), 15), 18)
    expect(kinds(rollDeathSave(rollDeathSave(down, 12), 15), saved)).toEqual(['stable'])
  })
})

describe('session journal', () => {
  const start = '2026-10-25T19:00:00.000Z'
  const c = makeCharacter()

  it('records each save once and takes undone steps back out', () => {
    let s = startSession({ ownerId: 'u1', title: 'Session 4', characters: [c], at: start })
    const hit = takeDamage(c, 9)
    s = recordCharacter(s, hit, '2026-10-25T19:05:00.000Z')
    expect(recordCharacter(s, hit, '2026-10-25T19:05:10.000Z')).toBe(s)
    expect(s.events.map(e => e.kind)).toEqual(['damage'])
    const healed = heal(hit, 3)
    s = recordCharacter(s, healed, '2026-10-25T19:05:20.000Z')
    expect(s.events).toHaveLength(2)
    // The sheet's undo saves the previous character again.
    s = recordCharacter(s, hit, '2026-10-25T19:05:30.000Z')
    expect(s.events.map(e => e.kind)).toEqual(['damage'])
    s = recordCharacter(s, c, '2026-10-25T19:05:40.000Z')
    expect(s.events).toEqual([])
  })

  it('keeps a later heal that happens to undo the damage exactly', () => {
    let s = startSession({ ownerId: 'u1', title: 'x', characters: [c], at: start })
    s = recordCharacter(s, takeDamage(c, 9), '2026-10-25T19:05:00.000Z')
    s = recordCharacter(s, c, '2026-10-25T19:20:00.000Z')
    expect(s.events.map(e => e.kind)).toEqual(['damage', 'heal'])
  })

  it('keeps rolls from the session and its characters only', () => {
    let s = startSession({ ownerId: 'u1', title: 'Session 4', characters: [c], at: start })
    const mine = roll({ natural: 20 })
    const early = roll({ timestamp: '2026-10-25T18:00:00.000Z' })
    const other = roll({ roller: { characterId: 'someone-else', characterName: 'Vex' } })
    const table = roll({ roller: undefined, type: 'custom' })
    s = recordRolls(s, [mine, early, other, table])
    expect(s.events.map(e => e.characterName)).toEqual(['Brannoc Ashvale', 'Table'])
    expect(recordRolls(s, [mine])).toBe(s)
  })

  it('stops recording once ended', () => {
    const s = endSession(startSession({ ownerId: 'u1', title: 'x', characters: [c], at: start }))
    expect(recordCharacter(s, takeDamage(c, 5))).toBe(s)
  })
})

describe('buildRecap', () => {
  it('sums the session per character and writes highlights', () => {
    const c = makeCharacter()
    const max = getEffectiveMaxHp(c)
    let s = startSession({ ownerId: 'u1', title: 'The Sunless Citadel', characters: [c], at: '2026-10-25T19:00:00.000Z' })
    let cur = c
    const step = (next: Character, at: string) => { s = recordCharacter(s, next, at); cur = next }
    step(takeDamage(cur, 12), '2026-10-25T19:20:00.000Z')
    step(takeDamage(cur, max), '2026-10-25T19:30:00.000Z')
    step(heal(cur, 8), '2026-10-25T19:31:00.000Z')
    step(setSlotUsed(cur, 1, 1), '2026-10-25T19:40:00.000Z')
    step({ ...cur, xp: cur.xp + 300, coins: { ...cur.coins, gp: cur.coins.gp + 40, sp: 5 } }, '2026-10-25T21:00:00.000Z')
    s = recordRolls(s, [roll({ natural: 20, label: 'Longsword' }), roll({ natural: 1 }), roll({ type: 'damage', total: 11, notation: '1d8+3' })])
    s = endSession(s, '2026-10-25T22:15:00.000Z')

    const r = buildRecap(s)
    const b = r.characters[0]
    expect(r.minutes).toBe(195)
    expect(b).toMatchObject({ damageTaken: 12 + (max - 12), biggestHit: max - 12, healing: 8, timesDowned: 1, slotsUsed: 1, xp: 300, gold: 40.5, rolls: 3, damageRolled: 11 })
    expect(b.nat20s).toHaveLength(1)
    expect(r.highlights).toContain('Brannoc Ashvale dropped to 0 HP and lived.')
    expect(r.highlights).toContain('Brannoc Ashvale rolled a natural 20 on Longsword.')
    expect(r.highlights).toContain('The party earned 300 XP.')
    const text = recapToText(r)
    expect(text).toContain('The Sunless Citadel')
    expect(text).toContain('3 h 15 min')
    expect(text).toMatch(/Brannoc Ashvale: took \d+ damage, healed 8, downed 1×/)
  })

  it('counts a rest the whole party takes once', () => {
    const a = takeDamage(makeCharacter(), 10)
    const b = takeDamage(makeCharacter({ id: 'b', name: 'Isolde' }), 4)
    let s = startSession({ ownerId: 'u1', title: 'x', characters: [a, b], at: '2026-10-25T19:00:00.000Z' })
    s = recordCharacter(s, setSlotUsed(a, 1, 1))
    s = recordCharacter(s, setSlotUsed(b, 1, 1))
    s = recordCharacter(s, longRest(setSlotUsed(a, 1, 1)), '2026-10-25T20:00:00.000Z')
    s = recordCharacter(s, longRest(setSlotUsed(b, 1, 1)), '2026-10-25T20:02:00.000Z')
    expect(buildRecap(s).rests).toEqual({ short: 0, long: 1 })
  })

  it('does not count a quiet long rest as healing when the party rests', () => {
    const a = setSlotUsed(takeDamage(makeCharacter(), 10), 1, 1)
    const b = takeDamage(makeCharacter({ id: 'b', name: 'Pip' }), 4)
    let s = startSession({ ownerId: 'u1', title: 'x', characters: [a, b], at: '2026-10-25T19:00:00.000Z' })
    s = recordCharacter(s, longRest(a), '2026-10-25T20:00:00.000Z')
    s = recordCharacter(s, longRest(b), '2026-10-25T20:01:00.000Z')
    expect(buildRecap(s).totals.healing).toBe(0)
  })

  it('describes events in plain words', () => {
    const at = '2026-10-25T19:00:00.000Z'
    const base = { id: '1', at, characterName: 'B' }
    expect(describeEvent({ ...base, kind: 'slot', level: 3, delta: 1 })).toBe('used a level 3 slot')
    expect(describeEvent({ ...base, kind: 'item', itemId: 'x', name: 'Potion of Healing', delta: -1 })).toBe('lost Potion of Healing')
    expect(describeEvent({ ...base, kind: 'roll', roll: roll({ natural: 20, label: 'Attack' }) })).toBe('rolled Attack: 25 · nat 20')
  })
})

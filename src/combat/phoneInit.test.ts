import { describe, expect, it } from 'vitest'
import type { RollResult } from '../dice'
import { phoneInitiatives } from './phoneInit'
import type { Combatant, Encounter } from './types'

const pc = (id: string, initiative: number | null = null): Combatant => ({ id, name: id, kind: 'pc', characterId: 'ch-' + id, initiative, initBonus: 0 } as Combatant)
const enc = (combatants: Combatant[], extra: Partial<Encounter> = {}): Encounter =>
  ({ id: 'e', name: 'F', round: 0, activeId: null, combatants, effects: [], pendingChecks: [], log: [], createdAt: '2026-11-02T20:00:00Z', updatedAt: '2026-11-02T20:00:00Z', ...extra } as unknown as Encounter)
const roll = (id: string, characterId: string, total: number, timestamp: string, type: RollResult['type'] = 'initiative'): RollResult =>
  ({ id, notation: '1d20', type, total, terms: [], breakdown: '', roller: { characterId, characterName: characterId }, timestamp })

describe('phoneInitiatives', () => {
  it('fills waiting party rows with the latest roll since the fight was set up', () => {
    const e = enc([pc('roy'), pc('tamir', 12)])
    const got = phoneInitiatives(e, [
      roll('a', 'ch-roy', 9, '2026-11-02T19:58:00Z'),
      roll('b', 'ch-roy', 17, '2026-11-02T20:01:00Z'),
      roll('c', 'ch-tamir', 20, '2026-11-02T20:01:00Z'),
    ])
    expect(got.map(x => [x.combatantId, x.roll.total])).toEqual([['roy', 17]])
  })
  it('ignores old rolls, other roll types and rolls already used', () => {
    const e = enc([pc('roy')])
    expect(phoneInitiatives(e, [roll('a', 'ch-roy', 9, '2026-11-02T19:50:00Z')])).toEqual([])
    expect(phoneInitiatives(e, [roll('a', 'ch-roy', 9, '2026-11-02T20:01:00Z', 'attack')])).toEqual([])
    expect(phoneInitiatives(e, [roll('a', 'ch-roy', 9, '2026-11-02T20:01:00Z')], new Set(['a']))).toEqual([])
  })
  it('after a fight ended, only rolls made since then count', () => {
    const e = enc([pc('roy')], { endedAt: '2026-11-02T21:00:00Z' })
    expect(phoneInitiatives(e, [roll('a', 'ch-roy', 9, '2026-11-02T20:30:00Z')])).toEqual([])
    expect(phoneInitiatives(e, [roll('b', 'ch-roy', 11, '2026-11-02T21:05:00Z')]).map(x => x.roll.total)).toEqual([11])
  })
})

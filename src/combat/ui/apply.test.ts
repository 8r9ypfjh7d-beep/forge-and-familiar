import { describe, expect, it } from 'vitest'
import type { Monster } from '../../content'
import { createEncounter } from '../engine'
import type { Encounter } from '../types'
import { applyDamage } from './apply'

const skeleton = { damageImmunities: ['poison'], damageResistances: [], damageVulnerabilities: ['bludgeoning'] } as unknown as Monster
const enc: Encounter = {
  ...createEncounter('e', 'dm', 'Fight', '2026-10-31T00:00:00Z'),
  combatants: [{ id: 's', name: 'Skeleton', kind: 'npc', initiative: 10, initBonus: 0, conditions: [], hp: { current: 13, max: 13, temp: 0 } }],
}
const hpOf = (o: ReturnType<typeof applyDamage>) => ('encounter' in o ? o.encounter : o).combatants[0].hp!.current

describe('applyDamage on a library monster row', () => {
  it('applies the stat block defenses to typed damage', () => {
    expect(hpOf(applyDamage(enc, {}, new Set(), 's', [{ amount: 5, type: 'bludgeoning' }], 'x', {}, skeleton))).toBe(3)
    expect(hpOf(applyDamage(enc, {}, new Set(), 's', [{ amount: 5, type: 'poison' }, { amount: 2, type: 'slashing' }], 'x', {}, skeleton))).toBe(11)
  })

  it('takes untyped damage in full', () => {
    expect(hpOf(applyDamage(enc, {}, new Set(), 's', 5, 'x', {}, skeleton))).toBe(8)
  })
})

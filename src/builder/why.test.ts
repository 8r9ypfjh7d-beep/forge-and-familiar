import { describe, expect, it } from 'vitest'
import { CLASSES, RACES } from '../rules'
import { CLASS_WHY, RACE_WHY, WHY } from './why'
import { STEPS } from './steps'

describe('why? tooltips', () => {
  it('explains every step, race and class', () => {
    for (const s of STEPS) expect(WHY).toHaveProperty([`step:${s.id}`])
    for (const r of RACES) expect(RACE_WHY[r.id], r.id).toBeTruthy()
    for (const c of CLASSES) expect(CLASS_WHY[c.id], c.id).toBeTruthy()
  })
})

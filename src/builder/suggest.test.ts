import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyDraft } from './Builder'
import { suggestedArray, suggestedImprovements, suggestedSkills } from './suggest'
import { stepIssues } from './validate'
import { getAbilityScores } from '../rules'
import { clearDraft, loadDraft, saveDraft } from './draftStore'

const fighter = (level: number) => {
  const d = { ...emptyDraft('u1', 'Ana'), raceId: 'human', backgroundId: 'soldier', classes: [{ classId: 'fighter', level }] }
  return { ...d, baseAbilities: suggestedArray(d) }
}

describe('new character defaults', () => {
  it('starts with no background and the player name', () => {
    const d = emptyDraft('u1', 'Ana')
    expect(d.backgroundId).toBe('')
    expect(d.playerName).toBe('Ana')
    expect(stepIssues('skills', { ...d, raceId: 'human', classes: [{ classId: 'fighter', level: 1 }] })).toContain('Pick a background.')
  })
})

describe('suggest for my class', () => {
  it('fills every empty ASI slot with the main ability, up to 20', () => {
    const d = fighter(8)
    const improvements = suggestedImprovements(d)
    expect(improvements).toHaveLength(3) // levels 4, 6 and 8
    expect(stepIssues('abilities', { ...d, improvements })).toEqual([])
    expect(getAbilityScores({ ...d, improvements }).str).toBe(20)
  })

  it('splits the +2 once the main ability would pass 20, and keeps picked slots', () => {
    const d = fighter(12)
    const picked = { classId: 'fighter', level: 4, featId: 'alert' }
    const improvements = suggestedImprovements({ ...d, improvements: [picked] })
    expect(improvements[0]).toEqual(picked)
    expect(improvements).toHaveLength(4)
    expect(getAbilityScores({ ...d, improvements }).str).toBeLessThanOrEqual(20)
    expect(stepIssues('abilities', { ...d, improvements })).toEqual([])
  })

  it('fills the open skill picks from the class list, avoiding granted skills', () => {
    const d = fighter(1)
    const skills = suggestedSkills(d)
    expect(skills).toHaveLength(2)
    expect(skills).not.toContain('athletics') // Soldier grants it
    expect(stepIssues('skills', { ...d, chosenSkills: skills, chosenTools: ['Dice set'], chosenLanguages: ['Elvish'] })).toEqual([])
  })
})

describe('unfinished draft', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v) },
      removeItem: (k: string) => { data.delete(k) },
    })
  })

  it('is kept per player and cleared', () => {
    const draft = { ...emptyDraft('u1'), name: 'Brin' }
    saveDraft({ draft, step: 2, savedAt: '2026-10-30T00:00:00Z' })
    expect(loadDraft('u1')?.draft.name).toBe('Brin')
    expect(loadDraft('u2')).toBeUndefined()
    clearDraft('u1')
    expect(loadDraft('u1')).toBeUndefined()
  })
})

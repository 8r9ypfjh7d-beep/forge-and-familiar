import { describe, expect, it } from 'vitest'
import { createCharacter, getMaxHp, type CharacterDraft } from '../rules'
import { STARTER_HEROES } from '../starters/heroes'
import { applyEdit, draftFrom, startingGearChanged } from './edit'
import { stepIssues, type StepId } from './validate'

const brannoc = () => createCharacter({ ...STARTER_HEROES[0].draft, ownerId: 'u1', playerName: 'Ziv' } as CharacterDraft)
const STEP_IDS: StepId[] = ['race', 'class', 'abilities', 'skills', 'spells', 'equipment', 'details']

describe('editing a saved character', () => {
  it('turns a character back into a draft that passes every step', () => {
    const c = brannoc()
    const draft = draftFrom(c)
    expect(draft).not.toHaveProperty('state')
    expect(draft).not.toHaveProperty('inventory')
    for (const step of STEP_IDS) expect(stepIssues(step, draft)).toEqual([])
    draft.chosenSkills.push('stealth')
    expect(c.chosenSkills).not.toContain('stealth')
  })

  it('keeps id, owner, notes, coins, gear and play state', () => {
    const c = { ...brannoc(), notes: 'Owes a debt', coins: { cp: 1, sp: 2, gp: 3 }, xp: 120 }
    c.state = { ...c.state, conditions: ['poisoned'] }
    const edited = applyEdit(c, { ...draftFrom(c), name: 'Brannoc the Bold', alignment: 'Neutral Good' })
    expect(edited).toMatchObject({ id: c.id, ownerId: 'u1', createdAt: c.createdAt, notes: 'Owes a debt', xp: 120, coins: c.coins, name: 'Brannoc the Bold' })
    expect(edited.inventory).toEqual(c.inventory)
    expect(edited.state.conditions).toEqual(['poisoned'])
  })

  it('moves current HP with max HP so a full character stays full', () => {
    const c = brannoc()
    const tougher = applyEdit(c, { ...draftFrom(c), classes: [{ classId: 'fighter', level: 3, subclassId: 'champion' }] })
    expect(tougher.state.currentHp).toBe(getMaxHp(tougher))

    const hurt = { ...c, state: { ...c.state, currentHp: 4 } }
    const after = applyEdit(hurt, { ...draftFrom(hurt), classes: [{ classId: 'fighter', level: 3, subclassId: 'champion' }] })
    expect(after.state.currentHp).toBe(4 + getMaxHp(after) - getMaxHp(c))
  })

  it('never revives a character at 0 HP and never drops a conscious one to 0', () => {
    const c = brannoc()
    const down = { ...c, state: { ...c.state, currentHp: 0 } }
    expect(applyEdit(down, { ...draftFrom(down), baseAbilities: { ...down.baseAbilities, con: 8, str: 14, dex: 15 } }).state.currentHp).toBe(0)
    const low = { ...c, state: { ...c.state, currentHp: 1 } }
    expect(applyEdit(low, { ...draftFrom(low), baseAbilities: { ...low.baseAbilities, con: 8, str: 14, dex: 15 } }).state.currentHp).toBe(1)
  })

  it('clamps spent slots and resources to the new build', () => {
    const c = brannoc()
    const used = { ...c, state: { ...c.state, resources: { 'second-wind': { used: 1 } } } }
    const wizard = applyEdit(used, { ...draftFrom(used), classes: [{ classId: 'wizard', level: 1 }], chosenSkills: ['arcana', 'history'] })
    expect(wizard.state.resources).not.toHaveProperty('second-wind')
    expect(wizard.state.spellSlotsUsed).toHaveLength(9)
  })

  it('swaps only the starting gear when asked', () => {
    const c = brannoc()
    c.inventory.push({ uid: 'loot', itemId: 'dagger', qty: 1, equipped: false })
    const draft: CharacterDraft = { ...draftFrom(c), equipmentPicks: [{ option: 1, items: [] }] }
    expect(startingGearChanged(c, draftFrom(c))).toBe(false)
    expect(startingGearChanged(c, draft)).toBe(true)

    expect(applyEdit(c, draft).inventory).toEqual(c.inventory)
    const swapped = applyEdit(c, draft, { replaceGear: true })
    const fresh = createCharacter(draft).inventory
    for (const e of fresh) expect(swapped.inventory.find(x => x.itemId === e.itemId)?.qty).toBeGreaterThanOrEqual(e.qty)
    expect(swapped.inventory.some(e => e.uid === 'loot')).toBe(true)
    expect(swapped.inventory.filter(e => !fresh.some(f => f.itemId === e.itemId)).map(e => e.itemId)).toEqual(['dagger'])
  })
})

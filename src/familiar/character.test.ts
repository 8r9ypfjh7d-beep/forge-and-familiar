import { describe, expect, it } from 'vitest'
import { emptyDraft } from '../builder/Builder'
import type { Character } from '../model/character'
import { makeCharacter } from '../sheet/fixtures'
import {
  askFamiliar, declarations, draftCard, familiarAvailable, getFamiliarScreen, onFamiliarOpen, runTool, setFamiliarScreen, systemInstruction,
  type ToolEnv,
} from './index'
import type { CharacterDraft } from '../rules'

// David Jones-like: 2024 Human Warlock 7 (Great Old One) with a pact greatsword, Armor of Agathys and Hex.
const david: Character = makeCharacter({
  id: 'david', ownerId: 'ziv', name: 'David Jones', raceId: 'human', backgroundId: 'soldier', rulesEdition: '2024', spellEdition: '2024',
  classes: [{ classId: 'warlock', level: 7, subclassId: 'great-old-one-patron' }],
  baseAbilities: { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
  spells: [{ id: 'eldritch-blast', classId: 'warlock' }, { id: 'armor-of-agathys', classId: 'warlock' }, { id: 'hex', classId: 'warlock' }],
  inventory: [{ uid: 'gs', itemId: 'greatsword', qty: 1, equipped: true, pact: true }],
})

const sheetEnv = (c: Character = david): ToolEnv => ({
  userId: 'ziv', locale: 'en', edition: '2024', context: { kind: 'character', characterId: c.id },
  data: { character: () => c, getCharacter: async id => (id === c.id ? c : undefined) },
})

const fighterDraft = (): CharacterDraft => ({
  ...emptyDraft('roy', 'Roy'), raceId: 'human', classes: [{ classId: 'fighter', level: 1 }],
  baseAbilities: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 },
})
const builderEnv = (d: CharacterDraft, step = 'skills'): ToolEnv => ({
  userId: 'roy', locale: 'en', context: { kind: 'builder' }, data: { draft: () => d, step: () => step },
})

describe('get_character', () => {
  it('is offered on a sheet and in the builder, not from the menu', () => {
    expect(declarations(sheetEnv()).map(d => d.name)).toEqual(expect.arrayContaining(['get_character', 'explain_stat']))
    expect(declarations(sheetEnv()).map(d => d.name)).not.toContain('builder_options')
    expect(declarations(builderEnv(fighterDraft())).map(d => d.name)).toContain('builder_options')
    expect(declarations({ userId: 'x', locale: 'en', context: { kind: 'general' } }).map(d => d.name)).not.toContain('get_character')
  })

  it('reads every section of the open character', async () => {
    const summary = await runTool('get_character', {}, sheetEnv())
    expect(summary.ok).toBe(true)
    expect(summary.result.card).toMatch(/David Jones.*Warlock 7/)
    const abilities = (await runTool('get_character', { section: 'abilities' }, sheetEnv())).result
    expect((abilities.abilities as Record<string, { mod: number }>).cha.mod).toBe(3)
    const features = (await runTool('get_character', { section: 'features' }, sheetEnv())).result
    expect((features.features as { name: string }[]).length).toBeGreaterThan(3)
    const spells = (await runTool('get_character', { section: 'spells' }, sheetEnv())).result
    expect(spells.pactSlots).toMatchObject({ level: 4, count: 2 })
    const known = spells.known as { id: string; name: string; level?: number }[]
    expect(known.find(k => k.id === 'eldritch-blast')).toMatchObject({ name: 'Eldritch Blast', level: 0 })
    expect(known.map(k => k.id)).toEqual(['eldritch-blast', 'armor-of-agathys', 'hex'])
    const inv = (await runTool('get_character', { section: 'inventory' }, sheetEnv())).result
    expect((inv.items as { name: string; pactWeapon?: boolean }[])[0]).toMatchObject({ name: 'Greatsword', pactWeapon: true })
    const state = (await runTool('get_character', { section: 'state' }, sheetEnv())).result
    expect((state.hp as { current: number; max: number }).current).toBe((state.hp as { max: number }).max)
    const plan = (await runTool('get_character', { section: 'plan' }, sheetEnv())).result
    expect(plan.note).toMatch(/build planner/)
  })

  it('opens another character only through the app getter', async () => {
    expect((await runTool('get_character', { id: 'david' }, sheetEnv())).ok).toBe(true)
    const other = await runTool('get_character', { id: 'someone-else' }, sheetEnv())
    expect(other.ok).toBe(false)
    expect(other.result.error).toMatch(/No character/)
  })

  it('follows the build plan', async () => {
    const planned = { ...david, levelPlan: [{ level: 8, classId: 'warlock' }] } as Character
    const plan = (await runTool('get_character', { section: 'plan' }, sheetEnv(planned))).result.plan as { level: number; class: string; asiOrFeat?: boolean }[]
    expect(plan[0]).toMatchObject({ level: 8, class: 'Warlock', asiOrFeat: true })
  })

  it('reads the builder draft as a character', async () => {
    const { result, ok } = await runTool('get_character', { section: 'abilities' }, builderEnv(fighterDraft()))
    expect(ok).toBe(true)
    expect(result.draft).toBe(true)
  })
})

describe('explain_stat', () => {
  it('adds up to the sheet number', async () => {
    const ac = (await runTool('explain_stat', { key: 'ac' }, sheetEnv())).result
    expect((ac.lines as { value: number }[]).reduce((n, l) => n + l.value, 0)).toBe(ac.total)
    const save = (await runTool('explain_stat', { key: 'save:cha' }, sheetEnv())).result
    expect(save.total).toBe(3 + 3)
    expect((await runTool('explain_stat', { key: 'skill:stealth' }, sheetEnv())).ok).toBe(true)
  })

  it('lists the keys when one is wrong', async () => {
    const bad = await runTool('explain_stat', { key: 'charisma' }, sheetEnv())
    expect(bad.ok).toBe(false)
    expect(bad.result.error).toMatch(/save:cha/)
  })
})

describe('builder_options', () => {
  it('shows the step on screen with what is missing', async () => {
    const { result } = await runTool('builder_options', {}, builderEnv(fighterDraft()))
    expect(result.step).toBe('skills')
    expect((result.classSkillPicks as { count: number }).count).toBe(2)
    expect((result.missing as string[]).length).toBeGreaterThan(0)
    expect((result.missingPerStep as Record<string, number>).skills).toBeGreaterThan(0)
    expect(result.summary).toMatch(/Builder draft/)
  })

  it('lists subclasses once due and feats that fit', async () => {
    const d = { ...fighterDraft(), classes: [{ classId: 'fighter', level: 4 }] }
    const cls = (await runTool('builder_options', { step: 'class' }, builderEnv(d))).result
    const due = cls.subclassesDue as { class: string; picked: null; options: { id: string }[] }[]
    expect(due[0].class).toBe('fighter')
    expect(due[0].options.map(o => o.id)).toContain('champion')
    const ab = (await runTool('builder_options', { step: 'abilities' }, builderEnv(d))).result
    expect((ab.improvementSlots as { classLevel: number }[])[0].classLevel).toBe(4)
    expect((ab.featsMeetingPrerequisites as unknown[]).length).toBeGreaterThan(0)
  })

  it('counts spell picks per class', async () => {
    const d = { ...fighterDraft(), classes: [{ classId: 'wizard', level: 1 }], spells: [{ id: 'fire-bolt', classId: 'wizard' }] }
    const { result } = await runTool('builder_options', { step: 'spells' }, builderEnv(d))
    const wiz = (result.perClass as { cantrips: { target: number; picked: number }; spells: { target: number } }[])[0]
    expect(wiz.cantrips).toEqual({ target: 3, picked: 1 })
    expect(wiz.spells.target).toBe(6)
  })

  it('is not there outside the builder', async () => {
    expect((await runTool('builder_options', {}, sheetEnv())).ok).toBe(false)
  })
})

describe('draft card and screen', () => {
  it('summarizes an empty draft without crashing', () => {
    const card = draftCard(emptyDraft('roy'), 'race')
    expect(card).toMatch(/Race: not picked/)
    expect(card).toMatch(/Still missing: race/)
    expect(draftCard(fighterDraft())).toMatch(/Fighter 1/)
  })

  it('puts player planning guidance in the prompt', () => {
    const p = systemInstruction({ context: { kind: 'builder' }, locale: 'en', role: 'player', card: draftCard(fighterDraft()) })
    expect(p).toMatch(/builder_options/)
    expect(p).toMatch(/Builder draft/)
  })

  it('sets and clears the screen, and opens only a mounted panel', () => {
    const clear = setFamiliarScreen({ context: { kind: 'character', characterId: 'david' } })
    expect(getFamiliarScreen().context.kind).toBe('character')
    clear()
    expect(getFamiliarScreen().context.kind).toBe('general')
    expect(familiarAvailable()).toBe(false)
    expect(askFamiliar({ prompt: 'hi' })).toBe(false)
    const got: string[] = []
    const off = onFamiliarOpen(r => got.push(r.prompt ?? ''))
    expect(askFamiliar({ prompt: 'hi' })).toBe(true)
    off()
    expect(got).toEqual(['hi'])
  })

  it('a stale clear does not wipe a newer screen', () => {
    const clearA = setFamiliarScreen({ context: { kind: 'builder' } })
    const clearB = setFamiliarScreen({ context: { kind: 'character', characterId: 'x' } })
    clearA()
    expect(getFamiliarScreen().context.kind).toBe('character')
    clearB()
  })
})

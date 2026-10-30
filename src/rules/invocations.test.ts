import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { he } from '../i18n/locales/he'
import {
  INVOCATIONS, INVOCATIONS_2024, PACT_BOONS, classOptionById, classOptions, createCharacter, derive, getFeats, optionKindsFor, optionSlots,
  type CharacterDraft, type ClassOptionPick,
} from './index'

const warlock = (level: number, picks: ClassOptionPick[] = [], over: Partial<CharacterDraft> = {}) => createCharacter({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'warlock', level }],
  abilityMethod: 'manual', baseAbilities: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 16 },
  freeAbilityBonuses: [], chosenSkills: ['arcana', 'history'], classOptions: picks,
  ...over,
})
const pick = (id: string, extra: Partial<ClassOptionPick> = {}): ClassOptionPick =>
  ({ kind: classOptionById(id)!.kind, id, classId: 'warlock', ...extra })

describe('eldritch invocations and pact boons', () => {
  it('lists every official option once per edition', () => {
    expect(PACT_BOONS).toHaveLength(4)
    expect(INVOCATIONS).toHaveLength(54)
    expect(INVOCATIONS_2024).toHaveLength(28)
    const ids = [...PACT_BOONS, ...INVOCATIONS, ...INVOCATIONS_2024].map(o => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(classOptions('invocation', '2014').some(o => o.id === 'pact-of-the-blade-2024')).toBe(false)
    expect(classOptions('invocation', '2024').map(o => o.id)).toContain('pact-of-the-blade-2024')
    expect(classOptions('pactBoon', '2024')).toEqual([])
    for (const o of [...INVOCATIONS, ...INVOCATIONS_2024]) {
      for (const r of o.requires ?? []) expect(classOptionById(r)?.edition, `${o.id} requires ${r}`).toBe(o.edition)
    }
  })

  it('counts picks by warlock level in each edition', () => {
    expect(optionSlots(warlock(1), 'warlock', 'invocation')).toBe(0)
    expect(optionSlots(warlock(2), 'warlock', 'invocation')).toBe(2)
    expect(optionSlots(warlock(18), 'warlock', 'invocation')).toBe(8)
    expect(optionKindsFor(warlock(3), 'warlock')).toEqual([{ kind: 'invocation', count: 2 }, { kind: 'pactBoon', count: 1 }])
    const w24 = (l: number) => warlock(l, [], { rulesEdition: '2024' })
    expect(optionSlots(w24(1), 'warlock', 'invocation')).toBe(1)
    expect(optionSlots(w24(2), 'warlock', 'invocation')).toBe(3)
    expect(optionSlots(w24(5), 'warlock', 'invocation')).toBe(5)
    expect(optionSlots(w24(20), 'warlock', 'invocation')).toBe(10)
    expect(optionKindsFor(warlock(5, [], { classes: [{ classId: 'fighter', level: 5 }] }), 'fighter')).toEqual([])
  })

  it('applies picked invocations to the sheet', () => {
    const d = derive(warlock(9, [
      pick('pact-of-the-chain'), pick('devils-sight'), pick('beguiling-influence'), pick('eldritch-mind'),
      pick('mask-of-many-faces'), pick('minions-of-chaos'),
    ]))
    expect(d.senses.darkvision).toBe(120)
    expect(d.skills.deception.proficient).toBe(true)
    expect(d.skills.persuasion.proficient).toBe(true)
    expect(d.advantages).toContainEqual({ on: 'concentration', source: 'Eldritch Mind' })
    expect(d.itemSpells).toContainEqual({ spell: 'Disguise Self', note: 'at will', source: 'Mask of Many Faces' })
    expect(d.itemSpells).toContainEqual({ spell: 'Find Familiar', note: 'ritual', source: 'Pact of the Chain' })
    expect(d.resources.find(r => r.label === 'Minions of Chaos')).toMatchObject({ max: 1, recharge: 'long' })
    expect(d.features.find(f => f.optionId === 'devils-sight')).toMatchObject({ name: "Devil's Sight", className: 'Warlock' })
    expect(d.warnings).toEqual([])
  })

  it('warns, never blocks, on missing prerequisites and too many picks', () => {
    const d = derive(warlock(2, [pick('thirsting-blade'), pick('devils-sight'), pick('armor-of-shadows')]))
    expect(d.features.some(f => f.optionId === 'thirsting-blade')).toBe(true)
    expect(d.warnings).toContain('Thirsting Blade needs class level 5.')
    expect(d.warnings).toContain('Thirsting Blade needs Pact of the Blade.')
    expect(d.warnings).toContain('3 Eldritch Invocations picked; class level 2 allows 2.')
  })

  it('takes 2024 repeatable invocations and the feat from Lessons of the First Ones', () => {
    const c = warlock(5, [
      pick('pact-of-the-blade-2024'), pick('agonizing-blast-2024', { choice: 'Eldritch Blast' }), pick('agonizing-blast-2024', { choice: 'Toll the Dead' }),
      pick('lessons-of-the-first-ones-2024', { choice: 'alert' }), pick('witch-sight-2024'),
    ], { rulesEdition: '2024' })
    const d = derive(c)
    expect(d.features.filter(f => f.optionId === 'agonizing-blast-2024').map(f => f.name)).toEqual(['Agonizing Blast (Eldritch Blast)', 'Agonizing Blast (Toll the Dead)'])
    expect(getFeats(c).map(f => f.id)).toContain('alert')
    expect(d.senses.truesight).toBe(30)
    expect(derive(warlock(5, [pick('gift-of-the-depths')])).speeds.swim).toBe(30)
    expect(d.warnings).toContain('Witch Sight needs class level 15.')
  })

  it('drops picks made through a class the character no longer has', () => {
    const d = derive(warlock(3, [pick('devils-sight')], { classes: [{ classId: 'fighter', level: 3 }] }))
    expect(d.senses.darkvision ?? 0).not.toBe(120)
    expect(d.features.some(f => f.optionId)).toBe(false)
  })

  it('explains every option in English and names it in Hebrew', () => {
    const all = [...PACT_BOONS, ...INVOCATIONS, ...INVOCATIONS_2024]
    expect(all.filter(o => !(`why.invocation.${o.id}` in en)).map(o => o.id)).toEqual([])
    expect(all.filter(o => !(`feature.${o.name}` in he.terms)).map(o => o.name)).toEqual([])
    expect(all.flatMap(o => (o.prerequisite && !(`prereq.${o.prerequisite}` in he.terms) ? [o.prerequisite] : []))).toEqual([])
  })
})

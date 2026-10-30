import { describe, expect, it } from 'vitest'
import { optionKey } from '../builder/why'
import type { ClassLevel } from '../model/character'
import { en } from '../i18n/locales/en'
import { he } from '../i18n/locales/he'
import {
  SUBCLASS_OPTIONS, SUBCLASS_PICK_LISTS, createCharacter, derive, getResources, subclassById, subclassPickLists, togglePick,
  type CharacterDraft,
} from './index'

const hero = (cl: ClassLevel, over: Partial<CharacterDraft> = {}) => createCharacter({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [cl],
  abilityMethod: 'manual', baseAbilities: { str: 16, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  freeAbilityBonuses: [], chosenSkills: [],
  ...over,
})
const picks = (classId: string, kind: string, ...ids: string[]) => ({ classOptions: ids.map(id => ({ kind, id, classId })) })

describe('subclass pick lists', () => {
  it('names a real feature of every subclass it belongs to, with enough options', () => {
    const problems: string[] = []
    for (const l of SUBCLASS_PICK_LISTS) {
      for (const edition of l.edition ? [l.edition] : (['2014', '2024'] as const)) {
        for (const id of l.subclassIds) {
          const sub = subclassById(id, edition)
          if (!sub) continue
          if (!sub.features.some(f => f.name === l.feature)) problems.push(`${edition} ${id}: no feature ${l.feature}`)
          const options = SUBCLASS_OPTIONS.filter(o => o.kind === l.kind && (!o.edition || o.edition === edition) && o.subclassIds?.includes(id))
          const most = Math.max(...l.count.map(([, n]) => n))
          if (options.length < most) problems.push(`${edition} ${id} ${l.kind}: ${options.length} options for ${most} picks`)
        }
      }
      if (!l.subclassIds.some(id => subclassById(id, '2014') || subclassById(id, '2024'))) problems.push(`${l.kind}: unknown subclasses`)
    }
    expect(problems).toEqual([])
  })

  it('gives every option a unique id within its edition', () => {
    for (const edition of ['2014', '2024'] as const) {
      const ids = SUBCLASS_OPTIONS.filter(o => !o.edition || o.edition === edition).map(o => o.id)
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
    }
  })

  it('explains every list and option in English and Hebrew', () => {
    for (const kind of new Set(SUBCLASS_PICK_LISTS.map(l => l.kind))) {
      expect(en, kind).toHaveProperty([`why.pick.${kind}`])
      expect(he.messages, kind).toHaveProperty([`why.pick.${kind}`])
    }
    expect(SUBCLASS_OPTIONS.filter(o => !optionKey(o)).map(o => o.id)).toEqual([])
    // Options with their own line also need a Hebrew line and a Hebrew name; skill and weapon options borrow theirs.
    const own = SUBCLASS_OPTIONS.filter(o => `why.opt.${o.id}` in en)
    expect(own.filter(o => !(`why.opt.${o.id}` in he.messages) || !(`option.${o.id}` in he.terms)).map(o => o.id)).toEqual([])
  })

  it('counts Battle Master maneuvers by level and leaves out the 2014-only ones in 2024', () => {
    const at = (level: number, rulesEdition?: '2024') =>
      subclassPickLists(hero({ classId: 'fighter', level, subclassId: 'battle-master' }, { rulesEdition })).find(l => l.list.kind === 'maneuver')!
    expect([3, 7, 10, 15].map(l => at(l).max)).toEqual([3, 5, 7, 9])
    expect(at(3).options.map(o => o.id)).toContain('mv-brace')
    expect(at(3, '2024').options.map(o => o.id)).not.toContain('mv-brace')
    expect(subclassPickLists(hero({ classId: 'fighter', level: 2, subclassId: 'battle-master' }))).toEqual([])
  })

  it('swaps the pick on a one-pick list and adds on a longer one', () => {
    const c = hero({ classId: 'barbarian', level: 3, subclassId: 'totem-warrior' }, picks('barbarian', 'totemSpirit', 'totem-bear'))
    const totem = subclassPickLists(c).find(l => l.list.kind === 'totemSpirit')!
    expect(togglePick(c, totem, 'totem-wolf').map(p => p.id)).toEqual(['totem-wolf'])
    expect(togglePick(c, totem, 'totem-bear')).toEqual([])
    const bm = hero({ classId: 'fighter', level: 3, subclassId: 'battle-master' }, picks('fighter', 'maneuver', 'mv-parry'))
    const list = subclassPickLists(bm).find(l => l.list.kind === 'maneuver')!
    expect(togglePick(bm, list, 'mv-riposte').map(p => p.id)).toEqual(['mv-parry', 'mv-riposte'])
  })

  it('applies rune perks and their once-per-rest uses', () => {
    const c = hero({ classId: 'fighter', level: 3, subclassId: 'rune-knight' }, picks('fighter', 'rune', 'rune-stone', 'rune-cloud'))
    const d = derive(c)
    expect(d.senses.darkvision).toBe(120)
    expect(d.advantages.map(a => a.on)).toEqual(expect.arrayContaining(['skill:insight', 'skill:deception', 'skill:sleightOfHand']))
    expect(getResources(c).find(r => r.id === 'opt:rune-stone')).toMatchObject({ max: 1, recharge: 'short' })
  })

  it('adds Storm Soul from level 6 and drops picks when the subclass changes', () => {
    const sea = (level: number, subclassId = 'storm-herald') => derive(hero({ classId: 'barbarian', level, subclassId }, picks('barbarian', 'stormAura', 'storm-sea')))
    expect(sea(3).defenses.resistances).not.toContain('lightning')
    expect(sea(6).defenses.resistances).toContain('lightning')
    expect(sea(6).speeds.swim).toBe(30)
    expect(sea(6, 'zealot').defenses.resistances).not.toContain('lightning')
  })

  it('grants Circle of the Land spells by druid level', () => {
    const spells = (level: number) => derive(hero({ classId: 'druid', level, subclassId: 'land' }, picks('druid', 'landTerrain', 'land-arctic'))).itemSpells.map(s => s.spell)
    expect(spells(5)).toEqual(['Hold Person', 'Spike Growth', 'Sleet Storm', 'Slow'])
    expect(spells(9)).toContain('Cone of Cold')
  })

  it('gives Knowledge domain expertise and lists picks under their feature', () => {
    const c = hero({ classId: 'cleric', level: 1, subclassId: 'knowledge' }, picks('cleric', 'knowledgeSkill', 'know-arcana', 'know-history'))
    const d = derive(c)
    expect(d.skills.arcana).toMatchObject({ proficient: true, expertise: true })
    const names = d.features.map(f => f.name)
    const at = names.indexOf('Blessings of Knowledge')
    expect(names.slice(at + 1, at + 3)).toEqual(['Arcana', 'History'])
    expect(d.features[at + 1].optionId).toBe('know-arcana')
  })
})

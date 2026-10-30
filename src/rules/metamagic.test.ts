import { describe, expect, it } from 'vitest'
import { explainKey } from '../builder/why'
import { he } from '../i18n/locales/he'
import { METAMAGIC, METAMAGIC_2024, classOptionById, getMetamagic, metamagicCost, metamagicCount, metamagicOptions, registerClassOptions, toggleMetamagic } from '.'

const sorc = (level: number, rulesEdition?: '2024') => ({ classes: [{ classId: 'sorcerer', level }], ...(rulesEdition ? { rulesEdition } : {}) })

describe('Metamagic', () => {
  it('offers every official option: 8 PHB + 2 Tasha\'s in 2014, 10 in 2024', () => {
    expect(metamagicOptions({}).map(o => o.id)).toEqual(['careful', 'distant', 'empowered', 'extended', 'heightened', 'quickened', 'subtle', 'twinned', 'seeking', 'transmuted'])
    expect(metamagicOptions({ rulesEdition: '2024' })).toHaveLength(10)
  })

  it('knows 2/3/4 options in 2014 and 2/4/6 in 2024, by sorcerer level', () => {
    expect([2, 3, 9, 10, 17].map(l => metamagicCount(sorc(l)))).toEqual([0, 2, 2, 3, 4])
    expect([1, 2, 9, 10, 17].map(l => metamagicCount(sorc(l, '2024')))).toEqual([0, 2, 2, 4, 6])
    expect(metamagicCount({ classes: [{ classId: 'wizard', level: 5 }, { classId: 'sorcerer', level: 3 }] })).toBe(2)
    expect(metamagicCount({ classes: [{ classId: 'wizard', level: 20 }] })).toBe(0)
  })

  it('costs follow the edition: Heightened 3 then 2, Seeking 2 then 1, 2014 Twinned per spell level', () => {
    const cost = (id: string, edition?: '2024', level?: number) => metamagicCost(classOptionById(id, edition ?? '2014')!, level)
    expect([cost('heightened'), cost('heightened', '2024')]).toEqual([3, 2])
    expect([cost('seeking'), cost('seeking', '2024')]).toEqual([2, 1])
    expect([cost('twinned', undefined, 0), cost('twinned', undefined, 1), cost('twinned', undefined, 5)]).toEqual([1, 1, 5])
    expect(cost('twinned', '2024', 5)).toBe(1)
    expect(cost('quickened')).toBe(2)
  })

  it('toggles picks without touching other kinds, and keeps them across editions', () => {
    const other = { kind: 'maneuver', id: 'riposte' }
    let picks = toggleMetamagic({ classOptions: [other] }, 'quickened')
    picks = toggleMetamagic({ classOptions: picks }, 'heightened')
    expect(picks).toEqual([other, { kind: 'metamagic', id: 'quickened', classId: 'sorcerer' }, { kind: 'metamagic', id: 'heightened', classId: 'sorcerer' }])
    expect(getMetamagic({ classOptions: picks }).map(o => o.cost)).toEqual([2, 3])
    expect(getMetamagic({ classOptions: picks, rulesEdition: '2024' }).map(o => o.cost)).toEqual([2, 2])
    expect(toggleMetamagic({ classOptions: picks }, 'quickened')).toEqual([other, { kind: 'metamagic', id: 'heightened', classId: 'sorcerer' }])
  })

  it('lists homebrew options too and skips unknown ids', () => {
    registerClassOptions('test-homebrew', [{ id: 'hb:pack:loud', kind: 'metamagic', name: 'Loud Spell', cost: 1, text: 'Everyone hears it.' }])
    expect(metamagicOptions({ rulesEdition: '2024' }).map(o => o.id)).toContain('hb:pack:loud')
    expect(getMetamagic({ classOptions: [{ kind: 'metamagic', id: 'hb:pack:loud' }, { kind: 'metamagic', id: 'gone' }] }).map(o => o.name)).toEqual(['Loud Spell'])
    registerClassOptions('test-homebrew', [])
  })

  it('explains and names every option in English and Hebrew', () => {
    for (const o of METAMAGIC) expect(explainKey('metamagic', o.id), o.id).toBeDefined()
    for (const o of METAMAGIC_2024) expect(explainKey('metamagic2024', o.id), o.id).toBeDefined()
    for (const o of [...METAMAGIC, ...METAMAGIC_2024]) expect(he.terms, o.id).toHaveProperty([`metamagic.${o.id}`])
  })
})

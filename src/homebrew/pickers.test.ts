// Homebrew class options written in a pack must show up in every picker that offers that kind.
import { afterEach, describe, expect, it } from 'vitest'
import { classChoices, classOptions, createCharacter, metamagicOptions, optionsFor, registerClassOptions, subclassPickLists, type CharacterDraft } from '../rules'
import { sanitizePack } from './pack'

const pack = sanitizePack({
  format: 'ff-homebrew', version: 1, id: 'abcd1234', name: 'Mine',
  classOptions: [
    { kind: 'invocation', name: 'Grave Sight', text: 'See the dead.', classIds: ['warlock'] },
    { kind: 'metamagic', name: 'Echo', text: 'Again.', classIds: ['sorcerer'], cost: 1 },
    { kind: 'maneuver', name: 'Shield Bash', text: 'Bonk.', classIds: ['fighter'] },
    { kind: 'fightingStyle', name: 'Shield Wall', text: 'Hold.', classIds: ['fighter'] },
    { kind: 'infusion', name: 'Ember Blade', text: 'Hot.', classIds: ['artificer'] },
  ],
})

const char = (classId: string, level: number, over: Partial<CharacterDraft> = {}) => createCharacter({
  name: 'T', ownerId: 'u1', playerName: '', alignment: 'True Neutral', raceId: 'human', backgroundId: 'acolyte',
  classes: [{ classId, level }], abilityMethod: 'manual', baseAbilities: { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 },
  freeAbilityBonuses: [], chosenSkills: [], ...over,
})

const ids = (list: { id: string }[]) => list.map(o => o.id)

describe('homebrew class options in the pickers', () => {
  registerClassOptions('homebrew', pack.classOptions)
  afterEach(() => registerClassOptions('homebrew', pack.classOptions))

  it('lists invocations and metamagic in both editions', () => {
    for (const edition of ['2014', '2024'] as const) {
      expect(ids(classOptions('invocation', edition))).toContain('hb:abcd1234:grave-sight')
      expect(ids(metamagicOptions(edition === '2024' ? { rulesEdition: '2024' } : {}))).toContain('hb:abcd1234:echo')
    }
  })

  it('offers maneuvers to a Battle Master and fighting styles to a fighter', () => {
    const bm = char('fighter', 3, { classes: [{ classId: 'fighter', level: 3, subclassId: 'battle-master' }] })
    const maneuvers = subclassPickLists(bm).find(l => l.list.kind === 'maneuver')
    expect(ids(maneuvers!.options)).toContain('hb:abcd1234:shield-bash')
    const style = classChoices(char('fighter', 1)).find(x => x.choice.id === 'fightingStyle')
    expect(ids(style!.choice.options)).toContain('hb:abcd1234:shield-wall')
  })

  it('offers infusions to an artificer', () => {
    expect(ids(optionsFor(char('artificer', 2), { classId: 'artificer', kind: 'infusion', level: 2 }))).toContain('hb:abcd1234:ember-blade')
  })
})

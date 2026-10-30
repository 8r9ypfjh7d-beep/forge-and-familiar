import { describe, expect, it } from 'vitest'
import { optionKey, featureKey, explainKey, pitchKey } from '../builder/why'
import { en } from '../i18n/locales/en'
import { he } from '../i18n/locales/he'
import { infusionStats } from '../inventory/inventory'
import { spellAccess } from '../spellbook/access'
import {
  ARTIFICER, ARTIFICER_2024, ARTIFICER_INFUSIONS, ARTIFICER_PLANS, ARTIFICER_SUBCLASSES, ARTIFICER_SUBCLASSES_2024, classOptionById, classesFor,
  createCharacter, derive, getCasterLevel, getSpellSlots, optionPickSlots, optionsFor, subclassesFor, toggleClassOption, type CharacterDraft,
} from './index'

const artificer = (level: number, over: Partial<CharacterDraft> = {}) => createCharacter({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'artificer', level }],
  abilityMethod: 'manual', baseAbilities: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 8 },
  freeAbilityBonuses: [], chosenSkills: ['arcana', 'investigation'],
  ...over,
})

describe('artificer', () => {
  it('is offered in both editions with its specialists', () => {
    expect(classesFor().map(c => c.id)).toContain('artificer')
    expect(classesFor('2024').map(c => c.id)).toContain('artificer')
    expect(subclassesFor('artificer').map(s => s.id)).toEqual(['alchemist', 'armorer-guardian', 'armorer-infiltrator', 'artillerist', 'battle-smith'])
    expect(subclassesFor('artificer', '2024').map(s => s.id)).toContain('cartographer')
  })

  it('casts from level 1 and rounds up, also when multiclassed', () => {
    expect(getSpellSlots(artificer(1)).slots.slice(0, 2)).toEqual([2, 0])
    expect(getSpellSlots(artificer(5)).slots.slice(0, 2)).toEqual([4, 2])
    const mc = artificer(3, { classes: [{ classId: 'artificer', level: 3 }, { classId: 'wizard', level: 2 }] })
    expect(getCasterLevel(mc).casterLevel).toBe(4)
    const pal = artificer(3, { classes: [{ classId: 'artificer', level: 3 }, { classId: 'paladin', level: 3 }] })
    expect(getCasterLevel(pal).casterLevel).toBe(3)
  })

  it('tracks Flash of Genius and Spell-Storing Item uses from Intelligence', () => {
    const r = derive(artificer(11)).resources
    expect(r.find(x => x.id === 'flash-of-genius')?.max).toBe(3)
    expect(r.find(x => x.id === 'spell-storing-item')?.max).toBe(6)
    expect(derive(artificer(6)).resources.find(x => x.id === 'flash-of-genius')).toBeUndefined()
  })

  it('lets a Battle Smith attack with Intelligence using magic weapons only', () => {
    const smith = artificer(3, { classes: [{ classId: 'artificer', level: 3, subclassId: 'battle-smith' }] })
    smith.inventory = [
      { uid: 'a', itemId: 'longsword', qty: 1, equipped: true, magicBonus: 1 },
      { uid: 'b', itemId: 'warhammer', qty: 1, equipped: true },
    ]
    const attacks = derive(smith).attacks
    expect(attacks.find(a => a.itemId === 'longsword')).toMatchObject({ ability: 'int', proficient: true })
    expect(attacks.find(a => a.itemId === 'warhammer')).toMatchObject({ ability: 'str', proficient: true })
  })

  it('gives the Infiltrator its speed and stealth advantage, and the Alchemist its resistances', () => {
    const inf = derive(artificer(3, { classes: [{ classId: 'artificer', level: 3, subclassId: 'armorer-infiltrator' }] }))
    expect(inf.speed).toBe(35)
    expect(inf.skills.stealth.advantage).toBe(true)
    const alc = derive(artificer(15, { classes: [{ classId: 'artificer', level: 15, subclassId: 'alchemist' }] }))
    expect(alc.defenses.resistances).toEqual(expect.arrayContaining(['acid', 'poison']))
    expect(alc.defenses.conditionImmunities).toContain('poisoned')
  })

  it('counts Infusions by level, offers only unlocked ones and lists the picks after the feature', () => {
    const c = artificer(2)
    const [slot] = optionPickSlots(c)
    expect(slot).toMatchObject({ kind: 'infusion', count: 4, name: 'Infuse Item' })
    const offered = optionsFor(c, slot)
    expect(offered.some(o => o.id === 'infusion:enhanced-defense')).toBe(true)
    expect(offered.some(o => o.id === 'infusion:helm-of-awareness')).toBe(false)
    c.classOptions = toggleClassOption(c, slot, 'infusion:enhanced-defense')
    expect(derive(c).features.find(f => f.optionId === 'infusion:enhanced-defense')).toMatchObject({ name: 'Enhanced Defense', level: 2 })
    // Picks change items, not the character: no AC from knowing Enhanced Defense.
    expect(derive(c).armorClass.value).toBe(derive(artificer(2)).armorClass.value)
    expect(optionPickSlots(artificer(18, { rulesEdition: '2024' }))[0]).toMatchObject({ kind: 'replicate', count: 8 })
  })

  it('puts an infusion or plan on an item as a bonus or the library item\'s effects', () => {
    expect(infusionStats(classOptionById('plan:weapon-1', '2024')!).magicBonus).toBe(1)
    expect(infusionStats(classOptionById('infusion:enhanced-arcane-focus', '2014')!).effects).toEqual([{ kind: 'spellAttack', value: 1 }])
    expect(infusionStats(classOptionById('replicate:gauntlets-of-ogre-power', '2014')!).effects).toEqual([{ kind: 'abilitySet', ability: 'str', value: 19 }])
  })

  it('reads its spell list from the engine, since the library has no artificer table', () => {
    const spells = [{ id: 'cure-wounds', name: 'Cure Wounds' }, { id: 'fireball', name: 'Fireball' }]
    const [a] = spellAccess(artificer(5), [], [], { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 8 }, undefined, spells)
    expect(a).toMatchObject({ classId: 'artificer', ability: 'int', maxLevel: 2, cantrips: 2, kind: 'prepared', limit: 5, listed: ['cure-wounds'] })
  })

  it('explains everything in English and names it in Hebrew', () => {
    expect(pitchKey('class', 'artificer')).toBeDefined()
    expect(explainKey('about', 'artificer')).toBeDefined()
    for (const c of [ARTIFICER, ARTIFICER_2024]) {
      for (const f of c.features) {
        expect(explainKey('feature', f.name), f.name).toBeDefined()
        expect(he.terms, f.name).toHaveProperty([`feature.${f.name}`])
      }
    }
    for (const s of [...ARTIFICER_SUBCLASSES, ...ARTIFICER_SUBCLASSES_2024]) {
      expect(explainKey('subclass', s.id), s.id).toBeDefined()
      for (const f of s.features) {
        expect(featureKey(f.name, s.id), `${s.id}: ${f.name}`).toBeDefined()
        expect(he.terms, f.name).toHaveProperty([`feature.${f.name}`])
      }
    }
    for (const o of [...ARTIFICER_INFUSIONS, ...ARTIFICER_PLANS]) {
      expect(optionKey(o), o.id).toBeDefined()
      expect(he.terms, o.id).toHaveProperty([`option.${o.id}`])
    }
    const keys = Object.keys(en).filter(k => k.startsWith('why.option') || k.startsWith('builder.options') || k.includes('infuse'))
    expect(keys.filter(k => !(k in he.messages))).toEqual([])
  })
})

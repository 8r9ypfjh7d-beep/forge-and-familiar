import { describe, expect, it } from 'vitest'
import { emptyDraft } from '../builder/Builder'
import { STEPS } from '../builder/steps'
import { stepIssues } from '../builder/validate'
import { en } from '../i18n/locales/en'
import { he } from '../i18n/locales/he'
import { WEAPON_MASTERY, classById, createCharacter, getAbilityScores, getMaxHp, itemById } from '../rules'
import { spellAccess } from '../spellbook/access'
import { HOOK_COUNT, hasPicks, kitItems, randomCharacterDraft, randomDraft, randomHookKey } from './generate'
import { isAttackSpell, loadSpellLibrary, randomSpells } from './spells'
import { randomName } from './names'

/** Small seeded generator so failures can be replayed. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

describe('random character', () => {
  for (const edition of ['2014', '2024'] as const) {
    it(`passes every builder step (${edition})`, () => {
      for (let seed = 1; seed <= 400; seed++) {
        const d = randomDraft('p1', edition, seeded(seed))
        for (const s of STEPS) expect({ seed, step: s.id, issues: stepIssues(s.id, d) }).toEqual({ seed, step: s.id, issues: [] })
        const c = createCharacter(d)
        expect(getMaxHp(c)).toBeGreaterThan(0)
        expect(c.state.currentHp).toBe(getMaxHp(c))
      }
    })
  }

  it('varies race and class', () => {
    const drafts = Array.from({ length: 200 }, (_, i) => randomDraft('p1', '2014', seeded(i + 1)))
    expect(new Set(drafts.map(d => d.raceId)).size).toBeGreaterThan(5)
    expect(new Set(drafts.map(d => d.classes[0].classId)).size).toBeGreaterThan(8)
  })
})

describe('random name and hook', () => {
  it('names every race, with a fallback', () => {
    for (const id of ['human', 'dwarf', 'elf', 'orc', 'goliath', 'my-homebrew']) expect(randomName(id, seeded(3))).toMatch(/^\S+/)
  })

  it('has every hook in English and Hebrew', () => {
    for (let n = 0; n < HOOK_COUNT; n++) {
      expect(en).toHaveProperty([`random.hook.${n}`])
      expect(he.messages).toHaveProperty([`random.hook.${n}`])
    }
    expect(randomHookKey(() => 0.999)).toBe(`random.hook.${HOOK_COUNT - 1}`)
  })
})

describe('random gear, styles and spells', () => {
  it('rolls a fighting style and Weapon Mastery that fit the kit', () => {
    for (const edition of ['2014', '2024'] as const) {
      for (let seed = 1; seed <= 400; seed++) {
        const d = randomDraft('p1', edition, seeded(seed))
        const cl = d.classes[0]
        const kit = kitItems(classById(cl.classId, edition), d.equipmentPicks)
        const weapons = kit.map(itemById).filter(i => i?.kind === 'weapon')
        const style = d.featureChoices?.[`${cl.classId}.fightingStyle`]
        const has = (p: string) => weapons.some(w => w.properties.includes(p as never))
        if (style === 'great-weapon-fighting') expect({ seed, kit, style, ok: weapons.some(w => !w.properties.includes('ranged') && w.properties.includes('two-handed')) }).toMatchObject({ ok: true })
        if (style === 'two-weapon-fighting') expect({ seed, kit, style, ok: weapons.filter(w => w.properties.includes('light') && !w.properties.includes('ranged')).length >= 2 }).toMatchObject({ ok: true })
        if (style === 'archery') expect({ seed, kit, style, ok: has('ranged') }).toMatchObject({ ok: true })
        if (style === 'protection') expect({ seed, kit, style, ok: kit.includes('shield') }).toMatchObject({ ok: true })
        // Every kit weapon the class can master is mastered before any weapon it doesn't own.
        const masteries = d.weaponMasteries ?? []
        const ownedOptions = new Set(kit.filter(id => masteries.includes(id)))
        if (masteries.some(id => !kit.includes(id))) expect({ seed, kit, masteries, owned: ownedOptions.size }).toMatchObject({ owned: new Set(kit.filter(id => itemById(id)?.kind === 'weapon' && id in WEAPON_MASTERY)).size })
      }
    }
  })

  it('never takes the coins-only kit', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const d = randomDraft('p1', '2024', seeded(seed))
      expect(kitItems(classById(d.classes[0].classId, '2024'), d.equipmentPicks).length).toBeGreaterThan(0)
    }
  })

  for (const edition of ['2014', '2024'] as const) {
    it(`gives casters their full spells, an attack cantrip first (${edition})`, async () => {
      const lib = await loadSpellLibrary(edition)
      const byId = new Map(lib.spells.map(s => [s.id, s]))
      for (let seed = 1; seed <= 150; seed++) {
        const d = randomDraft('p1', edition, seeded(seed))
        const spells = randomSpells(d, lib, seeded(seed))
        expect(spells.length).toBe(new Set(spells.map(k => `${k.classId}|${k.id}`)).size)
        for (const a of spellAccess(d, lib.classes, lib.subclasses, getAbilityScores(d), undefined, lib.spells)) {
          const mine = spells.filter(k => k.classId === a.classId).map(k => byId.get(k.id)!)
          const cantrips = mine.filter(s => s.level === 0)
          expect({ seed, classId: a.classId, cantrips: cantrips.length }).toEqual({ seed, classId: a.classId, cantrips: a.cantrips })
          if (a.cantrips) expect({ seed, attack: cantrips.some(isAttackSpell) }).toEqual({ seed, attack: true })
          if (a.maxLevel > 0) expect({ seed, classId: a.classId, leveled: mine.length - cantrips.length }).toEqual({ seed, classId: a.classId, leveled: a.spellbook ?? a.limit })
        }
      }
    })
  }

  it('randomCharacterDraft fills in spells', async () => {
    const d = await randomCharacterDraft('p1', '2014', seeded(7))
    expect(d.spells).toBeDefined()
  })

  it('only counts real picks as worth asking about', () => {
    const empty = emptyDraft('p1', 'Ziv')
    expect(hasPicks({ ...empty, rulesEdition: '2024', featureChoices: {}, equipmentPicks: [] })).toBe(false)
    expect(hasPicks({ ...empty, raceId: 'elf' })).toBe(true)
  })
})

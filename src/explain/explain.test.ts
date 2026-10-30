import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import { ABILITIES, ALL_SKILLS, createCharacter, derive, type CharacterDraft } from '../rules'
import { grantTempHp, setResourceUsed, setSlotUsed, takeDamage, upsertCounter } from '../sheet/engine'
import { makeCharacter } from '../sheet/fixtures'
import { describeChange } from './changes'
import { explain, type StatKey } from './math'

const draft = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Test', ownerId: 'u1', playerName: '', alignment: 'True Neutral',
  raceId: 'human', backgroundId: 'acolyte', classes: [{ classId: 'fighter', level: 1 }],
  abilityMethod: 'standard', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  freeAbilityBonuses: [], chosenSkills: ['athletics', 'perception'],
  ...over,
})

const make = (over: Partial<CharacterDraft> = {}, equip: string[] = []): Character => {
  const c = createCharacter(draft(over))
  if (equip.length) c.inventory = equip.map((itemId, i) => ({ uid: String(i), itemId, qty: 1, equipped: true }))
  return c
}

const CASES: [string, Character][] = [
  ['fighter in chain mail', make({}, ['chain-mail', 'shield', 'longsword'])],
  ['weak fighter in plate', make({ baseAbilities: { str: 8, dex: 10, con: 8, int: 10, wis: 10, cha: 10 } }, ['plate', 'longsword'])],
  ['monk, unarmored', make({ classes: [{ classId: 'monk', level: 10 }], baseAbilities: { str: 10, dex: 16, con: 12, int: 8, wis: 16, cha: 8 } }, ['shortsword'])],
  ['monk with a shield', make({ classes: [{ classId: 'monk', level: 3 }] }, ['shield'])],
  ['barbarian 5', make({ classes: [{ classId: 'barbarian', level: 5 }], baseAbilities: { str: 15, dex: 14, con: 16, int: 8, wis: 10, cha: 8 } }, ['greataxe'])],
  ['bard 6 (jack of all trades)', make({ classes: [{ classId: 'bard', level: 6 }], chosenSkills: ['performance'] }, ['rapier', 'leather'])],
  ['hill dwarf cleric', make({ raceId: 'dwarf', subraceId: 'hill-dwarf', classes: [{ classId: 'cleric', level: 4 }] }, ['scale-mail'])],
  ['half-elf sorcerer, frail', make({ raceId: 'half-elf', freeAbilityBonuses: ['con', 'dex'], classes: [{ classId: 'sorcerer', level: 3 }], baseAbilities: { str: 8, dex: 8, con: 3, int: 10, wis: 10, cha: 20 } })],
  ['rogue 5', make({ classes: [{ classId: 'rogue', level: 5 }] })],
  ['multiclass fighter/wizard', makeCharacter()],
  ['2024 dwarf fighter with Defense and Archery', make({
    rulesEdition: '2024', raceId: 'dwarf', backgroundId: 'soldier', freeAbilityBonuses: ['str', 'str', 'con'],
    classes: [{ classId: 'fighter', level: 3 }], featureChoices: { 'fighter.fightingStyle': 'archery' },
  }, ['chain-mail', 'longbow', 'longsword'])],
  ['2024 wood elf rogue with Alert', make({
    rulesEdition: '2024', raceId: 'elf', subraceId: 'wood-elf', backgroundId: 'criminal', freeAbilityBonuses: ['dex', 'dex', 'con'],
    classes: [{ classId: 'rogue', level: 3 }],
  }, ['leather', 'rapier'])],
  ['2024 fighter with Defense', make({
    rulesEdition: '2024', raceId: 'orc', backgroundId: 'soldier', freeAbilityBonuses: ['str', 'con', 'dex'],
    classes: [{ classId: 'fighter', level: 1 }], featureChoices: { 'fighter.fightingStyle': 'defense' },
  }, ['chain-mail', 'shield', 'longsword'])],
  ['magic gear and a 2024 pact weapon', (() => {
    const c = make({ classes: [{ classId: 'warlock', level: 7 }], baseAbilities: { str: 10, dex: 14, con: 12, int: 8, wis: 10, cha: 18 } })
    c.spellEdition = '2024'
    c.inventory = [
      { uid: 'a', itemId: 'greatsword', qty: 1, equipped: true, name: 'Oathbreaker', magicBonus: 1, pact: true },
      { uid: 'b', itemId: 'leather', qty: 1, equipped: true, magicBonus: 1 },
      { uid: 'c', itemId: 'stone-of-good-luck-luckstone', qty: 1, equipped: true, effects: [{ kind: 'checks', value: 1 }, { kind: 'saves', value: 1 }] },
      { uid: 'd', itemId: 'headband-of-intellect', qty: 1, equipped: true, effects: [{ kind: 'abilitySet', ability: 'int', value: 19 }] },
      { uid: 'e', itemId: 'robe', qty: 1, equipped: true, effects: [{ kind: 'spellAttack', value: 2 }, { kind: 'spellDc', value: 2 }, { kind: 'speed', value: 10 }, { kind: 'ac', value: 5, unarmored: true }] },
    ]
    return c
  })()],
  ['items with save, skill, HP and ranged-only effects', (() => {
    const c = make({ classes: [{ classId: 'ranger', level: 5 }], baseAbilities: { str: 12, dex: 16, con: 14, int: 10, wis: 13, cha: 8 } }, ['longbow', 'shortsword'])
    c.inventory.push(
      { uid: 'x', itemId: 'bracers', qty: 1, equipped: true, effects: [{ kind: 'damage', value: 2, only: 'ranged' }, { kind: 'attack', value: 1, only: 'melee' }] },
      { uid: 'y', itemId: 'amulet', qty: 1, equipped: true, effects: [
        { kind: 'save', ability: 'wis', value: 2 }, { kind: 'saveProficiency', ability: 'cha' }, { kind: 'skill', skill: 'stealth', value: 3 },
        { kind: 'skillProficiency', skill: 'arcana', expertise: true }, { kind: 'hp', value: 10 }, { kind: 'passivePerception', value: 5 },
      ] },
    )
    return c
  })()],
]

function keysFor(c: Character): StatKey[] {
  const d = derive(c)
  return [
    'ac', 'initiative', 'speed', 'proficiency', 'maxHp', 'passivePerception', 'spellDc', 'spellAttack', 'carryingCapacity',
    ...ABILITIES.flatMap(a => [`ability:${a}`, `mod:${a}`, `save:${a}`] as StatKey[]),
    ...ALL_SKILLS.map(s => `skill:${s}` as StatKey),
    ...d.attacks.map((_, i) => `attack:${i}` as StatKey),
  ]
}

function expected(c: Character, key: StatKey): number | undefined {
  const d = derive(c)
  const [kind, arg] = key.split(':')
  switch (kind) {
    case 'ac': return d.armorClass.value
    case 'initiative': return d.initiative
    case 'speed': return d.speed
    case 'proficiency': return d.proficiencyBonus
    case 'maxHp': return d.maxHp
    case 'passivePerception': return d.passivePerception
    case 'spellDc': return d.spellcasting?.saveDc
    case 'spellAttack': return d.spellcasting?.attackBonus
    case 'carryingCapacity': return d.carryingCapacity
    case 'ability': return d.abilities[arg as keyof typeof d.abilities]
    case 'mod': return d.mods[arg as keyof typeof d.mods]
    case 'save': return d.saves[arg as keyof typeof d.saves].bonus
    case 'skill': return d.skills[arg as keyof typeof d.skills].bonus
    case 'attack': return d.attacks[Number(arg)].bonus
  }
}

describe('show the math', () => {
  for (const [name, c] of CASES) {
    it(`matches derive() for every number: ${name}`, () => {
      for (const key of keysFor(c)) {
        const math = explain(c, key)
        const want = expected(c, key)
        if (want === undefined) { expect(math, key).toBeNull(); continue }
        expect(math, key).not.toBeNull()
        expect([key, math!.total], key).toEqual([key, want])
        expect(math!.lines.reduce((n, l) => n + l.value, 0), key).toBe(want)
      }
    })
  }

  it('names the parts of a breakdown', () => {
    const ac = explain(CASES[0][1], 'ac')!
    expect(ac.lines.map(l => [l.label, l.value])).toEqual([['Chain Mail', 16], ['DEX modifier (max 0)', 0], ['Shield', 2]])
    const hp = explain(makeCharacter(), 'maxHp')!
    expect(hp.lines[0]).toEqual({ label: 'Fighter level 1: d10 at max', value: 10 })
    expect(hp.lines.some(l => l.label.startsWith('CON modifier × 7'))).toBe(true)
  })

  it('credits where a skill proficiency comes from', () => {
    const math = explain(CASES[0][1], 'skill:insight')!
    expect(math.lines[1].label).toBe('Proficiency (Acolyte)')
  })
})

describe('undo log diffs', () => {
  const c = makeCharacter()

  it('describes HP, slots and resources', () => {
    const hit = takeDamage(grantTempHp(c, 3), 10)
    expect(describeChange(c, hit)).toEqual([`HP ${c.state.currentHp} → ${c.state.currentHp - 7}`])
    expect(describeChange(c, setSlotUsed(c, 1, 1))).toEqual(['1st-level slots used 0 → 1'])
    expect(describeChange(c, setResourceUsed(c, 'action-surge', 1))).toEqual(['Action Surge used 0 → 1'])
  })

  it('describes trackers', () => {
    const added = upsertCounter(c, { id: 'arrows', label: 'Arrows', max: 20, used: 0, recharge: 'none' })
    expect(describeChange(c, added)).toEqual(['Added tracker Arrows'])
    expect(describeChange(added, upsertCounter(added, { id: 'arrows', label: 'Arrows', max: 20, used: 4, recharge: 'none' })))
      .toEqual(['Arrows used 0 → 4'])
  })
})

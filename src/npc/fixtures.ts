// A small stat block for tests: a bandit captain with a limited action, a recharge breath, spells and legendary actions.
import type { Block } from '../monsters/block'

export function makeBlock(over: Partial<Block> = {}): Block {
  return {
    id: 'test-captain', name: 'Test Captain', source: 'srd-5.1', edition: '2014',
    sizes: ['Medium'], type: 'humanoid', subtype: 'any race', alignment: 'any non-lawful alignment',
    armorClass: [{ value: 15, type: 'studded leather' }], hitPoints: 65, hitDice: '10d8', hitPointsRoll: '10d8+20',
    speed: { walk: '30 ft.' },
    abilities: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    savingThrows: { str: 4, dex: 5, wis: 2 }, skills: { athletics: 4, deception: 4 },
    damageVulnerabilities: ['cold'], damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'], damageImmunities: ['poison'],
    conditionImmunities: ['poisoned'], senses: { passive_perception: 10 }, languages: 'any two languages',
    challengeRating: 2, xp: 450, proficiencyBonus: 2,
    traits: [{ name: 'Legendary Resistance (2/Day)', description: 'If the captain fails a saving throw, it can choose to succeed instead.', damage: [] }],
    actions: [
      { name: 'Scimitar', description: 'Melee Weapon Attack.', attackBonus: 5, damage: [{ dice: '1d6+3', type: 'slashing' }] },
      { name: 'Fire Breath', description: 'Exhales fire.', damage: [{ dice: '6d6', type: 'fire' }], save: { ability: 'dex', dc: 13, onSuccess: 'half' }, usage: { type: 'recharge', dice: '1d6', minimum: 5 } },
      { name: 'Rally', description: 'Allies gain temporary hit points.', damage: [], usage: { type: 'per day', times: 3 } },
      { name: 'Second Wind', description: 'Regains hit points.', damage: [], usage: { type: 'per rest', rests: ['short', 'long'] } },
    ],
    bonusActions: [], reactions: [{ name: 'Parry', description: 'Adds 2 to AC.', damage: [] }],
    legendaryActions: [{ name: 'Attack', description: 'The captain can take 2 legendary actions. It makes one scimitar attack.', damage: [] }],
    forms: [],
    spellcasting: {
      ability: 'cha', saveDc: 12, attackBonus: 4,
      groups: [
        { label: 'Cantrips (at will)', spells: ['fire-bolt'] },
        { label: '1st level (4 slots)', spells: ['shield', 'magic-missile'] },
        { label: '2nd level (2 slots)', spells: ['misty-step'] },
        { label: '1/day each', spells: ['fly'] },
      ],
    },
    ...over,
  }
}

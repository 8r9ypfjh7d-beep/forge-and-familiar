import { ABILITIES, type Feat } from '../../types'

// SRD 5.2 (2024) feats. The Ability Score Improvement feat is the builder's "+1/+1" option, so it isn't listed.
const boon = (id: string, name: string, description: string, from = [...ABILITIES]): Feat => ({
  id, name, category: 'epic-boon', minLevel: 19, prerequisite: 'Level 19+',
  description: `+1 to one ability score (up to 30). ${description}`,
  effects: [{ kind: 'abilityChoice', from, max: 30 }],
})

export const FEATS_2024: Feat[] = [
  {
    id: 'alert', name: 'Alert', category: 'origin',
    description: 'Add your proficiency bonus to initiative. Right after rolling initiative you can swap results with a willing ally.',
    effects: [{ kind: 'initiativeProficiency' }],
  },
  {
    id: 'magic-initiate', name: 'Magic Initiate', category: 'origin',
    description: 'Two cantrips and one level 1 spell from the Cleric, Druid or Wizard list. Cast the level 1 spell once per long rest without a slot, or with slots.',
    effects: [],
  },
  {
    id: 'savage-attacker', name: 'Savage Attacker', category: 'origin',
    description: "Once per turn when you hit with a weapon, roll the weapon's damage dice twice and use either roll.",
    effects: [],
  },
  {
    id: 'skilled', name: 'Skilled', category: 'origin',
    description: 'Proficiency in any three skills (or tools: write those in your notes).',
    effects: [{ kind: 'skillPicks', count: 3 }],
  },
  {
    id: 'grappler', name: 'Grappler', category: 'general', minLevel: 4, prerequisite: 'Level 4+, Strength or Dexterity 13+',
    description: '+1 Strength or Dexterity (up to 20). Punch and Grab: damage and grapple with one Unarmed Strike once per turn. Advantage on attacks against a creature you are grappling. Move a grappled creature at no extra cost if it is your size or smaller.',
    effects: [{ kind: 'abilityChoice', from: ['str', 'dex'], max: 20 }],
  },
  {
    id: 'archery', name: 'Archery', category: 'fighting-style', prerequisite: 'Fighting Style feature',
    description: '+2 to attack rolls with ranged weapons.',
    effects: [{ kind: 'rangedAttack', amount: 2 }],
  },
  {
    id: 'defense', name: 'Defense', category: 'fighting-style', prerequisite: 'Fighting Style feature',
    description: '+1 AC while you wear light, medium or heavy armor.',
    effects: [{ kind: 'armoredAc', amount: 1 }],
  },
  {
    id: 'great-weapon-fighting', name: 'Great Weapon Fighting', category: 'fighting-style', prerequisite: 'Fighting Style feature',
    description: 'With a two-handed or versatile melee weapon held in two hands, treat any 1 or 2 on a damage die as a 3.',
    effects: [],
  },
  {
    id: 'two-weapon-fighting', name: 'Two-Weapon Fighting', category: 'fighting-style', prerequisite: 'Fighting Style feature',
    description: "Add your ability modifier to the damage of the extra attack from a Light weapon.",
    effects: [],
  },
  boon('boon-of-combat-prowess', 'Boon of Combat Prowess', 'Once per turn, turn a missed attack into a hit.'),
  boon('boon-of-dimensional-travel', 'Boon of Dimensional Travel', 'After the Attack or Magic action, teleport up to 30 feet.'),
  boon('boon-of-fate', 'Boon of Fate', 'Add or subtract 2d4 from a d20 test you can see; once per initiative roll or rest.'),
  boon('boon-of-irresistible-offense', 'Boon of Irresistible Offense', 'Your bludgeoning, piercing and slashing damage ignores resistance; a natural 20 adds damage equal to the raised score.', ['str', 'dex']),
  boon('boon-of-spell-recall', 'Boon of Spell Recall', 'Once per long rest, cast a level 1–4 spell you have prepared without a slot.', ['int', 'wis', 'cha']),
  boon('boon-of-the-night-spirit', 'Boon of the Night Spirit', 'Become invisible in dim light or darkness as a Bonus Action; resistance to all damage but psychic and radiant while there.'),
  boon('boon-of-truesight', 'Boon of Truesight', 'Truesight out to 60 feet.'),
]

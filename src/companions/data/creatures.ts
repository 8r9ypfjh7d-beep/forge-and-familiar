// SRD 5.1 stat blocks for familiars, beast companions, summons and wild shapes.
import type { Creature, CreatureAction } from '../types'

const ab = (str: number, dex: number, con: number, int: number, wis: number, cha: number) => ({ str, dex, con, int, wis, cha })
const t = (name: string, text: string) => ({ name, text })
const atk = (name: string, toHit: number, damage: string, damageType: string, text?: string): CreatureAction =>
  ({ name, toHit, damage, damageType, text })

const KEEN_SMELL = t('Keen Smell', 'Advantage on Wisdom (Perception) checks that rely on smell.')
const KEEN_HEARING_SMELL = t('Keen Hearing and Smell', 'Advantage on Wisdom (Perception) checks that rely on hearing or smell.')
const PACK_TACTICS = t('Pack Tactics', 'Advantage on an attack roll against a creature if at least one ally is within 5 feet of it and not incapacitated.')
const WATER_BREATHING = t('Water Breathing', 'Can breathe only underwater.')
const AMPHIBIOUS = t('Amphibious', 'Can breathe air and water.')
const SPIDER = [
  t('Spider Climb', 'Can climb difficult surfaces, including upside down on ceilings, without an ability check.'),
  t('Web Sense', 'While in contact with a web, knows the exact location of any other creature in contact with the same web.'),
  t('Web Walker', 'Ignores movement restrictions caused by webbing.'),
]
const MAGIC_RESISTANCE = t('Magic Resistance', 'Advantage on saving throws against spells and other magical effects.')

export const CREATURES: Creature[] = [
  // ---- Find Familiar forms ----
  {
    id: 'bat', name: 'Bat', size: 'Tiny', type: 'beast', cr: 0, ac: 12, hp: 1, hitDice: '1d4−1',
    speed: { walk: 5, fly: 30 }, abilities: ab(2, 15, 8, 2, 12, 4), senses: 'Blindsight 60 ft., passive Perception 11',
    traits: [t('Echolocation', "Can't use its blindsight while deafened."), t('Keen Hearing', 'Advantage on Wisdom (Perception) checks that rely on hearing.')],
    actions: [atk('Bite', 0, '1', 'piercing')], familiar: 'any',
  },
  {
    id: 'cat', name: 'Cat', size: 'Tiny', type: 'beast', cr: 0, ac: 12, hp: 2, hitDice: '1d4',
    speed: { walk: 40, climb: 30 }, abilities: ab(3, 15, 10, 3, 12, 7), skills: 'Perception +3, Stealth +4', senses: 'Passive Perception 13',
    traits: [KEEN_SMELL], actions: [atk('Claws', 0, '1', 'slashing')], familiar: 'any',
  },
  {
    id: 'crab', name: 'Crab', size: 'Tiny', type: 'beast', cr: 0, ac: 11, acNote: 'natural armor', hp: 2, hitDice: '1d4',
    speed: { walk: 20, swim: 20 }, abilities: ab(2, 11, 10, 1, 8, 2), skills: 'Stealth +2', senses: 'Blindsight 30 ft., passive Perception 9',
    traits: [AMPHIBIOUS], actions: [atk('Claw', 0, '1', 'bludgeoning')], familiar: 'any',
  },
  {
    id: 'frog', name: 'Frog', size: 'Tiny', type: 'beast', cr: 0, ac: 11, hp: 1, hitDice: '1d4−1',
    speed: { walk: 20, swim: 20 }, abilities: ab(1, 13, 8, 1, 8, 3), skills: 'Perception +1, Stealth +3', senses: 'Darkvision 30 ft., passive Perception 11',
    traits: [AMPHIBIOUS, t('Standing Leap', 'Long jump up to 10 feet and high jump up to 5 feet, with or without a running start.')],
    actions: [], familiar: 'any',
  },
  {
    id: 'hawk', name: 'Hawk', size: 'Tiny', type: 'beast', cr: 0, ac: 13, hp: 1, hitDice: '1d4−1',
    speed: { walk: 10, fly: 60 }, abilities: ab(5, 16, 8, 2, 14, 6), skills: 'Perception +4', senses: 'Passive Perception 14',
    traits: [t('Keen Sight', 'Advantage on Wisdom (Perception) checks that rely on sight.')],
    actions: [atk('Talons', 5, '1', 'slashing')], familiar: 'any',
  },
  {
    id: 'lizard', name: 'Lizard', size: 'Tiny', type: 'beast', cr: 0, ac: 10, hp: 2, hitDice: '1d4',
    speed: { walk: 20, climb: 20 }, abilities: ab(2, 11, 10, 1, 8, 3), senses: 'Darkvision 30 ft., passive Perception 9',
    traits: [], actions: [atk('Bite', 0, '1', 'piercing')], familiar: 'any',
  },
  {
    id: 'octopus', name: 'Octopus', size: 'Small', type: 'beast', cr: 0, ac: 12, hp: 3, hitDice: '1d6',
    speed: { walk: 5, swim: 30 }, abilities: ab(4, 15, 11, 3, 10, 4), skills: 'Perception +2, Stealth +4', senses: 'Darkvision 30 ft., passive Perception 12',
    traits: [
      t('Hold Breath', 'While out of water, can hold its breath for 30 minutes.'),
      t('Underwater Camouflage', 'Advantage on Dexterity (Stealth) checks made while underwater.'),
      WATER_BREATHING,
    ],
    actions: [
      atk('Tentacles', 4, '1', 'bludgeoning', 'Target is grappled (escape DC 10).'),
      { name: 'Ink Cloud (1/rest)', text: 'Underwater only: 5-foot-radius cloud of ink, heavily obscured for 1 minute; the octopus can then Dash as a bonus action.' },
    ],
    familiar: 'any',
  },
  {
    id: 'owl', name: 'Owl', size: 'Tiny', type: 'beast', cr: 0, ac: 11, hp: 1, hitDice: '1d4−1',
    speed: { walk: 5, fly: 60 }, abilities: ab(3, 13, 8, 2, 12, 7), skills: 'Perception +3, Stealth +3', senses: 'Darkvision 120 ft., passive Perception 13',
    traits: [
      t('Flyby', "Doesn't provoke opportunity attacks when it flies out of an enemy's reach."),
      t('Keen Hearing and Sight', 'Advantage on Wisdom (Perception) checks that rely on hearing or sight.'),
    ],
    actions: [atk('Talons', 3, '1', 'slashing')], familiar: 'any',
  },
  {
    id: 'poisonous-snake', name: 'Poisonous Snake', size: 'Tiny', type: 'beast', cr: 0.125, ac: 13, hp: 2, hitDice: '1d4',
    speed: { walk: 30, swim: 30 }, abilities: ab(2, 16, 11, 1, 10, 3), senses: 'Blindsight 10 ft., passive Perception 10',
    traits: [], actions: [atk('Bite', 5, '1', 'piercing', 'DC 10 Con save: 2d4 poison damage on a failure, half on a success.')], familiar: 'any',
  },
  {
    id: 'quipper', name: 'Fish (Quipper)', size: 'Tiny', type: 'beast', cr: 0, ac: 13, hp: 1, hitDice: '1d4−1',
    speed: { walk: 0, swim: 40 }, abilities: ab(2, 16, 9, 1, 7, 2), senses: 'Darkvision 60 ft., passive Perception 8',
    traits: [t('Blood Frenzy', 'Advantage on melee attacks against any creature that is not at full HP.'), WATER_BREATHING],
    actions: [atk('Bite', 5, '1', 'piercing')], familiar: 'any',
  },
  {
    id: 'rat', name: 'Rat', size: 'Tiny', type: 'beast', cr: 0, ac: 10, hp: 1, hitDice: '1d4−1',
    speed: { walk: 20 }, abilities: ab(2, 11, 9, 2, 10, 4), senses: 'Darkvision 30 ft., passive Perception 10',
    traits: [KEEN_SMELL], actions: [atk('Bite', 0, '1', 'piercing')], familiar: 'any',
  },
  {
    id: 'raven', name: 'Raven', size: 'Tiny', type: 'beast', cr: 0, ac: 12, hp: 1, hitDice: '1d4−1',
    speed: { walk: 10, fly: 50 }, abilities: ab(2, 14, 8, 2, 12, 6), skills: 'Perception +3', senses: 'Passive Perception 13',
    traits: [t('Mimicry', 'Can mimic simple sounds it has heard. A DC 10 Wisdom (Insight) check spots the imitation.')],
    actions: [atk('Beak', 4, '1', 'piercing')], familiar: 'any',
  },
  {
    id: 'sea-horse', name: 'Sea Horse', size: 'Tiny', type: 'beast', cr: 0, ac: 11, hp: 1, hitDice: '1d4−1',
    speed: { walk: 0, swim: 20 }, abilities: ab(1, 12, 8, 1, 10, 2), senses: 'Passive Perception 10',
    traits: [WATER_BREATHING], actions: [], familiar: 'any',
  },
  {
    id: 'spider', name: 'Spider', size: 'Tiny', type: 'beast', cr: 0, ac: 12, hp: 1, hitDice: '1d4−1',
    speed: { walk: 20, climb: 20 }, abilities: ab(2, 14, 8, 1, 10, 2), skills: 'Stealth +4', senses: 'Darkvision 30 ft., passive Perception 10',
    traits: SPIDER, actions: [atk('Bite', 4, '1', 'piercing', 'DC 9 Con save or take 1d4 poison damage.')], familiar: 'any',
  },
  {
    id: 'weasel', name: 'Weasel', size: 'Tiny', type: 'beast', cr: 0, ac: 13, hp: 1, hitDice: '1d4−1',
    speed: { walk: 30 }, abilities: ab(3, 16, 8, 2, 12, 3), skills: 'Perception +3, Stealth +5', senses: 'Passive Perception 13',
    traits: [KEEN_HEARING_SMELL], actions: [atk('Bite', 5, '1', 'piercing')], familiar: 'any',
  },
  // ---- Pact of the Chain extras ----
  {
    id: 'imp', name: 'Imp', size: 'Tiny', type: 'fiend (devil)', cr: 1, ac: 13, hp: 10, hitDice: '3d4+3',
    speed: { walk: 20, fly: 40 }, abilities: ab(6, 17, 13, 11, 12, 14), skills: 'Deception +4, Insight +3, Persuasion +4, Stealth +5',
    senses: 'Darkvision 120 ft., passive Perception 11. Resists cold and nonmagical, non-silvered weapons; immune to fire and poison.',
    traits: [
      t('Shapechanger', 'Can use its action to become a rat, raven or spider, or back. Its statistics stay the same except speed.'),
      t("Devil's Sight", "Magical darkness doesn't impede its darkvision."),
      MAGIC_RESISTANCE,
    ],
    actions: [
      atk('Sting', 5, '1d4+3', 'piercing', 'DC 11 Con save: 3d6 poison damage on a failure, half on a success. (Bite in beast form.)'),
      { name: 'Invisibility', text: 'Turns invisible until it attacks or its concentration ends.' },
    ],
    familiar: 'chain',
  },
  {
    id: 'pseudodragon', name: 'Pseudodragon', size: 'Tiny', type: 'dragon', cr: 0.25, ac: 13, acNote: 'natural armor', hp: 7, hitDice: '2d4+2',
    speed: { walk: 15, fly: 60 }, abilities: ab(6, 15, 13, 10, 12, 10), skills: 'Perception +3, Stealth +4',
    senses: 'Blindsight 10 ft., darkvision 60 ft., passive Perception 13',
    traits: [
      t('Keen Senses', 'Advantage on Wisdom (Perception) checks that rely on sight, hearing or smell.'),
      MAGIC_RESISTANCE,
      t('Limited Telepathy', 'Can magically share simple ideas, emotions and images with a creature within 100 feet that understands a language.'),
    ],
    actions: [
      atk('Bite', 4, '1d4+2', 'piercing'),
      atk('Sting', 4, '1d4+2', 'piercing', 'DC 11 Con save or poisoned for 1 hour; failing by 5 or more also leaves it unconscious.'),
    ],
    familiar: 'chain',
  },
  {
    id: 'quasit', name: 'Quasit', size: 'Tiny', type: 'fiend (demon)', cr: 1, ac: 13, hp: 7, hitDice: '3d4',
    speed: { walk: 40 }, abilities: ab(5, 17, 10, 7, 10, 10), skills: 'Stealth +5',
    senses: 'Darkvision 120 ft., passive Perception 10. Resists cold, fire, lightning and nonmagical weapons; immune to poison.',
    traits: [
      t('Shapechanger', 'Can use its action to become a bat, centipede or toad, or back.'),
      MAGIC_RESISTANCE,
    ],
    actions: [
      atk('Claws', 4, '1d4+3', 'piercing', 'DC 10 Con save or take 2d4 poison damage and be poisoned for 1 minute. (Bite in beast form.)'),
      { name: 'Scare (1/day)', text: 'One creature within 20 feet: DC 10 Wis save or frightened for 1 minute.' },
      { name: 'Invisibility', text: 'Turns invisible until it attacks, uses Scare, or its concentration ends.' },
    ],
    familiar: 'chain',
  },
  {
    id: 'sprite', name: 'Sprite', size: 'Tiny', type: 'fey', cr: 0.25, ac: 15, acNote: 'leather armor', hp: 2, hitDice: '1d4',
    speed: { walk: 10, fly: 40 }, abilities: ab(3, 18, 10, 14, 13, 11), skills: 'Perception +3, Stealth +8', senses: 'Passive Perception 13',
    traits: [],
    actions: [
      atk('Longsword', 2, '1', 'slashing'),
      atk('Shortbow', 6, '1', 'piercing', 'Range 40/160. DC 10 Con save or poisoned for 1 minute; failing by 5 or more also leaves it unconscious.'),
      { name: 'Heart Sight', text: "Touch a creature to learn its emotional state and alignment (DC 10 Cha save resists; celestials, fiends and undead fail)." },
      { name: 'Invisibility', text: 'Turns invisible until it attacks or casts a spell, or its concentration ends.' },
    ],
    familiar: 'chain',
  },
  // ---- Beasts for companions, summons and wild shape ----
  {
    id: 'mastiff', name: 'Mastiff', size: 'Medium', type: 'beast', cr: 0.125, ac: 12, hp: 5, hitDice: '1d8+1',
    speed: { walk: 40 }, abilities: ab(13, 14, 12, 3, 12, 7), skills: 'Perception +3', senses: 'Passive Perception 13',
    traits: [KEEN_HEARING_SMELL], actions: [atk('Bite', 3, '1d6+1', 'piercing', 'DC 11 Str save or knocked prone.')],
  },
  {
    id: 'wolf', name: 'Wolf', size: 'Medium', type: 'beast', cr: 0.25, ac: 13, acNote: 'natural armor', hp: 11, hitDice: '2d8+2',
    speed: { walk: 40 }, abilities: ab(12, 15, 12, 3, 12, 6), skills: 'Perception +3, Stealth +4', senses: 'Passive Perception 13',
    traits: [KEEN_HEARING_SMELL, PACK_TACTICS], actions: [atk('Bite', 4, '2d4+2', 'piercing', 'DC 11 Str save or knocked prone.')],
  },
  {
    id: 'panther', name: 'Panther', size: 'Medium', type: 'beast', cr: 0.25, ac: 12, hp: 13, hitDice: '3d8',
    speed: { walk: 50, climb: 40 }, abilities: ab(14, 15, 10, 3, 14, 7), skills: 'Perception +4, Stealth +6', senses: 'Passive Perception 14',
    traits: [KEEN_SMELL, t('Pounce', 'After moving 20 feet straight and hitting with a claw: DC 12 Str save or prone, then a bite as a bonus action.')],
    actions: [atk('Bite', 4, '1d6+2', 'piercing'), atk('Claw', 4, '1d4+2', 'slashing')],
  },
  {
    id: 'boar', name: 'Boar', size: 'Medium', type: 'beast', cr: 0.25, ac: 11, acNote: 'natural armor', hp: 11, hitDice: '2d8+2',
    speed: { walk: 40 }, abilities: ab(13, 11, 12, 2, 9, 5), senses: 'Passive Perception 9',
    traits: [
      t('Charge', 'After moving 20 feet straight and hitting with its tusk: extra 1d6 slashing and DC 11 Str save or prone.'),
      t('Relentless (1/rest)', 'If it takes 7 damage or less that would drop it to 0 HP, it drops to 1 HP instead.'),
    ],
    actions: [atk('Tusk', 3, '1d6+1', 'slashing')],
  },
  {
    id: 'giant-poisonous-snake', name: 'Giant Poisonous Snake', size: 'Medium', type: 'beast', cr: 0.25, ac: 14, hp: 11, hitDice: '2d8+2',
    speed: { walk: 30, swim: 30 }, abilities: ab(10, 18, 13, 2, 10, 3), skills: 'Perception +2', senses: 'Blindsight 10 ft., passive Perception 12',
    traits: [], actions: [atk('Bite', 6, '1d4+4', 'piercing', 'Reach 10 ft. DC 11 Con save: 3d6 poison damage on a failure, half on a success.')],
  },
  {
    id: 'riding-horse', name: 'Riding Horse', size: 'Large', type: 'beast', cr: 0.25, ac: 10, hp: 13, hitDice: '2d10+2',
    speed: { walk: 60 }, abilities: ab(16, 10, 12, 2, 11, 7), senses: 'Passive Perception 10',
    traits: [], actions: [atk('Hooves', 5, '2d4+3', 'bludgeoning')],
  },
  {
    id: 'giant-badger', name: 'Giant Badger', size: 'Medium', type: 'beast', cr: 0.25, ac: 10, hp: 13, hitDice: '2d8+4',
    speed: { walk: 30, burrow: 10 }, abilities: ab(13, 10, 15, 2, 12, 5), senses: 'Darkvision 30 ft., passive Perception 11',
    traits: [KEEN_SMELL],
    actions: [{ name: 'Multiattack', text: 'One bite and one claws attack.' }, atk('Bite', 3, '1d6+1', 'piercing'), atk('Claws', 3, '2d4+1', 'slashing')],
  },
  {
    id: 'ape', name: 'Ape', size: 'Medium', type: 'beast', cr: 0.5, ac: 12, hp: 19, hitDice: '3d8+6',
    speed: { walk: 30, climb: 30 }, abilities: ab(16, 14, 14, 6, 12, 7), skills: 'Athletics +5, Perception +3', senses: 'Passive Perception 13',
    traits: [],
    actions: [{ name: 'Multiattack', text: 'Two fist attacks.' }, atk('Fist', 5, '1d6+3', 'bludgeoning'), atk('Rock', 5, '1d6+3', 'bludgeoning', 'Range 25/50 ft.')],
  },
  {
    id: 'black-bear', name: 'Black Bear', size: 'Medium', type: 'beast', cr: 0.5, ac: 11, acNote: 'natural armor', hp: 19, hitDice: '3d8+6',
    speed: { walk: 40, climb: 30 }, abilities: ab(15, 10, 14, 2, 12, 7), skills: 'Perception +3', senses: 'Passive Perception 13',
    traits: [KEEN_SMELL],
    actions: [{ name: 'Multiattack', text: 'One bite and one claws attack.' }, atk('Bite', 3, '1d6+2', 'piercing'), atk('Claws', 3, '2d4+2', 'slashing')],
  },
  {
    id: 'crocodile', name: 'Crocodile', size: 'Large', type: 'beast', cr: 0.5, ac: 12, acNote: 'natural armor', hp: 19, hitDice: '3d10+3',
    speed: { walk: 20, swim: 30 }, abilities: ab(15, 10, 13, 2, 10, 5), skills: 'Stealth +2', senses: 'Passive Perception 10',
    traits: [t('Hold Breath', 'Can hold its breath for 15 minutes.')],
    actions: [atk('Bite', 4, '1d10+2', 'piercing', 'Target is grappled (escape DC 12) and restrained; the crocodile can bite no one else.')],
  },
  {
    id: 'reef-shark', name: 'Reef Shark', size: 'Medium', type: 'beast', cr: 0.5, ac: 12, acNote: 'natural armor', hp: 22, hitDice: '4d8+4',
    speed: { walk: 0, swim: 40 }, abilities: ab(14, 13, 13, 1, 10, 4), skills: 'Perception +2', senses: 'Blindsight 30 ft., passive Perception 12',
    traits: [PACK_TACTICS, WATER_BREATHING], actions: [atk('Bite', 4, '1d8+2', 'piercing')],
  },
  {
    id: 'brown-bear', name: 'Brown Bear', size: 'Large', type: 'beast', cr: 1, ac: 11, acNote: 'natural armor', hp: 34, hitDice: '4d10+12',
    speed: { walk: 40, climb: 30 }, abilities: ab(19, 10, 16, 2, 13, 7), skills: 'Perception +3', senses: 'Passive Perception 13',
    traits: [KEEN_SMELL],
    actions: [{ name: 'Multiattack', text: 'One bite and one claws attack.' }, atk('Bite', 6, '1d8+4', 'piercing'), atk('Claws', 6, '2d6+4', 'slashing')],
  },
  {
    id: 'dire-wolf', name: 'Dire Wolf', size: 'Large', type: 'beast', cr: 1, ac: 14, acNote: 'natural armor', hp: 37, hitDice: '5d10+10',
    speed: { walk: 50 }, abilities: ab(17, 15, 15, 3, 12, 7), skills: 'Perception +3, Stealth +4', senses: 'Passive Perception 13',
    traits: [KEEN_HEARING_SMELL, PACK_TACTICS], actions: [atk('Bite', 5, '2d6+3', 'piercing', 'DC 13 Str save or knocked prone.')],
  },
  {
    id: 'giant-spider', name: 'Giant Spider', size: 'Large', type: 'beast', cr: 1, ac: 14, acNote: 'natural armor', hp: 26, hitDice: '4d10+4',
    speed: { walk: 30, climb: 30 }, abilities: ab(14, 16, 12, 2, 11, 4), skills: 'Stealth +7', senses: 'Blindsight 10 ft., darkvision 60 ft., passive Perception 10',
    traits: SPIDER,
    actions: [
      atk('Bite', 5, '1d8+3', 'piercing', 'DC 11 Con save: 2d8 poison damage on a failure, half on a success. At 0 HP from this, the target is stable but poisoned and paralyzed for 1 hour.'),
      { name: 'Web (Recharge 5–6)', toHit: 5, text: 'Range 30/60 ft. Target is restrained by webbing (DC 12 Str to escape; the web has AC 10, 5 HP).' },
    ],
  },
  {
    id: 'giant-eagle', name: 'Giant Eagle', size: 'Large', type: 'beast', cr: 1, ac: 13, hp: 26, hitDice: '4d10+4',
    speed: { walk: 10, fly: 80 }, abilities: ab(16, 17, 13, 8, 14, 10), skills: 'Perception +4', senses: 'Passive Perception 14',
    traits: [t('Keen Sight', 'Advantage on Wisdom (Perception) checks that rely on sight.')],
    actions: [{ name: 'Multiattack', text: 'One beak and one talons attack.' }, atk('Beak', 5, '1d6+3', 'piercing'), atk('Talons', 5, '2d6+3', 'slashing')],
  },
]

export const creatureById = (id: string) => CREATURES.find(c => c.id === id)

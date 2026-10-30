import { CASTERS, CASTERS_2024, CASTERS_REWRITTEN } from './casters'
import { MARTIAL, MARTIAL_2024, MARTIAL_REWRITTEN } from './martial'
import { PHB, PHB24, SCAG, TCE, VRGR, XGE, f, fullSpells as pactSpells, legacy, long, short, spells, type Def } from './helpers'

// Subclasses from the official books outside the SRD. Only names, levels and mechanics live here: what each
// feature does is a short original summary in src/i18n/locales/explain.books.*.ts (never rulebook text).

// ---------- Warlock patrons, 2014 rules (chosen at level 1) ----------

const GENIE_KINDS: { id: string; kind: string; damage: string; spells: string[] }[] = [
  { id: 'dao', kind: 'Dao', damage: 'bludgeoning', spells: ['Sanctuary', 'Spike Growth', 'Meld into Stone', 'Stone Shape', 'Wall of Stone'] },
  { id: 'djinni', kind: 'Djinni', damage: 'thunder', spells: ['Thunderwave', 'Gust of Wind', 'Wind Wall', 'Greater Invisibility', 'Seeming'] },
  { id: 'efreeti', kind: 'Efreeti', damage: 'fire', spells: ['Burning Hands', 'Scorching Ray', 'Fireball', 'Fire Shield', 'Flame Strike'] },
  { id: 'marid', kind: 'Marid', damage: 'cold', spells: ['Fog Cloud', 'Blur', 'Sleet Storm', 'Control Water', 'Cone of Cold'] },
]
const GENIE_BASE = ['Detect Evil and Good', 'Phantasmal Force', 'Create Food and Water', 'Phantasmal Killer', 'Creation']

const PATRONS: Def[] = [
  {
    id: 'archfey', classId: 'warlock', name: 'The Archfey', source: PHB,
    spells: pactSpells(['Faerie Fire', 'Sleep'], ['Calm Emotions', 'Phantasmal Force'], ['Blink', 'Plant Growth'], ['Dominate Beast', 'Greater Invisibility'], ['Dominate Person', 'Seeming']),
    features: [
      f(1, 'Archfey Spells'), f(1, 'Fey Presence', short()), f(6, 'Misty Escape', short()),
      f(10, 'Beguiling Defenses', { effects: [{ kind: 'conditionImmunity', condition: 'charmed' }] }), f(14, 'Dark Delirium', short()),
    ],
  },
  {
    id: 'great-old-one', classId: 'warlock', name: 'The Great Old One', source: PHB,
    spells: pactSpells(['Dissonant Whispers', 'Hideous Laughter'], ['Detect Thoughts', 'Phantasmal Force'], ['Clairvoyance', 'Sending'], ['Dominate Beast', 'Black Tentacles'], ['Dominate Person', 'Telekinesis']),
    features: [
      f(1, 'Great Old One Spells'), f(1, 'Awakened Mind'), f(6, 'Entropic Ward', short()),
      f(10, 'Thought Shield', { effects: [{ kind: 'resistance', damage: 'psychic' }] }), f(14, 'Create Thrall'),
    ],
  },
  {
    id: 'celestial', classId: 'warlock', name: 'The Celestial', source: XGE,
    spells: [{ level: 1, names: ['Light', 'Sacred Flame'] }, ...pactSpells(['Cure Wounds', 'Guiding Bolt'], ['Flaming Sphere', 'Lesser Restoration'], ['Daylight', 'Revivify'], ['Guardian of Faith', 'Wall of Fire'], ['Flame Strike', 'Greater Restoration'])],
    features: [
      f(1, 'Celestial Spells'), f(1, 'Bonus Cantrips'), f(1, 'Healing Light', { uses: { count: 'level', add: 1, recharge: 'long' } }),
      f(6, 'Radiant Soul', { effects: [{ kind: 'resistance', damage: 'radiant' }] }), f(10, 'Celestial Resilience'), f(14, 'Searing Vengeance', long()),
    ],
  },
  {
    id: 'hexblade', classId: 'warlock', name: 'The Hexblade', source: XGE, armor: ['medium', 'shield'], weapons: ['martial'], castingWeapon: true,
    spells: pactSpells(['Shield', 'Wrathful Smite'], ['Blur', 'Branding Smite'], ['Blink', 'Elemental Weapon'], ['Phantasmal Killer', 'Staggering Smite'], ['Banishing Smite', 'Cone of Cold']),
    features: [
      f(1, 'Hexblade Spells'), f(1, "Hexblade's Curse", short()), f(1, 'Hex Warrior'), f(6, 'Accursed Specter', long()),
      f(10, 'Armor of Hexes'), f(14, 'Master of Hexes'),
    ],
  },
  {
    id: 'fathomless', classId: 'warlock', name: 'The Fathomless', source: TCE,
    spells: pactSpells(['Create or Destroy Water', 'Thunderwave'], ['Gust of Wind', 'Silence'], ['Lightning Bolt', 'Sleet Storm'], ['Control Water', 'Summon Elemental'], ['Arcane Hand', 'Cone of Cold']),
    features: [
      f(1, 'Fathomless Spells'), f(1, 'Tentacle of the Deeps', long('pb')), f(1, 'Gift of the Sea', { effects: [{ kind: 'moveSpeed', mode: 'swim', value: 40 }] }),
      f(6, 'Oceanic Soul', { effects: [{ kind: 'resistance', damage: 'cold' }] }), f(6, 'Guardian Coil'), f(10, 'Grasping Tentacles', long()),
      f(14, 'Fathomless Plunge', short()),
    ],
  },
  ...GENIE_KINDS.map((g): Def => ({
    id: `genie-${g.id}`, classId: 'warlock', name: `The Genie (${g.kind})`, source: TCE,
    spells: pactSpells(...GENIE_BASE.map((s, i) => [s, g.spells[i]])),
    features: [
      f(1, 'Genie Spells'), f(1, "Genie's Vessel"), f(1, 'Bottled Respite', long()), f(1, "Genie's Wrath"),
      f(6, 'Elemental Gift', { ...long('pb'), effects: [{ kind: 'resistance', damage: g.damage }] }), f(10, 'Sanctuary Vessel'), f(14, 'Limited Wish', long()),
    ],
  })),
  {
    id: 'undying', classId: 'warlock', name: 'The Undying', source: SCAG,
    spells: [{ level: 1, names: ['Spare the Dying'] }, ...pactSpells(['False Life', 'Ray of Sickness'], ['Blindness/Deafness', 'Silence'], ['Feign Death', 'Speak with Dead'], ['Aura of Life', 'Death Ward'], ['Contagion', 'Legend Lore'])],
    features: [
      f(1, 'Undying Spells'), f(1, 'Among the Dead', { effects: [{ kind: 'advantage', on: 'saves', when: 'against disease' }] }),
      f(6, 'Defy Death', long()), f(10, 'Undying Nature'), f(14, 'Indestructible Life', short()),
    ],
  },
  {
    id: 'undead', classId: 'warlock', name: 'The Undead', source: VRGR,
    spells: pactSpells(['Bane', 'False Life'], ['Blindness/Deafness', 'Phantasmal Force'], ['Phantom Steed', 'Speak with Dead'], ['Death Ward', 'Greater Invisibility'], ['Antilife Shell', 'Cloudkill']),
    features: [
      f(1, 'Undead Spells'), f(1, 'Form of Dread', long('pb')), f(6, 'Grave Touched'),
      f(10, 'Necrotic Husk', { ...long(), effects: [{ kind: 'resistance', damage: 'necrotic' }] }), f(14, 'Spirit Projection', long()),
    ],
  },
]

// ---------- Warlock patrons, 2024 rules (chosen at level 3) ----------

const PATRONS_2024: Def[] = [
  {
    id: 'archfey-patron', classId: 'warlock', name: 'Archfey Patron', source: PHB24,
    spells: spells([3, 'Calm Emotions', 'Faerie Fire', 'Misty Step', 'Phantasmal Force', 'Sleep'], [5, 'Blink', 'Plant Growth'], [7, 'Dominate Beast', 'Greater Invisibility'], [9, 'Dominate Person', 'Seeming']),
    features: [
      f(3, 'Archfey Spells'), f(3, 'Steps of the Fey', long('cha')), f(6, 'Misty Escape'),
      f(10, 'Beguiling Defenses', { ...long(), effects: [{ kind: 'conditionImmunity', condition: 'charmed' }] }), f(14, 'Bewitching Magic'),
    ],
  },
  {
    id: 'celestial-patron', classId: 'warlock', name: 'Celestial Patron', source: PHB24,
    spells: spells([3, 'Aid', 'Cure Wounds', 'Guiding Bolt', 'Lesser Restoration', 'Light', 'Sacred Flame'], [5, 'Daylight', 'Revivify'], [7, 'Guardian of Faith', 'Wall of Fire'], [9, 'Greater Restoration', 'Summon Celestial']),
    features: [
      f(3, 'Celestial Spells'), f(3, 'Healing Light', { uses: { count: 'level', add: 1, recharge: 'long' } }),
      f(6, 'Radiant Soul', { effects: [{ kind: 'resistance', damage: 'radiant' }] }), f(10, 'Celestial Resilience'), f(14, 'Searing Vengeance', long()),
    ],
  },
  {
    id: 'great-old-one-patron', classId: 'warlock', name: 'Great Old One Patron', source: PHB24,
    spells: spells([3, 'Detect Thoughts', 'Dissonant Whispers', 'Phantasmal Force', 'Hideous Laughter'], [5, 'Clairvoyance', 'Hunger of Hadar'], [7, 'Confusion', 'Summon Aberration'], [9, 'Modify Memory', 'Telekinesis']),
    features: [
      f(3, 'Great Old One Spells'), f(3, 'Awakened Mind'), f(3, 'Psychic Spells'), f(6, 'Clairvoyant Combatant', short()),
      f(10, 'Eldritch Hex'), f(10, 'Thought Shield', { effects: [{ kind: 'resistance', damage: 'psychic' }] }), f(14, 'Create Thrall'),
    ],
  },
]

/** 2014 patrons with no 2024 rewrite: offered in 2024 too, as the 2024 book allows. */
const LEGACY_PATRONS = PATRONS.filter(p => !['archfey', 'great-old-one', 'celestial'].includes(p.id)).map(p => legacy(p, 3))

const REWRITTEN = new Set([...MARTIAL_REWRITTEN, ...CASTERS_REWRITTEN])
const OTHERS = [...MARTIAL, ...CASTERS]
const byClass = (a: Def, b: Def) => a.classId.localeCompare(b.classId)

/** Every book subclass for 2014 rules, grouped by class. */
export const BOOK_SUBCLASSES: Def[] = [...OTHERS, ...PATRONS].sort(byClass)
/** 2024 rules: the 2024 book's subclasses, then 2014 ones it didn't rewrite (features move to level 3). */
export const BOOK_SUBCLASSES_2024: Def[] = [
  ...MARTIAL_2024, ...CASTERS_2024, ...OTHERS.filter(d => !REWRITTEN.has(d.id)).map(d => legacy(d)), ...PATRONS_2024, ...LEGACY_PATRONS,
].sort(byClass)

import type { RulesEdition, SubclassData } from '../types'
import { FAERUN_RENAMED } from './books/faerun'
import { BOOK_SUBCLASSES, BOOK_SUBCLASSES_2024 } from './books/subclasses'
import { SUBCLASSES_2024 } from './srd52/subclasses'

/** Subclass with the mechanics the engine applies (see SubclassData). */
export interface SubclassDef extends SubclassData {
  id: string
}

/** Id of the subclass a player builds themselves; its data is saved in Character.customSubclasses. */
export const CUSTOM_SUBCLASS = 'custom'

// SRD 5.1 includes one subclass per class.
export const SUBCLASSES: SubclassDef[] = [
  { id: 'berserker', classId: 'barbarian', name: 'Path of the Berserker', features: [{ level: 3, name: 'Frenzy' }, { level: 6, name: 'Mindless Rage' }, { level: 10, name: 'Intimidating Presence' }, { level: 14, name: 'Retaliation' }] },
  { id: 'lore', classId: 'bard', name: 'College of Lore', features: [{ level: 3, name: 'Bonus Proficiencies' }, { level: 3, name: 'Cutting Words' }, { level: 6, name: 'Additional Magic Secrets' }, { level: 14, name: 'Peerless Skill' }] },
  { id: 'life', classId: 'cleric', name: 'Life Domain', armor: ['heavy'], features: [{ level: 1, name: 'Bonus Proficiency' }, { level: 1, name: 'Disciple of Life' }, { level: 2, name: 'Channel Divinity: Preserve Life' }, { level: 6, name: 'Blessed Healer' }, { level: 8, name: 'Divine Strike' }, { level: 17, name: 'Supreme Healing' }],
    spells: [[1, 'Bless', 'Cure Wounds'], [3, 'Lesser Restoration', 'Spiritual Weapon'], [5, 'Beacon of Hope', 'Revivify'], [7, 'Death Ward', 'Guardian of Faith'], [9, 'Mass Cure Wounds', 'Raise Dead']].map(([level, ...names]) => ({ level: level as number, names: names as string[] })) },
  { id: 'land', classId: 'druid', name: 'Circle of the Land', features: [{ level: 2, name: 'Bonus Cantrip' }, { level: 2, name: 'Natural Recovery', uses: { count: 1, recharge: 'long' } }, { level: 3, name: 'Circle Spells' }, { level: 6, name: "Land's Stride" }, { level: 10, name: "Nature's Ward" }, { level: 14, name: "Nature's Sanctuary" }] },
  { id: 'champion', classId: 'fighter', name: 'Champion', features: [{ level: 3, name: 'Improved Critical' }, { level: 7, name: 'Remarkable Athlete' }, { level: 10, name: 'Additional Fighting Style' }, { level: 15, name: 'Superior Critical' }, { level: 18, name: 'Survivor' }] },
  { id: 'open-hand', classId: 'monk', name: 'Way of the Open Hand', features: [{ level: 3, name: 'Open Hand Technique' }, { level: 6, name: 'Wholeness of Body' }, { level: 11, name: 'Tranquility' }, { level: 17, name: 'Quivering Palm' }] },
  { id: 'devotion', classId: 'paladin', name: 'Oath of Devotion', features: [{ level: 3, name: 'Oath Spells' }, { level: 3, name: 'Sacred Weapon' }, { level: 3, name: 'Turn the Unholy' }, { level: 7, name: 'Aura of Devotion' }, { level: 15, name: 'Purity of Spirit' }, { level: 20, name: 'Holy Nimbus' }],
    spells: [[3, 'Protection from Evil and Good', 'Sanctuary'], [5, 'Lesser Restoration', 'Zone of Truth'], [9, 'Beacon of Hope', 'Dispel Magic'], [13, 'Freedom of Movement', 'Guardian of Faith'], [17, 'Commune', 'Flame Strike']].map(([level, ...names]) => ({ level: level as number, names: names as string[] })) },
  { id: 'hunter', classId: 'ranger', name: 'Hunter', features: [{ level: 3, name: "Hunter's Prey" }, { level: 7, name: 'Defensive Tactics' }, { level: 11, name: 'Multiattack' }, { level: 15, name: "Superior Hunter's Defense" }] },
  { id: 'thief', classId: 'rogue', name: 'Thief', features: [{ level: 3, name: 'Fast Hands' }, { level: 3, name: 'Second-Story Work' }, { level: 9, name: 'Supreme Sneak' }, { level: 13, name: 'Use Magic Device' }, { level: 17, name: "Thief's Reflexes" }] },
  { id: 'draconic', classId: 'sorcerer', name: 'Draconic Bloodline', hpPerLevel: 1, unarmoredBase: 13, features: [{ level: 1, name: 'Dragon Ancestor' }, { level: 1, name: 'Draconic Resilience' }, { level: 6, name: 'Elemental Affinity' }, { level: 14, name: 'Dragon Wings' }, { level: 18, name: 'Draconic Presence' }] },
  {
    id: 'fiend', classId: 'warlock', name: 'The Fiend',
    features: [{ level: 1, name: "Dark One's Blessing" }, { level: 6, name: "Dark One's Own Luck", uses: { count: 1, recharge: 'short' } }, { level: 10, name: 'Fiendish Resilience' }, { level: 14, name: 'Hurl Through Hell', uses: { count: 1, recharge: 'long' } }],
    spells: [[1, 'Burning Hands', 'Command'], [3, 'Blindness/Deafness', 'Scorching Ray'], [5, 'Fireball', 'Stinking Cloud'], [7, 'Fire Shield', 'Wall of Fire'], [9, 'Flame Strike', 'Hallow']].map(([level, ...names]) => ({ level: level as number, names: names as string[] })),
  },
  { id: 'evocation', classId: 'wizard', name: 'School of Evocation', features: [{ level: 2, name: 'Evocation Savant' }, { level: 2, name: 'Sculpt Spells' }, { level: 6, name: 'Potent Cantrip' }, { level: 10, name: 'Empowered Evocation' }, { level: 14, name: 'Overchannel' }] },
]

// Homebrew subclasses registered at runtime (ids namespaced `hb:<packId>:<slug>`).
let homebrew: SubclassDef[] = []

/** Replace the registered homebrew subclasses. SRD ids always win. */
export function registerHomebrewSubclasses(list: SubclassDef[]): void {
  const srd = new Set([...SUBCLASSES, ...SUBCLASSES_2024, ...BOOK_SUBCLASSES, ...BOOK_SUBCLASSES_2024, { id: CUSTOM_SUBCLASS }].map(s => s.id))
  homebrew = list.filter(s => !srd.has(s.id))
}

const srdFor = (edition: RulesEdition) => (edition === '2024' ? [...SUBCLASSES_2024, ...BOOK_SUBCLASSES_2024] : [...SUBCLASSES, ...BOOK_SUBCLASSES])

/** SRD subclasses of the edition, then the ones from the other official books, then homebrew ones (offered in both editions). */
export const subclassesFor = (classId: string, edition: RulesEdition = '2014'): SubclassDef[] =>
  [...srdFor(edition), ...homebrew].filter(s => s.classId === classId)

/** Old saved subclass ids and the ids that replaced them, per edition. */
const RENAMED: Record<RulesEdition, Record<string, string>> = { '2014': {}, '2024': FAERUN_RENAMED }

/** A saved subclass id as it is called today (Bladesinging is Bladesinger in 2024). Unknown ids come back unchanged. */
export const currentSubclassId = (id: string, edition: RulesEdition = '2014'): string => RENAMED[edition][id] ?? id

export const subclassById = (id: string, edition: RulesEdition = '2014'): SubclassDef | undefined => {
  const now = currentSubclassId(id, edition)
  return srdFor(edition).find(s => s.id === now) ?? homebrew.find(s => s.id === now)
}

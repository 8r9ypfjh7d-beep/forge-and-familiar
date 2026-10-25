import type { ArmorCategory, Subclass } from '../types'

/** Subclass with the few mechanics the engine applies. */
export interface SubclassDef extends Subclass {
  /** Armor proficiencies the subclass adds (Life Domain: heavy). */
  armor?: ArmorCategory[]
  /** Extra max HP per level in this class (Draconic Resilience). */
  hpPerLevel?: number
  /** Unarmored AC base before DEX (Draconic Resilience: 13). */
  unarmoredBase?: number
}

// SRD 5.1 includes one subclass per class.
export const SUBCLASSES: SubclassDef[] = [
  { id: 'berserker', classId: 'barbarian', name: 'Path of the Berserker', features: [{ level: 3, name: 'Frenzy' }, { level: 6, name: 'Mindless Rage' }, { level: 10, name: 'Intimidating Presence' }, { level: 14, name: 'Retaliation' }] },
  { id: 'lore', classId: 'bard', name: 'College of Lore', features: [{ level: 3, name: 'Bonus Proficiencies' }, { level: 3, name: 'Cutting Words' }, { level: 6, name: 'Additional Magic Secrets' }, { level: 14, name: 'Peerless Skill' }] },
  { id: 'life', classId: 'cleric', name: 'Life Domain', armor: ['heavy'], features: [{ level: 1, name: 'Bonus Proficiency' }, { level: 1, name: 'Disciple of Life' }, { level: 2, name: 'Channel Divinity: Preserve Life' }, { level: 6, name: 'Blessed Healer' }, { level: 8, name: 'Divine Strike' }, { level: 17, name: 'Supreme Healing' }] },
  { id: 'land', classId: 'druid', name: 'Circle of the Land', features: [{ level: 2, name: 'Bonus Cantrip' }, { level: 2, name: 'Natural Recovery' }, { level: 3, name: 'Circle Spells' }, { level: 6, name: "Land's Stride" }, { level: 10, name: "Nature's Ward" }, { level: 14, name: "Nature's Sanctuary" }] },
  { id: 'champion', classId: 'fighter', name: 'Champion', features: [{ level: 3, name: 'Improved Critical' }, { level: 7, name: 'Remarkable Athlete' }, { level: 10, name: 'Additional Fighting Style' }, { level: 15, name: 'Superior Critical' }, { level: 18, name: 'Survivor' }] },
  { id: 'open-hand', classId: 'monk', name: 'Way of the Open Hand', features: [{ level: 3, name: 'Open Hand Technique' }, { level: 6, name: 'Wholeness of Body' }, { level: 11, name: 'Tranquility' }, { level: 17, name: 'Quivering Palm' }] },
  { id: 'devotion', classId: 'paladin', name: 'Oath of Devotion', features: [{ level: 3, name: 'Oath Spells' }, { level: 3, name: 'Sacred Weapon' }, { level: 3, name: 'Turn the Unholy' }, { level: 7, name: 'Aura of Devotion' }, { level: 15, name: 'Purity of Spirit' }, { level: 20, name: 'Holy Nimbus' }] },
  { id: 'hunter', classId: 'ranger', name: 'Hunter', features: [{ level: 3, name: "Hunter's Prey" }, { level: 7, name: 'Defensive Tactics' }, { level: 11, name: 'Multiattack' }, { level: 15, name: "Superior Hunter's Defense" }] },
  { id: 'thief', classId: 'rogue', name: 'Thief', features: [{ level: 3, name: 'Fast Hands' }, { level: 3, name: 'Second-Story Work' }, { level: 9, name: 'Supreme Sneak' }, { level: 13, name: 'Use Magic Device' }, { level: 17, name: "Thief's Reflexes" }] },
  { id: 'draconic', classId: 'sorcerer', name: 'Draconic Bloodline', hpPerLevel: 1, unarmoredBase: 13, features: [{ level: 1, name: 'Dragon Ancestor' }, { level: 1, name: 'Draconic Resilience' }, { level: 6, name: 'Elemental Affinity' }, { level: 14, name: 'Dragon Wings' }, { level: 18, name: 'Draconic Presence' }] },
  { id: 'fiend', classId: 'warlock', name: 'The Fiend', features: [{ level: 1, name: "Dark One's Blessing" }, { level: 6, name: "Dark One's Own Luck" }, { level: 10, name: 'Fiendish Resilience' }, { level: 14, name: 'Hurl Through Hell' }] },
  { id: 'evocation', classId: 'wizard', name: 'School of Evocation', features: [{ level: 2, name: 'Evocation Savant' }, { level: 2, name: 'Sculpt Spells' }, { level: 6, name: 'Potent Cantrip' }, { level: 10, name: 'Empowered Evocation' }, { level: 14, name: 'Overchannel' }] },
]

// Homebrew subclasses registered at runtime (ids namespaced `hb:<packId>:<slug>`).
let homebrew: SubclassDef[] = []

/** Replace the registered homebrew subclasses. SRD ids always win. */
export function registerHomebrewSubclasses(list: SubclassDef[]): void {
  const srd = new Set(SUBCLASSES.map(s => s.id))
  homebrew = list.filter(s => !srd.has(s.id))
}

export const subclassesFor = (classId: string): SubclassDef[] =>
  [...SUBCLASSES, ...homebrew].filter(s => s.classId === classId)

export const subclassById = (id: string): SubclassDef | undefined =>
  SUBCLASSES.find(s => s.id === id) ?? homebrew.find(s => s.id === id)

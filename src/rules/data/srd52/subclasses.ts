import type { SubclassDef } from '../subclasses'

// SRD 5.2 (2024) subclasses, one per class, all chosen at level 3. Ids match the content library (src/content).
export const SUBCLASSES_2024: SubclassDef[] = [
  { id: 'path-of-the-berserker', classId: 'barbarian', name: 'Path of the Berserker', features: [{ level: 3, name: 'Frenzy' }, { level: 6, name: 'Mindless Rage' }, { level: 10, name: 'Retaliation' }, { level: 14, name: 'Intimidating Presence' }] },
  { id: 'college-of-lore', classId: 'bard', name: 'College of Lore', features: [{ level: 3, name: 'Bonus Proficiencies' }, { level: 3, name: 'Cutting Words' }, { level: 6, name: 'Magical Discoveries' }, { level: 14, name: 'Peerless Skill' }] },
  { id: 'life-domain', classId: 'cleric', name: 'Life Domain', features: [{ level: 3, name: 'Disciple of Life' }, { level: 3, name: 'Life Domain Spells' }, { level: 3, name: 'Preserve Life' }, { level: 6, name: 'Blessed Healer' }, { level: 17, name: 'Supreme Healing' }],
    spells: [
      { level: 3, names: ['Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration'] }, { level: 5, names: ['Mass Healing Word', 'Revivify'] },
      { level: 7, names: ['Aura of Life', 'Death Ward'] }, { level: 9, names: ['Greater Restoration', 'Mass Cure Wounds'] },
    ] },
  { id: 'circle-of-the-land', classId: 'druid', name: 'Circle of the Land', features: [{ level: 3, name: 'Circle of the Land Spells' }, { level: 3, name: "Land's Aid" }, { level: 6, name: 'Natural Recovery' }, { level: 10, name: "Nature's Ward" }, { level: 14, name: "Nature's Sanctuary" }] },
  { id: 'champion', classId: 'fighter', name: 'Champion', features: [{ level: 3, name: 'Improved Critical' }, { level: 3, name: 'Remarkable Athlete' }, { level: 7, name: 'Additional Fighting Style' }, { level: 10, name: 'Heroic Warrior' }, { level: 15, name: 'Superior Critical' }, { level: 18, name: 'Survivor' }] },
  { id: 'warrior-of-the-open-hand', classId: 'monk', name: 'Warrior of the Open Hand', features: [{ level: 3, name: 'Open Hand Technique' }, { level: 6, name: 'Wholeness of Body' }, { level: 11, name: 'Fleet Step' }, { level: 17, name: 'Quivering Palm' }] },
  { id: 'oath-of-devotion', classId: 'paladin', name: 'Oath of Devotion', features: [{ level: 3, name: 'Oath of Devotion Spells' }, { level: 3, name: 'Sacred Weapon' }, { level: 7, name: 'Aura of Devotion' }, { level: 15, name: 'Smite of Protection' }, { level: 20, name: 'Holy Nimbus' }],
    spells: [
      { level: 3, names: ['Protection from Evil and Good', 'Shield of Faith'] }, { level: 5, names: ['Aid', 'Zone of Truth'] }, { level: 9, names: ['Beacon of Hope', 'Dispel Magic'] },
      { level: 13, names: ['Freedom of Movement', 'Guardian of Faith'] }, { level: 17, names: ['Commune', 'Flame Strike'] },
    ] },
  { id: 'hunter', classId: 'ranger', name: 'Hunter', features: [{ level: 3, name: "Hunter's Lore" }, { level: 3, name: "Hunter's Prey" }, { level: 7, name: 'Defensive Tactics' }, { level: 11, name: "Superior Hunter's Prey" }, { level: 15, name: "Superior Hunter's Defense" }] },
  { id: 'thief', classId: 'rogue', name: 'Thief', features: [{ level: 3, name: 'Fast Hands' }, { level: 3, name: 'Second-Story Work' }, { level: 9, name: 'Supreme Sneak' }, { level: 13, name: 'Use Magic Device' }, { level: 17, name: "Thief's Reflexes" }] },
  { id: 'draconic-sorcery', classId: 'sorcerer', name: 'Draconic Sorcery', hpPerLevel: 1, unarmoredAbility: 'cha', features: [{ level: 3, name: 'Draconic Resilience' }, { level: 3, name: 'Draconic Spells' }, { level: 6, name: 'Elemental Affinity' }, { level: 14, name: 'Dragon Wings' }, { level: 18, name: 'Dragon Companion' }],
    spells: [
      { level: 3, names: ['Alter Self', 'Chromatic Orb', 'Command', "Dragon's Breath"] }, { level: 5, names: ['Fear', 'Fly'] },
      { level: 7, names: ['Arcane Eye', 'Charm Monster'] }, { level: 9, names: ['Legend Lore', 'Summon Dragon'] },
    ] },
  {
    id: 'fiend-patron', classId: 'warlock', name: 'Fiend Patron',
    features: [{ level: 3, name: "Dark One's Blessing" }, { level: 3, name: 'Fiend Spells' }, { level: 6, name: "Dark One's Own Luck", uses: { count: 'cha', recharge: 'long' } }, { level: 10, name: 'Fiendish Resilience' }, { level: 14, name: 'Hurl Through Hell', uses: { count: 1, recharge: 'long' } }],
    spells: [
      { level: 3, names: ['Burning Hands', 'Command', 'Scorching Ray', 'Suggestion'] }, { level: 5, names: ['Fireball', 'Stinking Cloud'] },
      { level: 7, names: ['Fire Shield', 'Wall of Fire'] }, { level: 9, names: ['Geas', 'Insect Plague'] },
    ],
  },
  { id: 'evoker', classId: 'wizard', name: 'Evoker', features: [{ level: 3, name: 'Evocation Savant' }, { level: 3, name: 'Potent Cantrip' }, { level: 6, name: 'Sculpt Spells' }, { level: 10, name: 'Empowered Evocation' }, { level: 14, name: 'Overchannel' }] },
]

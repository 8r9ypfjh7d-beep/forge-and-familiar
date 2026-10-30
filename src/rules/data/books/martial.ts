// Barbarian, Fighter, Monk and Rogue subclasses from the official books (names, levels, mechanics only).
import { BGG, EGW, FTD, PHB, PHB24, SCAG, TCE, XGE, dark, f, fx, long, move, resist, saveProf, short, skillProf, type Def } from './helpers'

const B = 'barbarian'
const F = 'fighter'
const M = 'monk'
const R = 'rogue'

export const MARTIAL: Def[] = [
  // Barbarian (path at 3)
  { id: 'ancestral-guardian', classId: B, name: 'Path of the Ancestral Guardian', source: XGE, features: [f(3, 'Ancestral Protectors'), f(6, 'Spirit Shield'), f(10, 'Consult the Spirits', short()), f(14, 'Vengeful Ancestors')] },
  { id: 'battlerager', classId: B, name: 'Path of the Battlerager', source: SCAG, features: [f(3, 'Battlerager Armor'), f(6, 'Reckless Abandon'), f(10, 'Battlerager Charge'), f(14, 'Spiked Retribution')] },
  { id: 'beast', classId: B, name: 'Path of the Beast', source: TCE, features: [f(3, 'Form of the Beast'), f(6, 'Bestial Soul'), f(10, 'Infectious Fury', long('pb')), f(14, 'Call the Hunt', long('pb'))] },
  { id: 'giant', classId: B, name: 'Path of the Giant', source: BGG, features: [f(3, "Giant's Power"), f(3, "Giant's Havoc"), f(6, 'Elemental Cleaver'), f(10, 'Mighty Impel'), f(14, 'Demiurgic Colossus')] },
  { id: 'storm-herald', classId: B, name: 'Path of the Storm Herald', source: XGE, features: [f(3, 'Storm Aura'), f(6, 'Storm Soul'), f(10, 'Shielding Storm'), f(14, 'Raging Storm')] },
  { id: 'totem-warrior', classId: B, name: 'Path of the Totem Warrior', source: PHB, features: [f(3, 'Spirit Seeker'), f(3, 'Totem Spirit'), f(6, 'Aspect of the Beast'), f(10, 'Spirit Walker'), f(14, 'Totemic Attunement')] },
  { id: 'path-of-wild-magic', classId: B, name: 'Path of Wild Magic', source: TCE, features: [f(3, 'Magic Awareness', long('pb')), f(3, 'Wild Surge'), f(6, 'Bolstering Magic', long('pb')), f(10, 'Unstable Backlash'), f(14, 'Controlled Surge')] },
  { id: 'zealot', classId: B, name: 'Path of the Zealot', source: XGE, features: [f(3, 'Divine Fury'), f(3, 'Warrior of the Gods'), f(6, 'Fanatical Focus'), f(10, 'Zealous Presence', long()), f(14, 'Rage beyond Death')] },

  // Fighter (archetype at 3)
  { id: 'arcane-archer', classId: F, name: 'Arcane Archer', source: XGE, features: [f(3, 'Arcane Archer Lore'), f(3, 'Arcane Shot', { uses: { count: 2, recharge: 'short' } }), f(7, 'Magic Arrow'), f(7, 'Curving Shot'), f(15, 'Ever-Ready Shot')] },
  { id: 'battle-master', classId: F, name: 'Battle Master', source: PHB, features: [f(3, 'Combat Superiority', { uses: { count: 4, recharge: 'short', steps: [[3, 4], [7, 5], [15, 6]] } }), f(3, 'Student of War'), f(7, 'Know Your Enemy'), f(10, 'Improved Combat Superiority'), f(15, 'Relentless')] },
  { id: 'cavalier', classId: F, name: 'Cavalier', source: XGE, features: [f(3, 'Bonus Proficiency'), f(3, 'Born to the Saddle'), f(3, 'Unwavering Mark', long('str')), f(7, 'Warding Maneuver', long('con')), f(10, 'Hold the Line'), f(15, 'Ferocious Charger'), f(18, 'Vigilant Defender')] },
  { id: 'echo-knight', classId: F, name: 'Echo Knight', source: EGW, features: [f(3, 'Manifest Echo'), f(3, 'Unleash Incarnation', long('con')), f(7, 'Echo Avatar'), f(10, 'Shadow Martyr', short()), f(15, 'Reclaim Potential', long('con')), f(18, 'Legion of One')] },
  { id: 'eldritch-knight', classId: F, name: 'Eldritch Knight', source: PHB, features: [f(3, 'Eldritch Knight Spellcasting'), f(3, 'Weapon Bond'), f(7, 'War Magic'), f(10, 'Eldritch Strike'), f(15, 'Arcane Charge'), f(18, 'Improved War Magic')] },
  { id: 'psi-warrior', classId: F, name: 'Psi Warrior', source: TCE, features: [f(3, 'Psionic Power', { uses: { count: 'pb', mult: 2, recharge: 'long' } }), f(7, 'Telekinetic Adept'), f(10, 'Guarded Mind', fx(resist('psychic'))), f(15, 'Bulwark of Force', long()), f(18, 'Telekinetic Master', long())] },
  { id: 'purple-dragon-knight', classId: F, name: 'Purple Dragon Knight', source: SCAG, features: [f(3, 'Rallying Cry'), f(7, 'Royal Envoy', fx(skillProf('persuasion', true))), f(10, 'Inspiring Surge'), f(15, 'Bulwark')] },
  { id: 'rune-knight', classId: F, name: 'Rune Knight', source: TCE, features: [f(3, 'Bonus Proficiencies'), f(3, 'Rune Carver'), f(3, "Giant's Might", long('pb')), f(7, 'Runic Shield', long('pb')), f(10, 'Great Stature'), f(15, 'Master of Runes'), f(18, 'Runic Juggernaut')] },
  { id: 'samurai', classId: F, name: 'Samurai', source: XGE, features: [f(3, 'Bonus Proficiency'), f(3, 'Fighting Spirit', long(3)), f(7, 'Elegant Courtier', fx(saveProf('wis'))), f(10, 'Tireless Spirit'), f(15, 'Rapid Strike'), f(18, 'Strength before Death', long())] },

  // Monk (tradition at 3)
  { id: 'ascendant-dragon', classId: M, name: 'Way of the Ascendant Dragon', source: FTD, features: [f(3, 'Draconic Disciple'), f(3, 'Breath of the Dragon', long('pb')), f(6, 'Wings Unfurled', long('pb')), f(11, 'Aspect of the Wyrm', long()), f(17, 'Ascendant Aspect')] },
  { id: 'astral-self', classId: M, name: 'Way of the Astral Self', source: TCE, features: [f(3, 'Arms of the Astral Self'), f(6, 'Visage of the Astral Self'), f(11, 'Body of the Astral Self'), f(17, 'Awakened Astral Self')] },
  { id: 'drunken-master', classId: M, name: 'Way of the Drunken Master', source: XGE, features: [f(3, 'Bonus Proficiencies', fx(skillProf('performance'))), f(3, 'Drunken Technique'), f(6, 'Tipsy Sway'), f(11, "Drunkard's Luck"), f(17, 'Intoxicated Frenzy')] },
  { id: 'four-elements', classId: M, name: 'Way of the Four Elements', source: PHB, features: [f(3, 'Disciple of the Elements'), f(6, 'Extra Elemental Discipline'), f(11, 'Extra Elemental Discipline'), f(17, 'Extra Elemental Discipline')] },
  { id: 'kensei', classId: M, name: 'Way of the Kensei', source: XGE, features: [f(3, 'Path of the Kensei'), f(6, 'One with the Blade'), f(11, 'Sharpen the Blade'), f(17, 'Unerring Accuracy')] },
  { id: 'long-death', classId: M, name: 'Way of the Long Death', source: SCAG, features: [f(3, 'Touch of Death'), f(6, 'Hour of Reaping'), f(11, 'Mastery of Death'), f(17, 'Touch of the Long Death')] },
  { id: 'mercy', classId: M, name: 'Way of Mercy', source: TCE, features: [f(3, 'Implements of Mercy', fx(skillProf('insight'), skillProf('medicine'))), f(3, 'Hand of Healing'), f(3, 'Hand of Harm'), f(6, "Physician's Touch"), f(11, 'Flurry of Healing and Harm'), f(17, 'Hand of Ultimate Mercy', long())] },
  { id: 'shadow', classId: M, name: 'Way of Shadow', source: PHB, features: [f(3, 'Shadow Arts'), f(6, 'Shadow Step'), f(11, 'Cloak of Shadows'), f(17, 'Opportunist')] },
  { id: 'sun-soul', classId: M, name: 'Way of the Sun Soul', source: XGE, features: [f(3, 'Radiant Sun Bolt'), f(6, 'Searing Arc Strike'), f(11, 'Searing Sunburst'), f(17, 'Sun Shield')] },

  // Rogue (archetype at 3)
  { id: 'arcane-trickster', classId: R, name: 'Arcane Trickster', source: PHB, features: [f(3, 'Arcane Trickster Spellcasting'), f(3, 'Mage Hand Legerdemain'), f(9, 'Magical Ambush'), f(13, 'Versatile Trickster'), f(17, 'Spell Thief', long())] },
  { id: 'assassin', classId: R, name: 'Assassin', source: PHB, features: [f(3, 'Bonus Proficiencies'), f(3, 'Assassinate'), f(9, 'Infiltration Expertise'), f(13, 'Impostor'), f(17, 'Death Strike')] },
  { id: 'inquisitive', classId: R, name: 'Inquisitive', source: XGE, features: [f(3, 'Ear for Deceit'), f(3, 'Eye for Detail'), f(3, 'Insightful Fighting'), f(9, 'Steady Eye'), f(13, 'Unerring Eye', long('wis')), f(17, 'Eye for Weakness')] },
  { id: 'mastermind', classId: R, name: 'Mastermind', source: XGE, features: [f(3, 'Master of Intrigue'), f(3, 'Master of Tactics'), f(9, 'Insightful Manipulator'), f(13, 'Misdirection'), f(17, 'Soul of Deceit')] },
  { id: 'phantom', classId: R, name: 'Phantom', source: TCE, features: [f(3, 'Whispers of the Dead'), f(3, 'Wails from the Grave', long('pb')), f(9, 'Tokens of the Departed'), f(13, 'Ghost Walk', long()), f(17, "Death's Friend")] },
  { id: 'scout', classId: R, name: 'Scout', source: XGE, features: [f(3, 'Skirmisher'), f(3, 'Survivalist', fx(skillProf('nature', true), skillProf('survival', true))), f(9, 'Superior Mobility', fx({ kind: 'speed', value: 10 })), f(13, 'Ambush Master'), f(17, 'Sudden Strike')] },
  { id: 'soulknife', classId: R, name: 'Soulknife', source: TCE, features: [f(3, 'Psionic Power', { uses: { count: 'pb', mult: 2, recharge: 'long' } }), f(3, 'Psychic Blades'), f(9, 'Soul Blades'), f(13, 'Psychic Veil', long()), f(17, 'Rend Mind', long())] },
  { id: 'swashbuckler', classId: R, name: 'Swashbuckler', source: XGE, features: [f(3, 'Fancy Footwork'), f(3, 'Rakish Audacity'), f(9, 'Panache'), f(13, 'Elegant Maneuver'), f(17, 'Master Duelist', short())] },
]

export const MARTIAL_2024: Def[] = [
  { id: 'path-of-the-wild-heart', classId: B, name: 'Path of the Wild Heart', source: PHB24, features: [f(3, 'Animal Speaker'), f(3, 'Rage of the Wilds'), f(6, 'Aspect of the Wilds'), f(10, 'Nature Speaker'), f(14, 'Power of the Wilds')] },
  { id: 'path-of-the-world-tree', classId: B, name: 'Path of the World Tree', source: PHB24, features: [f(3, 'Vitality of the Tree'), f(6, 'Branches of the Tree'), f(10, 'Battering Roots'), f(14, 'Travel along the Tree')] },
  { id: 'path-of-the-zealot', classId: B, name: 'Path of the Zealot', source: PHB24, features: [f(3, 'Divine Fury'), f(3, 'Warrior of the Gods', { uses: { count: 4, recharge: 'long', steps: [[3, 4], [6, 5], [12, 6], [17, 7]] } }), f(6, 'Fanatical Focus'), f(10, 'Zealous Presence', long()), f(14, 'Rage of the Gods', long())] },

  { id: 'battle-master', classId: F, name: 'Battle Master', source: PHB24, features: [f(3, 'Combat Superiority', { uses: { count: 4, recharge: 'short', steps: [[3, 4], [7, 5], [15, 6]] } }), f(3, 'Student of War'), f(7, 'Know Your Enemy', long()), f(10, 'Improved Combat Superiority'), f(15, 'Relentless'), f(18, 'Ultimate Combat Superiority')] },
  { id: 'eldritch-knight', classId: F, name: 'Eldritch Knight', source: PHB24, features: [f(3, 'Eldritch Knight Spellcasting'), f(3, 'War Bond'), f(7, 'War Magic'), f(10, 'Eldritch Strike'), f(15, 'Arcane Charge'), f(18, 'Improved War Magic')] },
  { id: 'psi-warrior', classId: F, name: 'Psi Warrior', source: PHB24, features: [f(3, 'Psionic Power', { uses: { count: 4, recharge: 'long', steps: [[3, 4], [5, 6], [9, 8], [13, 10], [17, 12]] } }), f(7, 'Telekinetic Adept'), f(10, 'Guarded Mind'), f(15, 'Bulwark of Force', long()), f(18, 'Telekinetic Master', long())] },

  { id: 'warrior-of-mercy', classId: M, name: 'Warrior of Mercy', source: PHB24, features: [f(3, 'Hand of Harm'), f(3, 'Hand of Healing'), f(3, 'Implements of Mercy', fx(skillProf('insight'), skillProf('medicine'))), f(6, "Physician's Touch"), f(11, 'Flurry of Healing and Harm', long('wis')), f(17, 'Hand of Ultimate Mercy', long())] },
  { id: 'warrior-of-shadow', classId: M, name: 'Warrior of Shadow', source: PHB24, features: [f(3, 'Shadow Arts', fx(dark(60))), f(6, 'Shadow Step'), f(11, 'Improved Shadow Step'), f(17, 'Cloak of Shadows')] },
  { id: 'warrior-of-the-elements', classId: M, name: 'Warrior of the Elements', source: PHB24, features: [f(3, 'Elemental Attunement'), f(3, 'Manipulate Elements'), f(6, 'Elemental Burst'), f(11, 'Stride of the Elements', fx(move('fly'), move('swim'))), f(17, 'Elemental Epitome')] },

  { id: 'arcane-trickster', classId: R, name: 'Arcane Trickster', source: PHB24, features: [f(3, 'Arcane Trickster Spellcasting'), f(3, 'Mage Hand Legerdemain'), f(9, 'Magical Ambush'), f(13, 'Versatile Trickster'), f(17, 'Spell Thief', long())] },
  { id: 'assassin', classId: R, name: 'Assassin', source: PHB24, features: [f(3, 'Assassinate'), f(3, "Assassin's Tools"), f(9, 'Infiltration Expertise'), f(13, 'Envenom Weapons'), f(17, 'Death Strike')] },
  { id: 'soulknife', classId: R, name: 'Soulknife', source: PHB24, features: [f(3, 'Psionic Power', { uses: { count: 4, recharge: 'long', steps: [[3, 4], [5, 6], [9, 8], [13, 10], [17, 12]] } }), f(3, 'Psychic Blades'), f(9, 'Soul Blades'), f(13, 'Psychic Veil', long()), f(17, 'Rend Mind', long())] },
]

/** 2014 subclasses the 2024 book rewrote; the others are offered in 2024 as they were. */
export const MARTIAL_REWRITTEN = ['zealot', 'battle-master', 'eldritch-knight', 'psi-warrior', 'mercy', 'shadow', 'four-elements', 'arcane-trickster', 'assassin', 'soulknife']

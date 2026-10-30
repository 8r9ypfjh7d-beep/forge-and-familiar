// Bard, Cleric, Druid, Paladin, Ranger, Sorcerer and Wizard subclasses from the official books (names, levels, mechanics only).
import {
  DMG, DSDQ, EGW, FTD, MOT, PHB, PHB24, SCAG, TCE, VRGR, XGE, dark, f, fullSpells, fx, halfSpells, long, move, resist, saveProf, short, skillProf,
  spells, spells2024, type Def,
} from './helpers'

const BD = 'bard'
const C = 'cleric'
const D = 'druid'
const P = 'paladin'
const RG = 'ranger'
const S = 'sorcerer'
const W = 'wizard'

/** 2014 cleric domains: Channel Divinity option at 2, then 6, Divine Strike or Potent Spellcasting at 8, then 17. */
export const CASTERS: Def[] = [
  // Bard (college at 3)
  { id: 'creation', classId: BD, name: 'College of Creation', source: TCE, features: [f(3, 'Mote of Potential'), f(3, 'Performance of Creation', long()), f(6, 'Animating Performance', long()), f(14, 'Creative Crescendo')] },
  { id: 'eloquence', classId: BD, name: 'College of Eloquence', source: TCE, features: [f(3, 'Silver Tongue'), f(3, 'Unsettling Words'), f(6, 'Unfailing Inspiration'), f(6, 'Universal Speech', long()), f(14, 'Infectious Inspiration', long('cha'))] },
  { id: 'glamour', classId: BD, name: 'College of Glamour', source: XGE, features: [f(3, 'Mantle of Inspiration'), f(3, 'Enthralling Performance', short()), f(6, 'Mantle of Majesty', long()), f(14, 'Unbreakable Majesty', short())] },
  { id: 'spirits', classId: BD, name: 'College of Spirits', source: VRGR, spells: spells([3, 'Guidance']), features: [f(3, 'Guiding Whispers'), f(3, 'Spiritual Focus'), f(3, 'Tales from Beyond'), f(6, 'Spirit Session', long()), f(14, 'Mystical Connection')] },
  { id: 'swords', classId: BD, name: 'College of Swords', source: XGE, armor: ['medium'], features: [f(3, 'Bonus Proficiencies'), f(3, 'Fighting Style'), f(3, 'Blade Flourish'), f(6, 'Extra Attack'), f(14, "Master's Flourish")] },
  { id: 'valor', classId: BD, name: 'College of Valor', source: PHB, armor: ['medium', 'shield'], weapons: ['martial'], features: [f(3, 'Bonus Proficiencies'), f(3, 'Combat Inspiration'), f(6, 'Extra Attack'), f(14, 'Battle Magic')] },
  { id: 'whispers', classId: BD, name: 'College of Whispers', source: XGE, features: [f(3, 'Psychic Blades'), f(3, 'Words of Terror', short()), f(6, 'Mantle of Whispers', short()), f(14, 'Shadow Lore', long())] },

  // Cleric (domain at 1)
  {
    id: 'arcana', classId: C, name: 'Arcana Domain', source: SCAG,
    spells: fullSpells(['Detect Magic', 'Magic Missile'], ['Magic Weapon', "Arcanist's Magic Aura"], ['Dispel Magic', 'Magic Circle'], ['Arcane Eye', 'Secret Chest'], ['Planar Binding', 'Teleportation Circle']),
    features: [f(1, 'Arcane Initiate', fx(skillProf('arcana'))), f(2, 'Channel Divinity: Arcane Abjuration'), f(6, 'Spell Breaker'), f(8, 'Potent Spellcasting'), f(17, 'Arcane Mastery')],
  },
  {
    id: 'death', classId: C, name: 'Death Domain', source: DMG, weapons: ['martial'],
    spells: fullSpells(['False Life', 'Ray of Sickness'], ['Blindness/Deafness', 'Ray of Enfeeblement'], ['Animate Dead', 'Vampiric Touch'], ['Blight', 'Death Ward'], ['Antilife Shell', 'Cloudkill']),
    features: [f(1, 'Bonus Proficiency'), f(1, 'Reaper'), f(2, 'Channel Divinity: Touch of Death'), f(6, 'Inescapable Destruction'), f(8, 'Divine Strike'), f(17, 'Improved Reaper')],
  },
  {
    id: 'forge', classId: C, name: 'Forge Domain', source: XGE, armor: ['heavy'],
    spells: fullSpells(['Identify', 'Searing Smite'], ['Heat Metal', 'Magic Weapon'], ['Elemental Weapon', 'Protection from Energy'], ['Fabricate', 'Wall of Fire'], ['Animate Objects', 'Creation']),
    features: [f(1, 'Bonus Proficiencies'), f(1, 'Blessing of the Forge', long()), f(2, "Channel Divinity: Artisan's Blessing"), f(6, 'Soul of the Forge', fx(resist('fire'))), f(8, 'Divine Strike'), f(17, 'Saint of Forge and Fire', fx({ kind: 'immunity', damage: 'fire' }))],
  },
  {
    id: 'grave', classId: C, name: 'Grave Domain', source: XGE,
    spells: [{ level: 1, names: ['Spare the Dying'] }, ...fullSpells(['Bane', 'False Life'], ['Gentle Repose', 'Ray of Enfeeblement'], ['Revivify', 'Vampiric Touch'], ['Blight', 'Death Ward'], ['Antilife Shell', 'Raise Dead'])],
    features: [f(1, 'Circle of Mortality'), f(1, 'Eyes of the Grave', long('wis')), f(2, 'Channel Divinity: Path to the Grave'), f(6, "Sentinel at Death's Door", long('wis')), f(8, 'Potent Spellcasting'), f(17, 'Keeper of Souls')],
  },
  {
    id: 'knowledge', classId: C, name: 'Knowledge Domain', source: PHB,
    spells: fullSpells(['Command', 'Identify'], ['Augury', 'Suggestion'], ['Nondetection', 'Speak with Dead'], ['Arcane Eye', 'Confusion'], ['Legend Lore', 'Scrying']),
    features: [f(1, 'Blessings of Knowledge'), f(2, 'Channel Divinity: Knowledge of the Ages'), f(6, 'Channel Divinity: Read Thoughts'), f(8, 'Potent Spellcasting'), f(17, 'Visions of the Past')],
  },
  {
    id: 'light', classId: C, name: 'Light Domain', source: PHB,
    spells: [{ level: 1, names: ['Light'] }, ...fullSpells(['Burning Hands', 'Faerie Fire'], ['Flaming Sphere', 'Scorching Ray'], ['Daylight', 'Fireball'], ['Guardian of Faith', 'Wall of Fire'], ['Flame Strike', 'Scrying'])],
    features: [f(1, 'Bonus Cantrip'), f(1, 'Warding Flare', long('wis')), f(2, 'Channel Divinity: Radiance of the Dawn'), f(6, 'Improved Flare'), f(8, 'Potent Spellcasting'), f(17, 'Corona of Light')],
  },
  {
    id: 'nature', classId: C, name: 'Nature Domain', source: PHB, armor: ['heavy'],
    spells: fullSpells(['Animal Friendship', 'Speak with Animals'], ['Barkskin', 'Spike Growth'], ['Plant Growth', 'Wind Wall'], ['Dominate Beast', 'Grasping Vine'], ['Insect Plague', 'Tree Stride']),
    features: [f(1, 'Acolyte of Nature'), f(1, 'Bonus Proficiency'), f(2, 'Channel Divinity: Charm Animals and Plants'), f(6, 'Dampen Elements'), f(8, 'Divine Strike'), f(17, 'Master of Nature')],
  },
  {
    id: 'order', classId: C, name: 'Order Domain', source: TCE, armor: ['heavy'],
    spells: fullSpells(['Command', 'Heroism'], ['Hold Person', 'Zone of Truth'], ['Mass Healing Word', 'Slow'], ['Compulsion', 'Locate Creature'], ['Commune', 'Dominate Person']),
    features: [f(1, 'Bonus Proficiencies'), f(1, 'Voice of Authority'), f(2, "Channel Divinity: Order's Demand"), f(6, 'Embodiment of the Law', long('wis')), f(8, 'Divine Strike'), f(17, "Order's Wrath")],
  },
  {
    id: 'peace', classId: C, name: 'Peace Domain', source: TCE,
    spells: fullSpells(['Heroism', 'Sanctuary'], ['Aid', 'Warding Bond'], ['Beacon of Hope', 'Sending'], ['Aura of Purity', 'Resilient Sphere'], ['Greater Restoration', 'Telepathic Bond']),
    features: [f(1, 'Implement of Peace'), f(1, 'Emboldening Bond', long('pb')), f(2, 'Channel Divinity: Balm of Peace'), f(6, 'Protective Bond'), f(8, 'Potent Spellcasting'), f(17, 'Expansive Bond')],
  },
  {
    id: 'tempest', classId: C, name: 'Tempest Domain', source: PHB, armor: ['heavy'], weapons: ['martial'],
    spells: fullSpells(['Fog Cloud', 'Thunderwave'], ['Gust of Wind', 'Shatter'], ['Call Lightning', 'Sleet Storm'], ['Control Water', 'Ice Storm'], ['Destructive Wave', 'Insect Plague']),
    features: [f(1, 'Bonus Proficiencies'), f(1, 'Wrath of the Storm', long('wis')), f(2, 'Channel Divinity: Destructive Wrath'), f(6, 'Thunderbolt Strike'), f(8, 'Divine Strike'), f(17, 'Stormborn', fx(move('fly')))],
  },
  {
    id: 'trickery', classId: C, name: 'Trickery Domain', source: PHB,
    spells: fullSpells(['Charm Person', 'Disguise Self'], ['Mirror Image', 'Pass without Trace'], ['Blink', 'Dispel Magic'], ['Dimension Door', 'Polymorph'], ['Dominate Person', 'Modify Memory']),
    features: [f(1, 'Blessing of the Trickster'), f(2, 'Channel Divinity: Invoke Duplicity'), f(6, 'Channel Divinity: Cloak of Shadows'), f(8, 'Divine Strike'), f(17, 'Improved Duplicity')],
  },
  {
    id: 'twilight', classId: C, name: 'Twilight Domain', source: TCE, armor: ['heavy'], weapons: ['martial'],
    spells: fullSpells(['Faerie Fire', 'Sleep'], ['Moonbeam', 'See Invisibility'], ['Aura of Vitality', 'Tiny Hut'], ['Aura of Life', 'Greater Invisibility'], ['Circle of Power', 'Mislead']),
    features: [f(1, 'Bonus Proficiencies'), f(1, 'Eyes of Night', fx(dark(300))), f(1, 'Vigilant Blessing'), f(2, 'Channel Divinity: Twilight Sanctuary'), f(6, 'Steps of Night', long('pb')), f(8, 'Divine Strike'), f(17, 'Twilight Shroud')],
  },
  {
    id: 'war', classId: C, name: 'War Domain', source: PHB, armor: ['heavy'], weapons: ['martial'],
    spells: fullSpells(['Divine Favor', 'Shield of Faith'], ['Magic Weapon', 'Spiritual Weapon'], ["Crusader's Mantle", 'Spirit Guardians'], ['Freedom of Movement', 'Stoneskin'], ['Flame Strike', 'Hold Monster']),
    features: [f(1, 'Bonus Proficiencies'), f(1, 'War Priest', long('wis')), f(2, 'Channel Divinity: Guided Strike'), f(6, "Channel Divinity: War God's Blessing"), f(8, 'Divine Strike'), f(17, 'Avatar of Battle', fx(resist('bludgeoning'), resist('piercing'), resist('slashing')))],
  },

  // Druid (circle at 2)
  { id: 'dreams', classId: D, name: 'Circle of Dreams', source: XGE, features: [f(2, 'Balm of the Summer Court', { uses: { count: 'level', recharge: 'long' } }), f(6, 'Hearth of Moonlight and Shadow'), f(10, 'Hidden Paths', long('wis')), f(14, 'Walker in Dreams', long())] },
  { id: 'moon', classId: D, name: 'Circle of the Moon', source: PHB, features: [f(2, 'Combat Wild Shape'), f(2, 'Circle Forms'), f(6, 'Primal Strike'), f(10, 'Elemental Wild Shape'), f(14, 'Thousand Forms')] },
  { id: 'shepherd', classId: D, name: 'Circle of the Shepherd', source: XGE, features: [f(2, 'Speech of the Woods'), f(2, 'Spirit Totem', short()), f(6, 'Mighty Summoner'), f(10, 'Guardian Spirit'), f(14, 'Faithful Summons', long())] },
  {
    id: 'spores', classId: D, name: 'Circle of Spores', source: TCE,
    spells: spells([2, 'Chill Touch'], [3, 'Blindness/Deafness', 'Gentle Repose'], [5, 'Animate Dead', 'Gaseous Form'], [7, 'Blight', 'Confusion'], [9, 'Cloudkill', 'Contagion']),
    features: [f(2, 'Circle of Spores Spells'), f(2, 'Halo of Spores'), f(2, 'Symbiotic Entity'), f(6, 'Fungal Infestation', long('wis')), f(10, 'Spreading Spores'), f(14, 'Fungal Body')],
  },
  {
    id: 'stars', classId: D, name: 'Circle of Stars', source: TCE, spells: spells([2, 'Guidance', 'Guiding Bolt']),
    features: [f(2, 'Star Map', long('pb')), f(2, 'Starry Form'), f(6, 'Cosmic Omen', long('pb')), f(10, 'Twinkling Constellations'), f(14, 'Full of Stars')],
  },
  {
    id: 'wildfire', classId: D, name: 'Circle of Wildfire', source: TCE,
    spells: spells([2, 'Burning Hands', 'Cure Wounds'], [3, 'Flaming Sphere', 'Scorching Ray'], [5, 'Plant Growth', 'Revivify'], [7, 'Aura of Life', 'Fire Shield'], [9, 'Flame Strike', 'Mass Cure Wounds']),
    features: [f(2, 'Circle of Wildfire Spells'), f(2, 'Summon Wildfire Spirit'), f(6, 'Enhanced Bond'), f(10, 'Cauterizing Flames', long('pb')), f(14, 'Blazing Revival', long())],
  },

  // Paladin (oath at 3)
  {
    id: 'ancients', classId: P, name: 'Oath of the Ancients', source: PHB,
    spells: halfSpells(['Ensnaring Strike', 'Speak with Animals'], ['Misty Step', 'Moonbeam'], ['Plant Growth', 'Protection from Energy'], ['Ice Storm', 'Stoneskin'], ['Commune with Nature', 'Tree Stride']),
    features: [f(3, "Channel Divinity: Nature's Wrath"), f(3, 'Channel Divinity: Turn the Faithless'), f(7, 'Aura of Warding'), f(15, 'Undying Sentinel', long()), f(20, 'Elder Champion', long())],
  },
  {
    id: 'conquest', classId: P, name: 'Oath of Conquest', source: XGE,
    spells: halfSpells(['Armor of Agathys', 'Command'], ['Hold Person', 'Spiritual Weapon'], ['Bestow Curse', 'Fear'], ['Dominate Beast', 'Stoneskin'], ['Cloudkill', 'Dominate Person']),
    features: [f(3, 'Channel Divinity: Conquering Presence'), f(3, 'Channel Divinity: Guided Strike'), f(7, 'Aura of Conquest'), f(15, 'Scornful Rebuke'), f(20, 'Invincible Conqueror', long())],
  },
  {
    id: 'crown', classId: P, name: 'Oath of the Crown', source: SCAG,
    spells: halfSpells(['Command', 'Compelled Duel'], ['Warding Bond', 'Zone of Truth'], ['Aura of Vitality', 'Spirit Guardians'], ['Banishment', 'Guardian of Faith'], ['Circle of Power', 'Geas']),
    features: [f(3, "Channel Divinity: Champion Challenge"), f(3, 'Channel Divinity: Turn the Tide'), f(7, 'Divine Allegiance'), f(15, 'Unyielding Spirit'), f(20, 'Exalted Champion', long())],
  },
  {
    id: 'glory', classId: P, name: 'Oath of Glory', source: MOT,
    spells: halfSpells(['Guiding Bolt', 'Heroism'], ['Enhance Ability', 'Magic Weapon'], ['Haste', 'Protection from Energy'], ['Compulsion', 'Freedom of Movement'], ['Commune', 'Flame Strike']),
    features: [f(3, 'Channel Divinity: Peerless Athlete'), f(3, 'Channel Divinity: Inspiring Smite'), f(7, 'Aura of Alacrity', fx({ kind: 'speed', value: 10 })), f(15, 'Glorious Defense', long('cha')), f(20, 'Living Legend', long())],
  },
  {
    id: 'oathbreaker', classId: P, name: 'Oathbreaker', source: DMG,
    spells: halfSpells(['Hellish Rebuke', 'Inflict Wounds'], ['Crown of Madness', 'Darkness'], ['Animate Dead', 'Bestow Curse'], ['Blight', 'Confusion'], ['Contagion', 'Dominate Person']),
    features: [f(3, 'Channel Divinity: Control Undead'), f(3, 'Channel Divinity: Dreadful Aspect'), f(7, 'Aura of Hate'), f(15, 'Supernatural Resistance', fx(resist('bludgeoning'), resist('piercing'), resist('slashing'))), f(20, 'Dread Lord', long())],
  },
  {
    id: 'redemption', classId: P, name: 'Oath of Redemption', source: XGE,
    spells: halfSpells(['Sanctuary', 'Sleep'], ['Calm Emotions', 'Hold Person'], ['Counterspell', 'Hypnotic Pattern'], ['Resilient Sphere', 'Stoneskin'], ['Hold Monster', 'Wall of Force']),
    features: [f(3, 'Channel Divinity: Emissary of Peace'), f(3, 'Channel Divinity: Rebuke the Violent'), f(7, 'Aura of the Guardian'), f(15, 'Protective Spirit'), f(20, 'Emissary of Redemption')],
  },
  {
    id: 'vengeance', classId: P, name: 'Oath of Vengeance', source: PHB,
    spells: halfSpells(['Bane', "Hunter's Mark"], ['Hold Person', 'Misty Step'], ['Haste', 'Protection from Energy'], ['Banishment', 'Dimension Door'], ['Hold Monster', 'Scrying']),
    features: [f(3, 'Channel Divinity: Abjure Enemy'), f(3, 'Channel Divinity: Vow of Enmity'), f(7, 'Relentless Avenger'), f(15, 'Soul of Vengeance'), f(20, 'Avenging Angel', long())],
  },
  {
    id: 'watchers', classId: P, name: 'Oath of the Watchers', source: TCE,
    spells: halfSpells(['Alarm', 'Detect Magic'], ['Moonbeam', 'See Invisibility'], ['Counterspell', 'Nondetection'], ['Aura of Purity', 'Banishment'], ['Hold Monster', 'Scrying']),
    features: [f(3, "Channel Divinity: Watcher's Will"), f(3, 'Channel Divinity: Abjure the Extraplanar'), f(7, 'Aura of the Sentinel'), f(15, 'Vigilant Rebuke'), f(20, 'Mortal Bulwark', long())],
  },

  // Ranger (conclave at 3)
  { id: 'beast-master', classId: RG, name: 'Beast Master', source: PHB, features: [f(3, "Ranger's Companion"), f(7, 'Exceptional Training'), f(11, 'Bestial Fury'), f(15, 'Share Spells')] },
  { id: 'drakewarden', classId: RG, name: 'Drakewarden', source: FTD, features: [f(3, 'Draconic Gift'), f(3, 'Drake Companion'), f(7, 'Bond of Fang and Scale'), f(11, "Drake's Breath", long()), f(15, 'Perfected Bond')] },
  {
    id: 'fey-wanderer', classId: RG, name: 'Fey Wanderer', source: TCE, spells: halfSpells(['Charm Person'], ['Misty Step'], ['Dispel Magic'], ['Dimension Door'], ['Mislead']),
    features: [f(3, 'Fey Wanderer Magic'), f(3, 'Dreadful Strikes'), f(3, 'Otherworldly Glamour'), f(7, 'Beguiling Twist'), f(11, 'Fey Reinforcements', long()), f(15, 'Misty Wanderer', long('wis'))],
  },
  {
    id: 'gloom-stalker', classId: RG, name: 'Gloom Stalker', source: XGE, spells: halfSpells(['Disguise Self'], ['Rope Trick'], ['Fear'], ['Greater Invisibility'], ['Seeming']),
    features: [f(3, 'Gloom Stalker Magic'), f(3, 'Dread Ambusher'), f(3, 'Umbral Sight', fx(dark(60))), f(7, 'Iron Mind', fx(saveProf('wis'))), f(11, "Stalker's Flurry"), f(15, 'Shadowy Dodge')],
  },
  {
    id: 'horizon-walker', classId: RG, name: 'Horizon Walker', source: XGE, spells: halfSpells(['Protection from Evil and Good'], ['Misty Step'], ['Haste'], ['Banishment'], ['Teleportation Circle']),
    features: [f(3, 'Horizon Walker Magic'), f(3, 'Detect Portal', short()), f(3, 'Planar Warrior'), f(7, 'Ethereal Step', short()), f(11, 'Distant Strike'), f(15, 'Spectral Defense')],
  },
  {
    id: 'monster-slayer', classId: RG, name: 'Monster Slayer', source: XGE, spells: halfSpells(['Protection from Evil and Good'], ['Zone of Truth'], ['Magic Circle'], ['Banishment'], ['Hold Monster']),
    features: [f(3, 'Monster Slayer Magic'), f(3, "Hunter's Sense", long('wis')), f(3, "Slayer's Prey"), f(7, 'Supernatural Defense'), f(11, "Magic-User's Nemesis", short()), f(15, "Slayer's Counter")],
  },
  {
    id: 'swarmkeeper', classId: RG, name: 'Swarmkeeper', source: TCE, spells: [{ level: 3, names: ['Mage Hand'] }, ...halfSpells(['Faerie Fire'], ['Web'], ['Gaseous Form'], ['Arcane Eye'], ['Insect Plague'])],
    features: [f(3, 'Swarmkeeper Magic'), f(3, 'Gathered Swarm'), f(7, 'Writhing Tide', long('pb')), f(11, 'Mighty Swarm'), f(15, 'Swarming Dispersal', long('pb'))],
  },

  // Sorcerer (origin at 1)
  {
    id: 'aberrant-mind', classId: S, name: 'Aberrant Mind', source: TCE,
    spells: [{ level: 1, names: ['Mind Sliver'] }, ...fullSpells(['Arms of Hadar', 'Dissonant Whispers'], ['Calm Emotions', 'Detect Thoughts'], ['Hunger of Hadar', 'Sending'], ['Black Tentacles', 'Summon Aberration'], ['Telepathic Bond', 'Telekinesis'])],
    features: [f(1, 'Psionic Spells'), f(1, 'Telepathic Speech'), f(6, 'Psionic Sorcery'), f(6, 'Psychic Defenses', fx(resist('psychic'), { kind: 'advantage', on: 'saves', when: 'against being charmed or frightened' })), f(14, 'Revelation in Flesh'), f(18, 'Warping Implosion', long())],
  },
  {
    id: 'clockwork-soul', classId: S, name: 'Clockwork Soul', source: TCE,
    spells: fullSpells(['Alarm', 'Protection from Evil and Good'], ['Aid', 'Lesser Restoration'], ['Dispel Magic', 'Protection from Energy'], ['Freedom of Movement', 'Summon Construct'], ['Greater Restoration', 'Wall of Force']),
    features: [f(1, 'Clockwork Magic'), f(1, 'Restore Balance', long('pb')), f(6, 'Bastion of Law'), f(14, 'Trance of Order', long()), f(18, 'Clockwork Cavalcade', long())],
  },
  { id: 'divine-soul', classId: S, name: 'Divine Soul', source: XGE, features: [f(1, 'Divine Magic'), f(1, 'Favored by the Gods', short()), f(6, 'Empowered Healing'), f(14, 'Otherworldly Wings', fx(move('fly', 30))), f(18, 'Unearthly Recovery', long())] },
  { id: 'lunar-sorcery', classId: S, name: 'Lunar Sorcery', source: DSDQ, features: [f(1, 'Lunar Embodiment'), f(1, 'Moon Fire'), f(6, 'Lunar Boons'), f(6, 'Waxing and Waning'), f(14, 'Lunar Empowerment'), f(18, 'Lunar Phenomenon', long())] },
  { id: 'shadow-magic', classId: S, name: 'Shadow Magic', source: XGE, spells: spells([3, 'Darkness']), features: [f(1, 'Eyes of the Dark', fx(dark(120))), f(1, 'Strength of the Grave', long()), f(6, 'Hound of Ill Omen'), f(14, 'Shadow Walk'), f(18, 'Umbral Form')] },
  { id: 'storm-sorcery', classId: S, name: 'Storm Sorcery', source: XGE, features: [f(1, 'Wind Speaker'), f(1, 'Tempestuous Magic'), f(6, 'Heart of the Storm', fx(resist('lightning'), resist('thunder'))), f(6, 'Storm Guide'), f(14, "Storm's Fury"), f(18, 'Wind Soul', fx({ kind: 'immunity', damage: 'lightning' }, { kind: 'immunity', damage: 'thunder' }, move('fly', 60)))] },
  { id: 'wild-magic', classId: S, name: 'Wild Magic', source: PHB, features: [f(1, 'Wild Magic Surge'), f(1, 'Tides of Chaos', long()), f(6, 'Bend Luck'), f(14, 'Controlled Chaos'), f(18, 'Spell Bombardment')] },

  // Wizard (tradition at 2)
  { id: 'abjuration', classId: W, name: 'School of Abjuration', source: PHB, features: [f(2, 'Abjuration Savant'), f(2, 'Arcane Ward'), f(6, 'Projected Ward'), f(10, 'Improved Abjuration'), f(14, 'Spell Resistance', fx({ kind: 'advantage', on: 'saves', when: 'against spells' }))] },
  { id: 'bladesinging', classId: W, name: 'Bladesinging', source: TCE, armor: ['light'], features: [f(2, 'Training in War and Song', fx(skillProf('performance'))), f(2, 'Bladesong', long('pb')), f(6, 'Extra Attack'), f(10, 'Song of Defense'), f(14, 'Song of Victory')] },
  { id: 'chronurgy', classId: W, name: 'Chronurgy Magic', source: EGW, features: [f(2, 'Chronal Shift', long(2)), f(2, 'Temporal Awareness'), f(6, 'Momentary Stasis', long('int')), f(10, 'Arcane Abeyance', short()), f(14, 'Convergent Future')] },
  { id: 'conjuration', classId: W, name: 'School of Conjuration', source: PHB, features: [f(2, 'Conjuration Savant'), f(2, 'Minor Conjuration'), f(6, 'Benign Transposition', long()), f(10, 'Focused Conjuration'), f(14, 'Durable Summons')] },
  { id: 'divination', classId: W, name: 'School of Divination', source: PHB, features: [f(2, 'Divination Savant'), f(2, 'Portent', { uses: { count: 2, recharge: 'long', steps: [[2, 2], [14, 3]] } }), f(6, 'Expert Divination'), f(10, 'The Third Eye', short()), f(14, 'Greater Portent')] },
  { id: 'enchantment', classId: W, name: 'School of Enchantment', source: PHB, features: [f(2, 'Enchantment Savant'), f(2, 'Hypnotic Gaze'), f(6, 'Instinctive Charm'), f(10, 'Split Enchantment'), f(14, 'Alter Memories')] },
  { id: 'graviturgy', classId: W, name: 'Graviturgy Magic', source: EGW, features: [f(2, 'Adjust Density'), f(6, 'Gravity Well'), f(10, 'Violent Attraction', long('int')), f(14, 'Event Horizon', long())] },
  { id: 'illusion', classId: W, name: 'School of Illusion', source: PHB, features: [f(2, 'Illusion Savant'), f(2, 'Improved Minor Illusion'), f(6, 'Malleable Illusions'), f(10, 'Illusory Self', short()), f(14, 'Illusory Reality')] },
  { id: 'necromancy', classId: W, name: 'School of Necromancy', source: PHB, features: [f(2, 'Necromancy Savant'), f(2, 'Grim Harvest'), f(6, 'Undead Thralls'), f(10, 'Inured to Undeath', fx(resist('necrotic'))), f(14, 'Command Undead')] },
  { id: 'order-of-scribes', classId: W, name: 'Order of Scribes', source: TCE, features: [f(2, 'Wizardly Quill'), f(2, 'Awakened Spellbook'), f(6, 'Manifest Mind', long('pb')), f(10, 'Master Scrivener'), f(14, 'One with the Word')] },
  { id: 'transmutation', classId: W, name: 'School of Transmutation', source: PHB, features: [f(2, 'Transmutation Savant'), f(2, 'Minor Alchemy'), f(6, "Transmuter's Stone"), f(10, 'Shapechanger', short()), f(14, 'Master Transmuter')] },
  { id: 'war-magic', classId: W, name: 'War Magic', source: XGE, features: [f(2, 'Arcane Deflection'), f(2, 'Tactical Wit'), f(6, 'Power Surge'), f(10, 'Durable Magic'), f(14, 'Deflecting Shroud')] },
]

export const CASTERS_2024: Def[] = [
  { id: 'college-of-dance', classId: BD, name: 'College of Dance', source: PHB24, features: [f(3, 'Dazzling Footwork'), f(6, 'Inspiring Movement'), f(6, 'Tandem Footwork'), f(14, 'Leading Evasion')] },
  { id: 'college-of-glamour', classId: BD, name: 'College of Glamour', source: PHB24, spells: spells([3, 'Charm Person', 'Mirror Image']), features: [f(3, 'Beguiling Magic', long()), f(3, 'Mantle of Inspiration'), f(6, 'Mantle of Majesty', long()), f(14, 'Unbreakable Majesty', short())] },
  { id: 'college-of-valor', classId: BD, name: 'College of Valor', source: PHB24, armor: ['medium', 'shield'], weapons: ['martial'], features: [f(3, 'Combat Inspiration'), f(3, 'Martial Training'), f(6, 'Extra Attack'), f(14, 'Battle Magic')] },

  {
    id: 'light-domain', classId: C, name: 'Light Domain', source: PHB24,
    spells: spells2024(['Burning Hands', 'Faerie Fire', 'Scorching Ray', 'See Invisibility'], ['Daylight', 'Fireball'], ['Arcane Eye', 'Wall of Fire'], ['Flame Strike', 'Scrying']),
    features: [f(3, 'Light Domain Spells'), f(3, 'Radiance of the Dawn'), f(3, 'Warding Flare', long('wis')), f(6, 'Improved Warding Flare'), f(17, 'Corona of Light', long('wis'))],
  },
  {
    id: 'trickery-domain', classId: C, name: 'Trickery Domain', source: PHB24,
    spells: spells2024(['Charm Person', 'Disguise Self', 'Invisibility', 'Pass without Trace'], ['Hypnotic Pattern', 'Nondetection'], ['Confusion', 'Dimension Door'], ['Dominate Person', 'Modify Memory']),
    features: [f(3, 'Blessing of the Trickster'), f(3, 'Invoke Duplicity'), f(3, 'Trickery Domain Spells'), f(6, "Trickster's Transposition"), f(17, 'Improved Duplicity')],
  },
  {
    id: 'war-domain', classId: C, name: 'War Domain', source: PHB24,
    spells: spells2024(['Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon'], ["Crusader's Mantle", 'Spirit Guardians'], ['Fire Shield', 'Freedom of Movement'], ['Hold Monster', 'Steel Wind Strike']),
    features: [f(3, 'Guided Strike'), f(3, 'War Domain Spells'), f(3, 'War Priest', short('wis')), f(6, "War God's Blessing"), f(17, 'Avatar of Battle', fx(resist('bludgeoning'), resist('piercing'), resist('slashing')))],
  },

  {
    id: 'circle-of-the-moon', classId: D, name: 'Circle of the Moon', source: PHB24,
    spells: spells([3, 'Cure Wounds', 'Moonbeam', 'Starry Wisp'], [5, 'Conjure Animals'], [7, 'Fount of Moonlight'], [9, 'Mass Cure Wounds']),
    features: [f(3, 'Circle Forms'), f(3, 'Circle of the Moon Spells'), f(6, 'Improved Circle Forms'), f(10, 'Moonlight Step', long('wis')), f(14, 'Lunar Form')],
  },
  {
    id: 'circle-of-the-sea', classId: D, name: 'Circle of the Sea', source: PHB24,
    spells: spells([3, 'Fog Cloud', 'Gust of Wind', 'Ray of Frost', 'Shatter', 'Thunderwave'], [5, 'Lightning Bolt', 'Water Breathing'], [7, 'Control Water', 'Ice Storm'], [9, 'Conjure Elemental', 'Hold Monster']),
    features: [f(3, 'Circle of the Sea Spells'), f(3, 'Wrath of the Sea'), f(6, 'Aquatic Affinity', fx(move('swim'))), f(10, 'Stormborn'), f(14, 'Oceanic Gift')],
  },
  { id: 'circle-of-the-stars', classId: D, name: 'Circle of the Stars', source: PHB24, spells: spells([3, 'Guidance', 'Guiding Bolt']), features: [f(3, 'Star Map', long('wis')), f(3, 'Starry Form'), f(6, 'Cosmic Omen', long('wis')), f(10, 'Twinkling Constellations'), f(14, 'Full of Stars')] },

  {
    id: 'oath-of-the-ancients', classId: P, name: 'Oath of the Ancients', source: PHB24,
    spells: halfSpells(['Ensnaring Strike', 'Speak with Animals'], ['Misty Step', 'Moonbeam'], ['Plant Growth', 'Protection from Energy'], ['Ice Storm', 'Stoneskin'], ['Commune with Nature', 'Tree Stride']),
    features: [f(3, "Nature's Wrath"), f(3, 'Oath of the Ancients Spells'), f(7, 'Aura of Warding'), f(15, 'Undying Sentinel', long()), f(20, 'Elder Champion', long())],
  },
  {
    id: 'oath-of-glory', classId: P, name: 'Oath of Glory', source: PHB24,
    spells: halfSpells(['Guiding Bolt', 'Heroism'], ['Enhance Ability', 'Magic Weapon'], ['Haste', 'Protection from Energy'], ['Compulsion', 'Freedom of Movement'], ['Legend Lore', "Yolande's Regal Presence"]),
    features: [f(3, 'Inspiring Smite'), f(3, 'Peerless Athlete'), f(3, 'Oath of Glory Spells'), f(7, 'Aura of Alacrity', fx({ kind: 'speed', value: 10 })), f(15, 'Glorious Defense', long('cha')), f(20, 'Living Legend', long())],
  },
  {
    id: 'oath-of-vengeance', classId: P, name: 'Oath of Vengeance', source: PHB24,
    spells: halfSpells(['Bane', "Hunter's Mark"], ['Hold Person', 'Misty Step'], ['Haste', 'Protection from Energy'], ['Banishment', 'Dimension Door'], ['Hold Monster', 'Scrying']),
    features: [f(3, 'Vow of Enmity'), f(3, 'Oath of Vengeance Spells'), f(7, 'Relentless Avenger'), f(15, 'Soul of Vengeance'), f(20, 'Avenging Angel', long())],
  },

  { id: 'beast-master', classId: RG, name: 'Beast Master', source: PHB24, features: [f(3, 'Primal Companion'), f(7, 'Exceptional Training'), f(11, 'Bestial Fury'), f(15, 'Share Spells')] },
  {
    id: 'fey-wanderer', classId: RG, name: 'Fey Wanderer', source: PHB24, spells: halfSpells(['Charm Person'], ['Misty Step'], ['Summon Fey'], ['Dimension Door'], ['Mislead']),
    features: [f(3, 'Dreadful Strikes'), f(3, 'Fey Wanderer Spells'), f(3, 'Otherworldly Glamour'), f(7, 'Beguiling Twist'), f(11, 'Fey Reinforcements', long()), f(15, 'Misty Wanderer', long('wis'))],
  },
  {
    id: 'gloom-stalker', classId: RG, name: 'Gloom Stalker', source: PHB24, spells: halfSpells(['Disguise Self'], ['Rope Trick'], ['Fear'], ['Greater Invisibility'], ['Seeming']),
    features: [f(3, 'Dread Ambusher'), f(3, 'Gloom Stalker Spells'), f(3, 'Umbral Sight', fx(dark(60))), f(7, 'Iron Mind', fx(saveProf('wis'))), f(11, "Stalker's Flurry"), f(15, 'Shadowy Dodge')],
  },

  {
    id: 'aberrant-sorcery', classId: S, name: 'Aberrant Sorcery', source: PHB24,
    spells: spells2024(['Arms of Hadar', 'Calm Emotions', 'Detect Thoughts', 'Dissonant Whispers', 'Mind Sliver'], ['Hunger of Hadar', 'Sending'], ['Black Tentacles', 'Summon Aberration'], ['Telepathic Bond', 'Telekinesis']),
    features: [f(3, 'Psionic Spells'), f(3, 'Telepathic Speech'), f(6, 'Psionic Sorcery'), f(6, 'Psychic Defenses', fx(resist('psychic'), { kind: 'advantage', on: 'saves', when: 'against being charmed or frightened' })), f(14, 'Revelation in Flesh'), f(18, 'Warping Implosion', long())],
  },
  {
    id: 'clockwork-sorcery', classId: S, name: 'Clockwork Sorcery', source: PHB24,
    spells: spells2024(['Aid', 'Alarm', 'Lesser Restoration', 'Protection from Evil and Good'], ['Dispel Magic', 'Protection from Energy'], ['Freedom of Movement', 'Summon Construct'], ['Greater Restoration', 'Wall of Force']),
    features: [f(3, 'Clockwork Spells'), f(3, 'Restore Balance', long('cha')), f(6, 'Bastion of Law'), f(14, 'Trance of Order', long()), f(18, 'Clockwork Cavalcade', long())],
  },
  { id: 'wild-magic-sorcery', classId: S, name: 'Wild Magic Sorcery', source: PHB24, features: [f(3, 'Wild Magic Surge'), f(3, 'Tides of Chaos', long()), f(6, 'Bend Luck'), f(14, 'Controlled Chaos'), f(18, 'Tamed Surge', long())] },

  { id: 'abjurer', classId: W, name: 'Abjurer', source: PHB24, features: [f(3, 'Abjuration Savant'), f(3, 'Arcane Ward'), f(6, 'Projected Ward'), f(10, 'Spell Breaker'), f(14, 'Spell Resistance', fx({ kind: 'advantage', on: 'saves', when: 'against spells' }))] },
  { id: 'diviner', classId: W, name: 'Diviner', source: PHB24, features: [f(3, 'Divination Savant'), f(3, 'Portent', { uses: { count: 2, recharge: 'long', steps: [[3, 2], [14, 3]] } }), f(6, 'Expert Divination'), f(10, 'The Third Eye', short()), f(14, 'Greater Portent')] },
  { id: 'illusionist', classId: W, name: 'Illusionist', source: PHB24, features: [f(3, 'Illusion Savant'), f(3, 'Improved Illusions'), f(6, 'Phantasmal Creatures'), f(10, 'Illusory Self', short()), f(14, 'Illusory Reality')] },
]

export const CASTERS_REWRITTEN = [
  'glamour', 'valor', 'light', 'trickery', 'war', 'moon', 'stars', 'ancients', 'glory', 'vengeance', 'beast-master', 'fey-wanderer', 'gloom-stalker',
  'aberrant-mind', 'clockwork-soul', 'wild-magic', 'abjuration', 'divination', 'illusion',
]

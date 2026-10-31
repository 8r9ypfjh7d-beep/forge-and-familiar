// Feats from the official books (names, prerequisites and mechanics only). What each one does is our own short
// summary in i18n/locales/explain.feats.en/he.ts: why.feat.<id> for 2014 rules, why.feat2024.<id> for 2024 rules.
import { ABILITIES, type Ability, type Feat, type FeatEffect, type FeatRequires, type ItemEffect, type UsesCount } from '../../types'
import { ALL_SKILLS } from '../skills'
import { BGG, DSDQ, FTD, PHB, PHB24, TCE, XGE, dark, resist } from './helpers'

const SCC = 'Strixhaven: A Curriculum of Chaos'
const ERLW = 'Eberron: Rising from the Last War'
const EEPC = "Elemental Evil Player's Companion"
const PAITM = 'Planescape: Adventures in the Multiverse'

type Extra = Omit<Partial<Feat>, 'id' | 'name' | 'source'>
const feat = (id: string, name: string, source: string, extra: Extra = {}): Feat => ({ id, name, source, description: '', effects: [], ...extra })

/** +1 to one of these abilities, up to 20 (a "half feat"). */
const half = (...from: Ability[]): FeatEffect => ({ kind: 'abilityChoice', from: from.length ? from : [...ABILITIES], max: 20 })
const plus = (ability: Ability): FeatEffect => ({ kind: 'ability', ability, amount: 1 })
const min13 = (...abilities: Ability[]): FeatRequires => ({ abilities: Object.fromEntries(abilities.map(a => [a, 13])) })
const spell = (name: string, note: string): ItemEffect => ({ kind: 'spell', spell: name, note })
const longRest = (count: UsesCount = 1, label?: string): Feat['uses'] => ({ count, recharge: 'long', ...(label ? { label } : {}) })
const once = 'once per long rest without a slot'

// ---------- 2014 rules ----------

const PHB_FEATS: Feat[] = [
  feat('alert', 'Alert', PHB, { effects: [{ kind: 'initiative', amount: 5 }] }),
  feat('athlete', 'Athlete', PHB, { effects: [half('str', 'dex')] }),
  feat('actor', 'Actor', PHB, { effects: [plus('cha')] }),
  feat('charger', 'Charger', PHB),
  feat('crossbow-expert', 'Crossbow Expert', PHB),
  feat('defensive-duelist', 'Defensive Duelist', PHB, { prerequisite: 'Dexterity 13 or higher', requires: min13('dex') }),
  feat('dual-wielder', 'Dual Wielder', PHB),
  feat('dungeon-delver', 'Dungeon Delver', PHB, { stats: [resist('trap damage')] }),
  feat('durable', 'Durable', PHB, { effects: [plus('con')] }),
  feat('elemental-adept', 'Elemental Adept', PHB, { prerequisite: 'The ability to cast at least one spell', requires: { spellcasting: true } }),
  feat('great-weapon-master', 'Great Weapon Master', PHB),
  feat('healer', 'Healer', PHB),
  feat('heavily-armored', 'Heavily Armored', PHB, { prerequisite: 'Proficiency with medium armor', requires: { armor: 'medium' }, effects: [plus('str')], armor: ['heavy'] }),
  feat('heavy-armor-master', 'Heavy Armor Master', PHB, { prerequisite: 'Proficiency with heavy armor', requires: { armor: 'heavy' }, effects: [plus('str')] }),
  feat('inspiring-leader', 'Inspiring Leader', PHB, { prerequisite: 'Charisma 13 or higher', requires: min13('cha'), uses: { count: 1, recharge: 'short' } }),
  feat('keen-mind', 'Keen Mind', PHB, { effects: [plus('int')] }),
  feat('lightly-armored', 'Lightly Armored', PHB, { effects: [half('str', 'dex')], armor: ['light'] }),
  feat('linguist', 'Linguist', PHB, { effects: [plus('int')] }),
  feat('lucky', 'Lucky', PHB, { uses: longRest(3) }),
  feat('mage-slayer', 'Mage Slayer', PHB),
  feat('magic-initiate', 'Magic Initiate', PHB),
  feat('martial-adept', 'Martial Adept', PHB, { uses: { count: 1, recharge: 'short', label: 'Superiority Die' } }),
  feat('medium-armor-master', 'Medium Armor Master', PHB, { prerequisite: 'Proficiency with medium armor', requires: { armor: 'medium' } }),
  feat('mobile', 'Mobile', PHB, { effects: [{ kind: 'speed', amount: 10 }] }),
  feat('moderately-armored', 'Moderately Armored', PHB, { prerequisite: 'Proficiency with light armor', requires: { armor: 'light' }, effects: [half('str', 'dex')], armor: ['medium', 'shield'] }),
  feat('mounted-combatant', 'Mounted Combatant', PHB),
  feat('observant', 'Observant', PHB, { effects: [half('int', 'wis')], stats: [{ kind: 'passivePerception', value: 5 }] }),
  feat('polearm-master', 'Polearm Master', PHB),
  feat('resilient', 'Resilient', PHB, { effects: [{ kind: 'abilityChoice', from: [...ABILITIES], max: 20, save: true }] }),
  feat('ritual-caster', 'Ritual Caster', PHB, { prerequisite: 'Intelligence or Wisdom 13 or higher', requires: min13('int', 'wis') }),
  feat('savage-attacker', 'Savage Attacker', PHB),
  feat('sentinel', 'Sentinel', PHB),
  feat('sharpshooter', 'Sharpshooter', PHB),
  feat('shield-master', 'Shield Master', PHB),
  feat('skilled', 'Skilled', PHB, { effects: [{ kind: 'skillPicks', count: 3 }] }),
  feat('skulker', 'Skulker', PHB, { prerequisite: 'Dexterity 13 or higher', requires: min13('dex') }),
  feat('spell-sniper', 'Spell Sniper', PHB, { prerequisite: 'The ability to cast at least one spell', requires: { spellcasting: true } }),
  feat('tavern-brawler', 'Tavern Brawler', PHB, { effects: [half('str', 'con')] }),
  feat('tough', 'Tough', PHB, { effects: [{ kind: 'hpPerLevel', amount: 2 }] }),
  feat('war-caster', 'War Caster', PHB, { prerequisite: 'The ability to cast at least one spell', requires: { spellcasting: true }, stats: [{ kind: 'advantage', on: 'concentration' }] }),
  feat('weapon-master', 'Weapon Master', PHB, { effects: [half('str', 'dex')] }),
]

const racial = (id: string, name: string, races: string[], label: string, extra: Extra = {}): Feat =>
  feat(id, name, XGE, { category: 'racial', prerequisite: label, requires: { races }, ...extra })

const XGE_FEATS: Feat[] = [
  racial('bountiful-luck', 'Bountiful Luck', ['halfling'], 'Halfling'),
  racial('dragon-fear', 'Dragon Fear', ['dragonborn'], 'Dragonborn', { effects: [half('str', 'con', 'cha')] }),
  racial('dragon-hide', 'Dragon Hide', ['dragonborn'], 'Dragonborn', { effects: [half('str', 'con', 'cha')] }),
  racial('drow-high-magic', 'Drow High Magic', ['drow', 'dark-elf'], 'Elf (drow)', { stats: [spell('Detect Magic', 'at will'), spell('Levitate', once), spell('Dispel Magic', once)] }),
  racial('dwarven-fortitude', 'Dwarven Fortitude', ['dwarf'], 'Dwarf', { effects: [plus('con')] }),
  racial('elven-accuracy', 'Elven Accuracy', ['elf', 'half-elf'], 'Elf or half-elf', { effects: [half('dex', 'int', 'wis', 'cha')] }),
  racial('fade-away', 'Fade Away', ['gnome'], 'Gnome', { effects: [half('dex', 'int')], uses: { count: 1, recharge: 'short' } }),
  racial('fey-teleportation', 'Fey Teleportation', ['high-elf'], 'Elf (high elf)', { effects: [half('int', 'cha')], stats: [spell('Misty Step', 'once per short rest without a slot')] }),
  racial('flames-of-phlegethos', 'Flames of Phlegethos', ['tiefling'], 'Tiefling', { effects: [half('int', 'cha')] }),
  racial('infernal-constitution', 'Infernal Constitution', ['tiefling'], 'Tiefling', {
    effects: [plus('con')], stats: [resist('cold'), resist('poison'), { kind: 'advantage', on: 'save:con', when: 'against being poisoned' }],
  }),
  racial('orcish-fury', 'Orcish Fury', ['half-orc', 'orc'], 'Half-orc', { effects: [half('str', 'con')], uses: { count: 1, recharge: 'short' } }),
  racial('prodigy', 'Prodigy', ['human', 'half-elf', 'half-orc'], 'Half-elf, half-orc or human', { effects: [{ kind: 'skillPicks', count: 1 }] }),
  racial('second-chance', 'Second Chance', ['halfling'], 'Halfling', { effects: [half('dex', 'con', 'cha')], uses: { count: 1, recharge: 'short' } }),
  racial('squat-nimbleness', 'Squat Nimbleness', ['dwarf', 'gnome', 'halfling'], 'Dwarf or a Small race', { effects: [half('str', 'dex'), { kind: 'speed', amount: 5 }] }),
  racial('wood-elf-magic', 'Wood Elf Magic', ['wood-elf'], 'Elf (wood elf)', { stats: [spell('Longstrider', once), spell('Pass without Trace', once)] }),
]

const TCE_FEATS: Feat[] = [
  feat('artificer-initiate', 'Artificer Initiate', TCE),
  feat('chef', 'Chef', TCE, { effects: [half('con', 'wis')], uses: longRest('pb', 'Treats') }),
  feat('crusher', 'Crusher', TCE, { effects: [half('str', 'con')] }),
  feat('eldritch-adept', 'Eldritch Adept', TCE, { prerequisite: 'Spellcasting or Pact Magic feature', requires: { spellcasting: true } }),
  feat('fey-touched', 'Fey Touched', TCE, { effects: [half('int', 'wis', 'cha')], stats: [spell('Misty Step', once)] }),
  feat('fighting-initiate', 'Fighting Initiate', TCE, { prerequisite: 'Proficiency with a martial weapon' }),
  feat('gunner', 'Gunner', TCE, { effects: [plus('dex')] }),
  feat('metamagic-adept', 'Metamagic Adept', TCE, { prerequisite: 'Spellcasting or Pact Magic feature', requires: { spellcasting: true }, uses: longRest(2, 'Sorcery Points') }),
  feat('piercer', 'Piercer', TCE, { effects: [half('str', 'dex')] }),
  feat('poisoner', 'Poisoner', TCE),
  feat('shadow-touched', 'Shadow Touched', TCE, { effects: [half('int', 'wis', 'cha')], stats: [spell('Invisibility', once)] }),
  feat('skill-expert', 'Skill Expert', TCE, { effects: [half(), { kind: 'skillPicks', count: 1 }] }),
  feat('slasher', 'Slasher', TCE, { effects: [half('str', 'dex')] }),
  feat('telekinetic', 'Telekinetic', TCE, { effects: [half('int', 'wis', 'cha')], stats: [spell('Mage Hand', 'invisible, no components')] }),
  feat('telepathic', 'Telepathic', TCE, { effects: [half('int', 'wis', 'cha')], stats: [spell('Detect Thoughts', once)] }),
]

const giant = (id: string, name: string, stats: ItemEffect[] = []): Feat =>
  feat(id, name, BGG, { minLevel: 4, prerequisite: '4th level, Strike of the Giants feat of the same giant', requires: { feats: ['strike-of-the-giants'] }, effects: [half('str', 'con', 'wis')], stats, uses: longRest('pb') })
const highSorcery = (id: string, name: string, label: string): Feat =>
  feat(id, name, DSDQ, { minLevel: 4, prerequisite: '4th level, Initiate of High Sorcery feat', requires: { feats: ['initiate-of-high-sorcery'] }, effects: [half('int', 'wis', 'cha')], uses: longRest('pb', label) })
const knight = (id: string, name: string, effect: FeatEffect): Feat =>
  feat(id, name, DSDQ, { minLevel: 4, prerequisite: '4th level, Squire of Solamnia feat', requires: { feats: ['squire-of-solamnia'] }, effects: [effect], uses: longRest('pb') })
const planar = (id: string, name: string, extra: Extra = {}): Feat =>
  feat(id, name, PAITM, { minLevel: 4, prerequisite: '4th level, Scion of the Outer Planes feat', requires: { feats: ['scion-of-the-outer-planes'] }, effects: [half('int', 'wis', 'cha')], ...extra })

/** Feats from setting books and supplements, playable under either rules edition. */
const SETTING_FEATS: Feat[] = [
  feat('gift-of-the-chromatic-dragon', 'Gift of the Chromatic Dragon', FTD, { uses: longRest('pb', 'Reactive Resistance') }),
  feat('gift-of-the-gem-dragon', 'Gift of the Gem Dragon', FTD, { effects: [half('int', 'wis', 'cha')], uses: longRest('pb') }),
  feat('gift-of-the-metallic-dragon', 'Gift of the Metallic Dragon', FTD, { stats: [spell('Cure Wounds', once)], uses: longRest('pb', 'Protective Wings') }),
  feat('aberrant-dragonmark', 'Aberrant Dragonmark', ERLW, { prerequisite: 'No other dragonmark', effects: [plus('con')], uses: { count: 1, recharge: 'short' } }),
  feat('svirfneblin-magic', 'Svirfneblin Magic', EEPC, { category: 'racial', prerequisite: 'Gnome (deep gnome)', requires: { races: ['deep-gnome', 'svirfneblin', 'gnome'] }, stats: [spell('Nondetection', 'at will on yourself'), spell('Blindness/Deafness', once), spell('Blur', once), spell('Disguise Self', once)] }),
  feat('strixhaven-initiate', 'Strixhaven Initiate', SCC),
  feat('strixhaven-mascot', 'Strixhaven Mascot', SCC, { minLevel: 4, prerequisite: '4th level, Strixhaven Initiate feat', requires: { feats: ['strixhaven-initiate'] } }),
  feat('strike-of-the-giants', 'Strike of the Giants', BGG, { category: 'origin', prerequisite: 'Martial weapon proficiency or the Giant Foundling background', uses: longRest('pb', 'Strike of the Giants') }),
  feat('rune-shaper', 'Rune Shaper', BGG, { category: 'origin', uses: longRest(1, 'Rune spell') }),
  giant('ember-of-the-fire-giant', 'Ember of the Fire Giant', [resist('fire')]),
  giant('fury-of-the-frost-giant', 'Fury of the Frost Giant', [resist('cold')]),
  giant('guile-of-the-cloud-giant', 'Guile of the Cloud Giant'),
  giant('keenness-of-the-stone-giant', 'Keenness of the Stone Giant', [dark(60)]),
  giant('soul-of-the-storm-giant', 'Soul of the Storm Giant'),
  giant('vigor-of-the-hill-giant', 'Vigor of the Hill Giant'),
  feat('initiate-of-high-sorcery', 'Initiate of High Sorcery', DSDQ, { category: 'origin' }),
  highSorcery('adept-of-the-black-robes', 'Adept of the Black Robes', 'Life Channel'),
  highSorcery('adept-of-the-red-robes', 'Adept of the Red Robes', 'Magical Balance'),
  highSorcery('adept-of-the-white-robes', 'Adept of the White Robes', 'Protective Magic'),
  feat('divinely-favored', 'Divinely Favored', DSDQ, { category: 'origin' }),
  feat('squire-of-solamnia', 'Squire of Solamnia', DSDQ, { category: 'origin', uses: longRest('pb', 'Precise Strike') }),
  knight('knight-of-the-crown', 'Knight of the Crown', half('str', 'dex', 'con')),
  knight('knight-of-the-rose', 'Knight of the Rose', half('str', 'dex', 'cha')),
  knight('knight-of-the-sword', 'Knight of the Sword', half('str', 'dex', 'int')),
  feat('scion-of-the-outer-planes', 'Scion of the Outer Planes', PAITM, { category: 'origin' }),
  planar('agent-of-order', 'Agent of Order', { stats: [resist('force')], uses: longRest('pb', 'Stasis Strike') }),
  planar('baleful-scion', 'Baleful Scion', { stats: [resist('necrotic')], uses: longRest('pb', 'Grasp of Avarice') }),
  planar('cohort-of-chaos', 'Cohort of Chaos', { uses: longRest('pb', 'Chaotic Flare') }),
  planar('outlands-envoy', 'Outlands Envoy', { stats: [spell('Misty Step', once), spell('Tongues', once)] }),
  planar('planar-wanderer', 'Planar Wanderer', { stats: [resist('one type you pick each long rest')] }),
  planar('righteous-heritor', 'Righteous Heritor', { stats: [resist('radiant')], uses: longRest('pb', 'Soothe Pain') }),
  planar('gate-warden', 'Gate Warden', { stats: [spell('Banishment', once), spell('Misty Step', once)] }),
]

/** 2014 feats beyond the SRD's Grappler. */
export const BOOK_FEATS: Feat[] = [...PHB_FEATS, ...XGE_FEATS, ...TCE_FEATS, ...SETTING_FEATS].map(f => ({ ...f, category: f.category ?? 'general' }))

// ---------- 2024 rules ----------

type Extra24 = Omit<Extra, 'effects'> & { effects?: FeatEffect[] }
const origin = (id: string, name: string, extra: Extra = {}): Feat => feat(id, name, PHB24, { category: 'origin', ...extra })
/** A 2024 general feat: level 4+, +1 to one of `from` (up to 20), plus its other effects. */
const general = (id: string, name: string, from: Ability[], prerequisite?: string, extra: Extra24 = {}): Feat =>
  feat(id, name, PHB24, {
    category: 'general', minLevel: 4, prerequisite: prerequisite ? `Level 4+, ${prerequisite}` : 'Level 4+',
    ...extra, effects: [{ kind: 'abilityChoice', from, max: 20 }, ...(extra.effects ?? [])],
  })
const style = (id: string, name: string, extra: Extra = {}): Feat =>
  feat(id, name, PHB24, { category: 'fighting-style', prerequisite: 'Fighting Style feature', requires: { feature: 'Fighting Style' }, ...extra })
const boon = (id: string, name: string, extra: Extra24 = {}, from: Ability[] = [...ABILITIES]): Feat =>
  feat(id, name, PHB24, { category: 'epic-boon', minLevel: 19, prerequisite: 'Level 19+', ...extra, effects: [{ kind: 'abilityChoice', from, max: 30 }, ...(extra.effects ?? [])] })

const STR_DEX: Ability[] = ['str', 'dex']
const MENTAL: Ability[] = ['int', 'wis', 'cha']

const PHB24_FEATS: Feat[] = [
  origin('crafter', 'Crafter'),
  origin('healer', 'Healer'),
  origin('lucky', 'Lucky', { uses: longRest('pb', 'Luck Points') }),
  origin('musician', 'Musician'),
  origin('tavern-brawler', 'Tavern Brawler'),
  origin('tough', 'Tough', { effects: [{ kind: 'hpPerLevel', amount: 2 }] }),

  general('actor', 'Actor', ['cha'], 'Charisma 13+', { requires: min13('cha') }),
  general('athlete', 'Athlete', STR_DEX, 'Strength or Dexterity 13+', { requires: min13('str', 'dex'), stats: [{ kind: 'moveSpeed', mode: 'climb', value: 0 }] }),
  general('charger', 'Charger', STR_DEX, 'Strength or Dexterity 13+', { requires: min13('str', 'dex') }),
  general('chef', 'Chef', ['con', 'wis'], undefined, { uses: longRest('pb', 'Treats') }),
  general('crossbow-expert', 'Crossbow Expert', ['dex'], 'Dexterity 13+', { requires: min13('dex') }),
  general('crusher', 'Crusher', ['str', 'con']),
  general('defensive-duelist', 'Defensive Duelist', ['dex'], 'Dexterity 13+', { requires: min13('dex') }),
  general('dual-wielder', 'Dual Wielder', STR_DEX, 'Strength or Dexterity 13+', { requires: min13('str', 'dex') }),
  general('durable', 'Durable', ['con']),
  general('elemental-adept', 'Elemental Adept', MENTAL, 'Spellcasting or Pact Magic feature', { requires: { spellcasting: true } }),
  general('fey-touched', 'Fey Touched', MENTAL, undefined, { stats: [spell('Misty Step', once)] }),
  general('great-weapon-master', 'Great Weapon Master', ['str'], 'Strength 13+', { requires: min13('str') }),
  general('heavily-armored', 'Heavily Armored', ['con', 'str'], 'Medium Armor training', { requires: { armor: 'medium' }, armor: ['heavy'] }),
  general('heavy-armor-master', 'Heavy Armor Master', ['con', 'str'], 'Heavy Armor training', { requires: { armor: 'heavy' } }),
  general('inspiring-leader', 'Inspiring Leader', ['wis', 'cha'], 'Wisdom or Charisma 13+', { requires: min13('wis', 'cha') }),
  general('keen-mind', 'Keen Mind', ['int'], 'Intelligence 13+', { requires: min13('int') }),
  general('lightly-armored', 'Lightly Armored', STR_DEX, undefined, { armor: ['light', 'shield'] }),
  general('mage-slayer', 'Mage Slayer', STR_DEX),
  general('martial-weapon-training', 'Martial Weapon Training', STR_DEX, undefined, { weapons: ['martial'] }),
  general('medium-armor-master', 'Medium Armor Master', STR_DEX, 'Medium Armor training', { requires: { armor: 'medium' } }),
  general('moderately-armored', 'Moderately Armored', STR_DEX, 'Light Armor training', { requires: { armor: 'light' }, armor: ['medium'] }),
  general('mounted-combatant', 'Mounted Combatant', ['str', 'dex', 'wis']),
  general('observant', 'Observant', ['int', 'wis'], 'Intelligence or Wisdom 13+', { requires: min13('int', 'wis') }),
  general('piercer', 'Piercer', STR_DEX),
  general('poisoner', 'Poisoner', ['dex', 'int']),
  general('polearm-master', 'Polearm Master', STR_DEX, 'Strength or Dexterity 13+', { requires: min13('str', 'dex') }),
  feat('resilient', 'Resilient', PHB24, { category: 'general', minLevel: 4, prerequisite: 'Level 4+', effects: [{ kind: 'abilityChoice', from: [...ABILITIES], max: 20, save: true }] }),
  general('ritual-caster', 'Ritual Caster', MENTAL, 'Intelligence, Wisdom or Charisma 13+', { requires: min13('int', 'wis', 'cha') }),
  general('sentinel', 'Sentinel', STR_DEX, 'Strength or Dexterity 13+', { requires: min13('str', 'dex') }),
  general('shadow-touched', 'Shadow Touched', MENTAL, undefined, { stats: [spell('Invisibility', once)] }),
  general('sharpshooter', 'Sharpshooter', ['dex'], 'Dexterity 13+', { requires: min13('dex') }),
  general('shield-master', 'Shield Master', ['str'], 'Shield training', { requires: { armor: 'shield' } }),
  general('skill-expert', 'Skill Expert', [...ABILITIES], undefined, { effects: [{ kind: 'skillPicks', count: 1 }] }),
  general('skulker', 'Skulker', ['dex'], 'Dexterity 13+', { requires: min13('dex'), stats: [{ kind: 'sense', sense: 'blindsight', value: 10 }] }),
  general('slasher', 'Slasher', STR_DEX),
  general('speedy', 'Speedy', ['dex', 'con'], 'Dexterity or Constitution 13+', { requires: min13('dex', 'con'), effects: [{ kind: 'speed', amount: 10 }] }),
  general('spell-sniper', 'Spell Sniper', MENTAL, 'Spellcasting or Pact Magic feature', { requires: { spellcasting: true } }),
  general('telekinetic', 'Telekinetic', MENTAL, undefined, { stats: [spell('Mage Hand', 'invisible, no components')] }),
  general('telepathic', 'Telepathic', MENTAL, undefined, { stats: [spell('Detect Thoughts', once)] }),
  general('war-caster', 'War Caster', MENTAL, 'Spellcasting or Pact Magic feature', { requires: { spellcasting: true }, stats: [{ kind: 'advantage', on: 'concentration' }] }),
  general('weapon-master', 'Weapon Master', STR_DEX),

  style('blind-fighting', 'Blind Fighting', { stats: [{ kind: 'sense', sense: 'blindsight', value: 10 }] }),
  style('dueling', 'Dueling'),
  style('interception', 'Interception'),
  style('protection', 'Protection'),
  style('thrown-weapon-fighting', 'Thrown Weapon Fighting'),
  style('unarmed-fighting', 'Unarmed Fighting'),

  boon('boon-of-energy-resistance', 'Boon of Energy Resistance'),
  boon('boon-of-fortitude', 'Boon of Fortitude', { stats: [{ kind: 'hp', value: 40 }] }),
  boon('boon-of-recovery', 'Boon of Recovery', { uses: longRest(1, 'Last Stand') }),
  boon('boon-of-skill', 'Boon of Skill', { stats: ALL_SKILLS.map(skill => ({ kind: 'skillProficiency', skill })) }),
  boon('boon-of-speed', 'Boon of Speed', { effects: [{ kind: 'speed', amount: 30 }] }),
]

const HOF = 'Forgotten Realms: Heroes of Faerûn'
const FOTA = 'Eberron: Forge of the Artificer'
const ABOH = "Astarion's Book of Hungers"
const RTHW = 'Ravenloft: The Horrors Within'
const AU = 'Arcana Unleashed'
const LFL = 'Lorwyn: First Light'
const PS = 'Pact Seeker'
const o = (source: string) => (id: string, name: string): Feat => feat(id, name, source, { category: 'origin' })

/** Origin feats from books printed for the 2024 rules; backgrounds from those books grant them. */
const ORIGIN_2024_BOOKS: Feat[] = [
  ...[
    ['cult-of-the-dragon-initiate', 'Cult of the Dragon Initiate'], ['emerald-enclave-fledgling', 'Emerald Enclave Fledgling'], ['harper-agent', 'Harper Agent'],
    ['lords-alliance-agent', "Lords' Alliance Agent"], ['purple-dragon-rook', 'Purple Dragon Rook'], ['spellfire-spark', 'Spellfire Spark'],
    ['tyro-of-the-gauntlet', 'Tyro of the Gauntlet'], ['zhentarim-ruffian', 'Zhentarim Ruffian'],
  ].map(([id, name]) => o(HOF)(id, name)),
  feat('aberrant-dragonmark', 'Aberrant Dragonmark', FOTA, { category: 'origin', uses: { count: 1, recharge: 'short' } }),
  ...['Making', 'Sentinel', 'Hospitality', 'Healing', 'Warding', 'Storm', 'Detection', 'Passage', 'Shadow', 'Scribing', 'Finding', 'Handling']
    .map(m => o(FOTA)(`mark-of-${m.toLowerCase()}`, `Mark of ${m}`)),
  o(ABOH)('tireless-reveler', 'Tireless Reveler'), o(ABOH)('vampires-plaything', "Vampire's Plaything"), o(ABOH)('vampire-hunter', 'Vampire Hunter'),
  o(LFL)('child-of-the-sun', 'Child of the Sun'), o(LFL)('shadowmoor-hexer', 'Shadowmoor Hexer'), o(PS)('planar-pact', 'Planar Pact'),
  o(RTHW)('survivor', 'Survivor'), o(RTHW)('sharp-eye', 'Sharp Eye'), o(RTHW)('dark-gift', 'Dark Gift'),
  ...[
    ['arcane-infiltrator', 'Arcane Infiltrator'], ['arcane-eloquence', 'Arcane Eloquence'], ['transmuted-anatomy', 'Transmuted Anatomy'],
    ['arcane-undertaker', 'Arcane Undertaker'], ['arcane-overload', 'Arcane Overload'], ['familiar-friend', 'Familiar Friend'],
    ['portal-jumper', 'Portal Jumper'], ['arcane-artist', 'Arcane Artist'], ['arcane-omens', 'Arcane Omens'], ['arcane-safeguard', 'Arcane Safeguard'],
  ].map(([id, name]) => o(AU)(id, name)),
]

/** 2014 feats the 2024 book dropped or reprinted are left out; the rest can still be taken (the 2024 rules allow older feats). */
const REPRINTED = new Set([...PHB24_FEATS, ...ORIGIN_2024_BOOKS].map(f => f.id).concat(['alert', 'magic-initiate', 'savage-attacker', 'skilled', 'grappler']))
const LEGACY = new Set(['dungeon-delver', 'linguist', 'martial-adept'])

/** Older feats under 2024 rules: general feats need level 4, origin and racial feats keep their category. */
const legacy = (f: Feat): Feat => (f.category === 'origin' || f.category === 'racial' ? f : { ...f, category: 'general', minLevel: Math.max(4, f.minLevel ?? 4) })

export const BOOK_FEATS_2024: Feat[] = [
  ...PHB24_FEATS,
  ...ORIGIN_2024_BOOKS,
  ...PHB_FEATS.filter(f => LEGACY.has(f.id)).map(legacy),
  ...[...XGE_FEATS, ...TCE_FEATS, ...SETTING_FEATS].filter(f => !REPRINTED.has(f.id)).map(legacy),
]

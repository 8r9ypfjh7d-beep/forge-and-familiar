// 2024-rules subclasses from Forgotten Realms: Heroes of Faerûn (2025), names, levels and mechanics only.
import { FRHOF, f, fx, halfSpells, long, resist, saveProf, spells, type Def } from './helpers'

export const FAERUN_2024: Def[] = [
  { id: 'college-of-the-moon', classId: 'bard', name: 'College of the Moon', source: FRHOF, features: [f(3, "Moon's Inspiration"), f(3, 'Primal Lore'), f(6, 'Blessing of Moonlight', long()), f(14, "Eventide's Splendor")] },
  {
    id: 'knowledge-domain', classId: 'cleric', name: 'Knowledge Domain', source: FRHOF,
    spells: spells([3, 'Command', 'Comprehend Languages', 'Detect Magic', 'Detect Thoughts', 'Identify', 'Mind Spike'], [5, 'Dispel Magic', 'Nondetection', 'Tongues'], [7, 'Arcane Eye', 'Banishment', 'Confusion'], [9, 'Legend Lore', 'Scrying', 'Synaptic Static']),
    features: [f(3, 'Blessings of Knowledge'), f(3, 'Knowledge Domain Spells'), f(3, 'Mind Magic'), f(6, 'Unfettered Mind', fx(saveProf('int'))), f(17, 'Divine Foreknowledge', long())],
  },
  { id: 'banneret', classId: 'fighter', name: 'Banneret', source: FRHOF, features: [f(3, 'Knightly Envoy'), f(3, 'Group Recovery'), f(7, 'Team Tactics'), f(10, 'Rallying Surge'), f(15, 'Shared Resilience'), f(18, 'Inspiring Commander', fx({ kind: 'conditionImmunity', condition: 'charmed' }, { kind: 'conditionImmunity', condition: 'frightened' }))] },
  {
    id: 'oath-of-the-noble-genies', classId: 'paladin', name: 'Oath of the Noble Genies', source: FRHOF,
    spells: halfSpells(['Chromatic Orb', 'Thunderous Smite'], ['Mirror Image', 'Phantasmal Force'], ['Fly', 'Gaseous Form'], ['Conjure Minor Elementals', 'Summon Elemental'], ['Banishing Smite', 'Contact Other Plane']),
    features: [f(3, 'Elemental Smite'), f(3, "Genie's Splendor"), f(3, 'Oath of the Noble Genies Spells'), f(7, 'Aura of Elemental Shielding'), f(15, 'Elemental Rebuke'), f(20, 'Noble Scion', long())],
  },
  {
    id: 'winter-walker', classId: 'ranger', name: 'Winter Walker', source: FRHOF,
    spells: halfSpells(['Ice Knife'], ['Hold Person'], ['Remove Curse'], ['Ice Storm'], ['Cone of Cold']),
    features: [f(3, 'Frigid Explorer', fx(resist('cold'))), f(3, "Hunter's Rime"), f(3, 'Winter Walker Spells'), f(7, 'Fortifying Soul', long()), f(11, 'Chilling Retribution', long('wis')), f(15, 'Frozen Haunt', long())],
  },
  { id: 'scion-of-the-three', classId: 'rogue', name: 'Scion of the Three', source: FRHOF, features: [f(3, 'Bloodthirst'), f(3, 'Dread Allegiance'), f(9, 'Strike Fear'), f(13, 'Aura of Malevolence'), f(17, 'Dread Incarnate')] },
  {
    id: 'spellfire-sorcery', classId: 'sorcerer', name: 'Spellfire Sorcery', source: FRHOF,
    spells: spells([3, 'Cure Wounds', 'Guiding Bolt', 'Lesser Restoration', 'Scorching Ray'], [5, 'Aura of Vitality', 'Dispel Magic'], [6, 'Counterspell'], [7, 'Fire Shield', 'Wall of Fire'], [9, 'Flame Strike', 'Greater Restoration']),
    features: [f(3, 'Spellfire Burst'), f(3, 'Spellfire Spells'), f(6, 'Absorb Spells'), f(14, 'Honed Spellfire'), f(18, 'Crown of Spellfire', long())],
  },
  { id: 'bladesinger', classId: 'wizard', name: 'Bladesinger', source: FRHOF, features: [f(3, 'Training in War and Song'), f(3, 'Bladesong', long('int')), f(6, 'Extra Attack'), f(10, 'Song of Defense'), f(14, 'Song of Victory')] },
]

/** 2014 subclasses this book rewrote for 2024 rules. */
export const FAERUN_REWRITTEN = ['knowledge', 'purple-dragon-knight', 'bladesinging']
/** The rewritten ids' new 2024 ids, so 2024 characters saved before this book keep their subclass. */
export const FAERUN_RENAMED: Record<string, string> = { knowledge: 'knowledge-domain', 'purple-dragon-knight': 'banneret', bladesinging: 'bladesinger' }

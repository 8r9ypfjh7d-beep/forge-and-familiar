// Warlock Eldritch Invocations and Pact Boons, 2014 (PHB, Xanathar's, Tasha's) and 2024 (PHB 2024).
// Names, prerequisites and mechanics only; what each does is our own summary in locales/explain.invocations.*.ts.
import type { ClassOption } from '../../classOptions'
import type { ItemEffect, SkillId } from '../../types'
import { PHB, PHB24, TCE, XGE } from './helpers'

type Extra = Omit<ClassOption, 'id' | 'kind' | 'name' | 'source' | 'edition' | 'classIds'>

const make = (kind: 'invocation' | 'pactBoon', edition: '2014' | '2024', source: string) =>
  (id: string, name: string, extra: Extra = {}): ClassOption =>
    ({ id: edition === '2024' ? `${id}-2024` : id, kind, name, source, edition, classIds: ['warlock'], ...extra })

const atWill = (...names: string[]) => ({ spells: names.map(name => ({ name, note: 'at will' })) })
/** A spell cast once per long rest (2014: with a warlock spell slot). */
const oncePerLong = (name: string, note = 'once per long rest') => ({ spells: [{ name, note }], uses: { count: 1 as const, recharge: 'long' as const } })
const skill = (s: SkillId): ItemEffect => ({ kind: 'skillProficiency', skill: s })
const EB = { prerequisite: 'Eldritch Blast cantrip' }
const HEX = { prerequisite: 'Hex spell or a warlock feature that curses' }

const pact14 = make('pactBoon', '2014', PHB)
/** 2014 Pact Boons, picked at warlock level 3. */
export const PACT_BOONS: ClassOption[] = [
  pact14('pact-of-the-chain', 'Pact of the Chain', { minLevel: 3, spells: [{ name: 'Find Familiar', note: 'ritual' }] }),
  pact14('pact-of-the-blade', 'Pact of the Blade', { minLevel: 3 }),
  pact14('pact-of-the-tome', 'Pact of the Tome', { minLevel: 3 }),
  { ...pact14('pact-of-the-talisman', 'Pact of the Talisman', { minLevel: 3, uses: { count: 'pb', recharge: 'long' } }), source: TCE },
]

const BLADE = ['pact-of-the-blade']
const CHAIN = ['pact-of-the-chain']
const TOME = ['pact-of-the-tome']
const TALISMAN = ['pact-of-the-talisman']

const p = make('invocation', '2014', PHB)
const x = make('invocation', '2014', XGE)
const t = make('invocation', '2014', TCE)

/** 2014 invocations: Player's Handbook, Xanathar's Guide, Tasha's Cauldron. Levels are warlock levels. */
export const INVOCATIONS: ClassOption[] = [
  p('agonizing-blast', 'Agonizing Blast', EB),
  p('armor-of-shadows', 'Armor of Shadows', atWill('Mage Armor')),
  p('ascendant-step', 'Ascendant Step', { minLevel: 9, ...atWill('Levitate') }),
  x('aspect-of-the-moon', 'Aspect of the Moon', { requires: TOME }),
  p('beast-speech', 'Beast Speech', atWill('Speak with Animals')),
  p('beguiling-influence', 'Beguiling Influence', { effects: [skill('deception'), skill('persuasion')] }),
  p('bewitching-whispers', 'Bewitching Whispers', { minLevel: 7, ...oncePerLong('Compulsion') }),
  t('bond-of-the-talisman', 'Bond of the Talisman', { minLevel: 12, requires: TALISMAN, uses: { count: 'pb', recharge: 'long' } }),
  p('book-of-ancient-secrets', 'Book of Ancient Secrets', { requires: TOME }),
  p('chains-of-carceri', 'Chains of Carceri', { minLevel: 15, requires: CHAIN, ...atWill('Hold Monster') }),
  x('cloak-of-flies', 'Cloak of Flies', { minLevel: 5, uses: { count: 1, recharge: 'short' } }),
  p('devils-sight', "Devil's Sight", { effects: [{ kind: 'sense', sense: 'darkvision', value: 120 }] }),
  p('dreadful-word', 'Dreadful Word', { minLevel: 7, ...oncePerLong('Confusion') }),
  t('eldritch-mind', 'Eldritch Mind', { effects: [{ kind: 'advantage', on: 'concentration' }] }),
  p('eldritch-sight', 'Eldritch Sight', atWill('Detect Magic')),
  x('eldritch-smite', 'Eldritch Smite', { minLevel: 5, requires: BLADE }),
  p('eldritch-spear', 'Eldritch Spear', EB),
  p('eyes-of-the-rune-keeper', 'Eyes of the Rune Keeper'),
  t('far-scribe', 'Far Scribe', { minLevel: 5, requires: TOME, ...atWill('Sending') }),
  p('fiendish-vigor', 'Fiendish Vigor', atWill('False Life')),
  p('gaze-of-two-minds', 'Gaze of Two Minds'),
  x('ghostly-gaze', 'Ghostly Gaze', { minLevel: 7, uses: { count: 1, recharge: 'short' } }),
  x('gift-of-the-depths', 'Gift of the Depths', { minLevel: 5, effects: [{ kind: 'moveSpeed', mode: 'swim', value: 0 }], ...oncePerLong('Water Breathing') }),
  x('gift-of-the-ever-living-ones', 'Gift of the Ever-Living Ones', { requires: CHAIN }),
  t('gift-of-the-protectors', 'Gift of the Protectors', { minLevel: 9, requires: TOME, uses: { count: 1, recharge: 'long' } }),
  x('grasp-of-hadar', 'Grasp of Hadar', EB),
  x('improved-pact-weapon', 'Improved Pact Weapon', { requires: BLADE }),
  t('investment-of-the-chain-master', 'Investment of the Chain Master', { requires: CHAIN }),
  x('lance-of-lethargy', 'Lance of Lethargy', EB),
  p('lifedrinker', 'Lifedrinker', { minLevel: 12, requires: BLADE }),
  x('maddening-hex', 'Maddening Hex', { minLevel: 5, ...HEX }),
  p('mask-of-many-faces', 'Mask of Many Faces', atWill('Disguise Self')),
  p('master-of-myriad-forms', 'Master of Myriad Forms', { minLevel: 15, ...atWill('Alter Self') }),
  p('minions-of-chaos', 'Minions of Chaos', { minLevel: 9, ...oncePerLong('Conjure Elemental') }),
  p('mire-the-mind', 'Mire the Mind', { minLevel: 5, ...oncePerLong('Slow') }),
  p('misty-visions', 'Misty Visions', atWill('Silent Image')),
  p('one-with-shadows', 'One with Shadows', { minLevel: 5 }),
  p('otherworldly-leap', 'Otherworldly Leap', { minLevel: 9, ...atWill('Jump') }),
  t('protection-of-the-talisman', 'Protection of the Talisman', { minLevel: 7, requires: TALISMAN, uses: { count: 'pb', recharge: 'long' } }),
  t('rebuke-of-the-talisman', 'Rebuke of the Talisman', { requires: TALISMAN }),
  x('relentless-hex', 'Relentless Hex', { minLevel: 7, ...HEX }),
  p('repelling-blast', 'Repelling Blast', EB),
  p('sculptor-of-flesh', 'Sculptor of Flesh', { minLevel: 7, ...oncePerLong('Polymorph') }),
  x('shroud-of-shadow', 'Shroud of Shadow', { minLevel: 15, ...atWill('Invisibility') }),
  p('sign-of-ill-omen', 'Sign of Ill Omen', { minLevel: 5, ...oncePerLong('Bestow Curse') }),
  p('thief-of-five-fates', 'Thief of Five Fates', oncePerLong('Bane')),
  p('thirsting-blade', 'Thirsting Blade', { minLevel: 5, requires: BLADE }),
  x('tomb-of-levistus', 'Tomb of Levistus', { minLevel: 5, uses: { count: 1, recharge: 'short' } }),
  x('tricksters-escape', "Trickster's Escape", { minLevel: 7, ...oncePerLong('Freedom of Movement') }),
  t('undying-servitude', 'Undying Servitude', { minLevel: 5, ...oncePerLong('Animate Dead') }),
  p('visions-of-distant-realms', 'Visions of Distant Realms', { minLevel: 15, ...atWill('Arcane Eye') }),
  p('voice-of-the-chain-master', 'Voice of the Chain Master', { requires: CHAIN }),
  p('whispers-of-the-grave', 'Whispers of the Grave', { minLevel: 9, ...atWill('Speak with Dead') }),
  p('witch-sight', 'Witch Sight', { minLevel: 15 }),
]

const n = make('invocation', '2024', PHB24)
const BLADE24 = ['pact-of-the-blade-2024']
const CHAIN24 = ['pact-of-the-chain-2024']
const TOME24 = ['pact-of-the-tome-2024']
const DAMAGE_CANTRIP = { prerequisite: 'A warlock cantrip that deals damage', repeatable: true, choiceKind: 'cantrip' as const }

/** 2024 invocations (Player's Handbook 2024). The Pact Boons are invocations here. */
export const INVOCATIONS_2024: ClassOption[] = [
  n('pact-of-the-blade', 'Pact of the Blade'),
  n('pact-of-the-chain', 'Pact of the Chain', { spells: [{ name: 'Find Familiar', note: 'without a spell slot' }] }),
  n('pact-of-the-tome', 'Pact of the Tome'),
  n('agonizing-blast', 'Agonizing Blast', { minLevel: 2, ...DAMAGE_CANTRIP }),
  n('armor-of-shadows', 'Armor of Shadows', atWill('Mage Armor')),
  n('ascendant-step', 'Ascendant Step', { minLevel: 5, ...atWill('Levitate') }),
  n('devils-sight', "Devil's Sight", { minLevel: 2, effects: [{ kind: 'sense', sense: 'darkvision', value: 120 }] }),
  n('devouring-blade', 'Devouring Blade', { minLevel: 12, requires: ['thirsting-blade-2024'] }),
  n('eldritch-mind', 'Eldritch Mind', { effects: [{ kind: 'advantage', on: 'concentration' }] }),
  n('eldritch-smite', 'Eldritch Smite', { minLevel: 5, requires: BLADE24 }),
  n('eldritch-spear', 'Eldritch Spear', { minLevel: 2, ...DAMAGE_CANTRIP }),
  n('fiendish-vigor', 'Fiendish Vigor', { minLevel: 2, ...atWill('False Life') }),
  n('gaze-of-two-minds', 'Gaze of Two Minds', { minLevel: 5 }),
  n('gift-of-the-depths', 'Gift of the Depths', { minLevel: 5, effects: [{ kind: 'moveSpeed', mode: 'swim', value: 0 }], ...oncePerLong('Water Breathing') }),
  n('gift-of-the-protectors', 'Gift of the Protectors', { minLevel: 9, requires: TOME24, uses: { count: 1, recharge: 'long' } }),
  n('investment-of-the-chain-master', 'Investment of the Chain Master', { minLevel: 5, requires: CHAIN24 }),
  n('lessons-of-the-first-ones', 'Lessons of the First Ones', { minLevel: 2, repeatable: true, choiceKind: 'originFeat' }),
  n('lifedrinker', 'Lifedrinker', { minLevel: 9, requires: BLADE24 }),
  n('mask-of-many-faces', 'Mask of Many Faces', { minLevel: 2, ...atWill('Disguise Self') }),
  n('master-of-myriad-forms', 'Master of Myriad Forms', { minLevel: 5, ...atWill('Alter Self') }),
  n('misty-visions', 'Misty Visions', { minLevel: 2, ...atWill('Silent Image') }),
  n('one-with-shadows', 'One with Shadows', { minLevel: 5, ...atWill('Invisibility') }),
  n('otherworldly-leap', 'Otherworldly Leap', { minLevel: 2, ...atWill('Jump') }),
  n('repelling-blast', 'Repelling Blast', { minLevel: 2, ...DAMAGE_CANTRIP, prerequisite: 'A warlock cantrip with an attack roll' }),
  n('thirsting-blade', 'Thirsting Blade', { minLevel: 5, requires: BLADE24 }),
  n('visions-of-distant-realms', 'Visions of Distant Realms', { minLevel: 9, ...atWill('Arcane Eye') }),
  n('whispers-of-the-grave', 'Whispers of the Grave', { minLevel: 7, ...atWill('Speak with Dead') }),
  n('witch-sight', 'Witch Sight', { minLevel: 15, effects: [{ kind: 'sense', sense: 'truesight', value: 30 }] }),
]

// Topics for the builder's "why?" tips. The text lives in i18n/locales as why.<topic>.title / .text,
// plus one explanation per builder option (why.<kind>.<id>, mostly in locales/explain.en.ts).
import { en, type MessageKey } from '../i18n/locales/en'
import { ARTISAN_TOOLS, GAMING_SETS, MUSICAL_INSTRUMENTS } from '../rules'

export const WHY_TOPICS = [
  'step.race', 'step.class', 'step.abilities', 'step.skills', 'step.spells', 'step.equipment', 'step.details',
  'edition', 'originFeat', 'bgBonus',
  'subrace', 'traits', 'languages', 'size', 'speed', 'ancestry', 'originSwap',
  'level', 'savingThrows', 'proficiencies', 'features', 'hitDie', 'primary', 'casting', 'subclassChoice', 'multiclass',
  'choice.fightingStyle', 'choice.divineOrder', 'choice.primalOrder', 'choice.metamagic', 'choice.blessedStrikes', 'choice.elementalFury',
  'pick.expertise', 'pick.skill', 'pick.mastery', 'epicBoon',
  'method.standard', 'method.pointBuy', 'method.rolled', 'method.manual', 'reroll', 'suggest', 'racial', 'modifier', 'freeBonus', 'asi',
  'background', 'customBackground', 'skills', 'tools',
  'hbBackground', 'hbBgEditions', 'hbBgFeature', 'hbBgAbilities', 'hbBgFeat', 'hbBgProfs', 'hbBgGear', 'hbBgEffects',
  'cantrips', 'spellsKnown', 'spellsPrepared', 'spellbook', 'alwaysPrepared', 'grantedSpells', 'extraSpells', 'magicalSecrets',
  'kit', 'kitChoice', 'kitList', 'startingGold', 'bgGold', 'shop',
  'alignment',
] as const

export type WhyId = (typeof WHY_TOPICS)[number]

/**
 * What each explanation describes. race/race2024/class are the "why pick it" pitches; about is what a class is;
 * sub2014/sub2024 are subraces and 2024 lineages; bg/bg2024 backgrounds; feature and trait are keyed by name.
 */
export type ExplainKind =
  | 'race' | 'race2024' | 'class' | 'about' | 'sub2014' | 'sub2024' | 'subclass'
  | 'feature' | 'subfeature' | 'trait' | 'bg' | 'bg2024' | 'skill' | 'ability' | 'align' | 'language' | 'tool'
  | 'metamagic' | 'metamagic2024'

/** Message key that explains this option, or none (homebrew and other content without one). */
export function explainKey(kind: ExplainKind, id: string): MessageKey | undefined {
  const key = `why.${kind}.${kind === 'tool' ? toolGroup(id) : id}`
  return key in en ? (key as MessageKey) : undefined
}

/**
 * A feature's explanation. Subclass features whose name other subclasses share with a different meaning
 * ("Bonus Proficiencies") have their own key why.subfeature.<subclassId>.<name>.
 */
export const featureKey = (name: string, subclassId?: string): MessageKey | undefined =>
  (subclassId ? explainKey('subfeature', `${subclassId}.${name}`) : undefined) ?? explainKey('feature', name)

/** A Metamagic option's explanation for the character's edition; homebrew options carry their own text instead. */
export const metamagicKey = (o: { id: string }, edition: string): MessageKey | undefined =>
  explainKey(edition === '2024' ? 'metamagic2024' : 'metamagic', o.id)

/** Message key for why a new player might pick this race or class; none for homebrew. */
export const pitchKey = (kind: 'race' | 'race2024' | 'class', id: string) => explainKey(kind, id)

/** Artisan's tools, gaming sets and instruments share one explanation per group. */
function toolGroup(tool: string): string {
  if (ARTISAN_TOOLS.includes(tool)) return 'artisan'
  if (GAMING_SETS.includes(tool)) return 'gaming'
  if (MUSICAL_INSTRUMENTS.includes(tool)) return 'instrument'
  return tool
}

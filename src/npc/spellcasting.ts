// Spellcasting prefill for the NPC creator, pure. SRD 5.1 stat blocks keep spells in a text trait
// ("Spellcasting: ... Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit ...)\n- Cantrips (at will): fire bolt, ...");
// the creator turns that into the shared `spellcasting` field so the sheet can count slots and per-day uses.
import type { Ability } from '../rules'
import { monsterMod, type Block, type MonsterSpellcasting } from '../monsters/block'

const ABILITY_NAMES: Record<string, Ability> = {
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
}

/** "Fire Bolt" → "fire-bolt": the content library's spell ids. */
export const spellSlug = (name: string) =>
  name.trim().toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The trait or action that carries the block's spell list, if any. */
export function spellcastingTrait(m: Block) {
  return [...m.traits, ...m.actions].find(a => /spellcasting/i.test(a.name))
}

/**
 * Best-effort read of a Spellcasting trait: ability, save DC, attack bonus and one group per "- Label: a, b" line.
 * Spells are stored as ids (`spellSlug`). A block without such a trait gives nothing.
 */
export function parseSpellcasting(m: Block): MonsterSpellcasting | undefined {
  if (m.spellcasting) return m.spellcasting
  const trait = spellcastingTrait(m)
  if (!trait) return undefined
  const text = trait.description
  const abilityWord = /spellcasting ability is (\w+)|using (\w+) as the spellcasting ability/i.exec(text)
  const ability = ABILITY_NAMES[(abilityWord?.[1] ?? abilityWord?.[2] ?? '').toLowerCase()] ?? 'int'
  const dc = /save DC (\d+)/i.exec(text)
  const atk = /([+-]\d+) to hit/i.exec(text)
  const groups: MonsterSpellcasting['groups'] = []
  for (const line of text.split('\n')) {
    const g = /^\s*[-*•]?\s*([^:\n]+?):\s*(.+)$/.exec(line)
    if (!g) continue
    const label = g[1].trim()
    if (!/at will|level|\/day|slot|cantrip|rest/i.test(label)) continue
    const spells = g[2].split(/,|;/).map(s => s.replace(/\(.*?\)/g, '').replace(/\*|\.$/g, '').trim()).filter(Boolean).map(spellSlug)
    if (spells.length) groups.push({ label, spells })
  }
  return {
    ability,
    ...(dc ? { saveDc: Number(dc[1]) } : {}),
    ...(atk ? { attackBonus: Number(atk[1]) } : {}),
    groups,
  }
}

/** Save DC from the block's numbers: 8 + proficiency + the casting ability's modifier. */
export const spellSaveDc = (m: Block, ability: Ability) => 8 + m.proficiencyBonus + monsterMod(m.abilities[ability])
/** Spell attack bonus: proficiency + the casting ability's modifier. */
export const spellAttackBonus = (m: Block, ability: Ability) => m.proficiencyBonus + monsterMod(m.abilities[ability])

/** Group labels the creator offers: the usual stat block headings. */
export const GROUP_PRESETS = [
  'Cantrips (at will)', 'At will', '1st level (4 slots)', '2nd level (3 slots)', '3rd level (3 slots)', '4th level (3 slots)',
  '5th level (1 slot)', '6th level (1 slot)', '7th level (1 slot)', '8th level (1 slot)', '9th level (1 slot)', '1/day each', '2/day each', '3/day each',
]

/** Writes the Spellcasting trait's text back from the structured field, so the stat block reads as the book does. */
export function spellcastingText(m: Block, sc: MonsterSpellcasting, names: (id: string) => string): string {
  const ability = Object.entries(ABILITY_NAMES).find(([, a]) => a === sc.ability)?.[0] ?? 'intelligence'
  const cap = ability[0].toUpperCase() + ability.slice(1)
  const dc = sc.saveDc ?? spellSaveDc(m, sc.ability)
  const atk = sc.attackBonus ?? spellAttackBonus(m, sc.ability)
  const head = `Its spellcasting ability is ${cap} (spell save DC ${dc}, ${atk >= 0 ? '+' : ''}${atk} to hit with spell attacks). It has the following spells:`
  const lines = sc.groups.filter(g => g.spells.length).map(g => `- ${g.label}: ${g.spells.map(names).join(', ')}`)
  return [head, ...lines, ...(sc.note ? [sc.note] : [])].join('\n')
}

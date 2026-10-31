// Context cards: compact plain-text summaries of what is on screen, put in the system instruction each turn.
// Pure: no storage, no React. Detail beyond the card comes through tools.
import type { Character } from '../model/character'
import { classById, derive, getBackground, itemById, raceById, rulesEdition, subclassById } from '../rules'

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

/** About 1-2k tokens: who the character is and what they can do, by name. */
export function characterCard(c: Character): string {
  const edition = rulesEdition(c)
  const d = derive(c)
  const classes = c.classes
    .map(cl => {
      const name = classById(cl.classId, edition)?.name ?? cl.classId
      const sub = cl.subclassId ? subclassById(cl.subclassId, edition)?.name ?? c.customSubclasses?.find(s => s.classId === cl.classId)?.name ?? cl.subclassId : ''
      return `${name} ${cl.level}${sub ? ` (${sub})` : ''}`
    })
    .join(' / ')
  const race = raceById(c.raceId)?.name ?? c.raceId
  const bg = getBackground(c)?.name ?? c.customBackground?.name ?? c.backgroundId
  const lines = [
    `Character: ${c.name} — ${race}, ${classes}, level ${d.level}. Background ${bg}. Rules edition ${edition}.`,
    `Abilities: ${ABILITIES.map(a => `${a.toUpperCase()} ${d.abilities[a]} (${sign(d.mods[a])})`).join(', ')}. Proficiency ${sign(d.proficiencyBonus)}.`,
    `AC ${d.armorClass.value} (${d.armorClass.source}), HP ${Math.min(c.state.currentHp, d.maxHp)}/${d.maxHp}${c.state.tempHp ? ` +${c.state.tempHp} temp` : ''}, speed ${d.speed} ft, initiative ${sign(d.initiative)}, passive Perception ${d.passivePerception}.`,
    `Saves proficient: ${ABILITIES.filter(a => d.saves[a].proficient).map(a => `${a.toUpperCase()} ${sign(d.saves[a].bonus)}`).join(', ') || 'none'}.`,
    `Skills proficient: ${Object.entries(d.skills).filter(([, s]) => s.proficient).map(([k, s]) => `${k}${s.expertise ? ' (expertise)' : ''} ${sign(s.bonus)}`).join(', ') || 'none'}.`,
  ]
  if (d.spellcasting) lines.push(`Spellcasting: ${d.spellcasting.ability.toUpperCase()}, save DC ${d.spellcasting.saveDc}, attack ${sign(d.spellcasting.attackBonus)}.`)
  if (c.spells?.length) lines.push(`Spells known: ${c.spells.map(s => `${s.id}${s.prepared ? '*' : ''}`).join(', ')} (* prepared; ids from the spell library).`)
  if (d.attacks.length) lines.push(`Attacks: ${d.attacks.slice(0, 8).map(a => `${a.name} ${sign(a.bonus)} ${a.damage} ${a.damageType}`).join('; ')}.`)
  if (d.features.length) lines.push(`Features: ${d.features.map(f => f.name + (f.detail ? ` (${f.detail})` : '')).join(', ')}.`)
  if (d.feats.length) lines.push(`Feats: ${d.feats.join(', ')}.`)
  if (d.traits.length) lines.push(`Traits: ${d.traits.join(', ')}.`)
  const gear = c.inventory.filter(i => i.equipped).map(i => i.name ?? i.item?.name ?? itemById(i.itemId)?.name ?? i.itemId)
  if (gear.length) lines.push(`Equipped: ${gear.join(', ')}.`)
  if (c.state.conditions.length) lines.push(`Conditions now: ${c.state.conditions.join(', ')}.`)
  if (d.warnings.length) lines.push(`Sheet warnings: ${d.warnings.join(' ')}`)
  return lines.join('\n')
}

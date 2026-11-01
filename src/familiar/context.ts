// Context cards: compact plain-text summaries of what is on screen, put in the system instruction each turn.
// Pure: no storage, no React. Detail beyond the card comes through tools.
import type { Character } from '../model/character'
import { STEP_IDS, stepIssues, type StepId } from '../builder/validate'
import { isPrepared } from '../spellbook/spellbook'
import { classById, derive, featById, getAbilityScores, getBackground, itemById, raceById, rulesEdition, subclassById, type CharacterDraft } from '../rules'

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
  if (c.spells?.length) lines.push(`Spells known: ${c.spells.map(s => `${s.id}${isPrepared(s) ? '*' : ''}`).join(', ')} (* prepared; ids from the spell library).`)
  if (d.attacks.length) lines.push(`Attacks: ${d.attacks.slice(0, 8).map(a => `${a.name} ${sign(a.bonus)} ${a.damage} ${a.damageType}`).join('; ')}.`)
  if (d.features.length) lines.push(`Features: ${d.features.map(f => f.name + (f.detail ? ` (${f.detail})` : '')).join(', ')}.`)
  if (d.feats.length) lines.push(`Feats: ${d.feats.join(', ')}.`)
  if (d.traits.length) lines.push(`Traits: ${d.traits.join(', ')}.`)
  const gear = c.inventory.filter(i => i.equipped).map(i => i.name ?? i.item?.name ?? itemById(i.itemId)?.name ?? i.itemId)
  if (gear.length) lines.push(`Equipped: ${gear.join(', ')}.`)
  if (c.state.conditions.length) lines.push(`Conditions now: ${c.state.conditions.join(', ')}.`)
  if (c.state.inspiration) lines.push(`Has ${c.rulesEdition === '2024' ? 'Heroic Inspiration' : 'Inspiration'}.`)
  if (c.state.boons?.length) lines.push(`DM rewards: ${c.state.boons.map(b => `${b.name} (${b.kind}${b.text ? `: ${b.text}` : ''})`).join('; ')}.`)
  if (d.warnings.length) lines.push(`Sheet warnings: ${d.warnings.join(' ')}`)
  return lines.join('\n')
}

/** The builder draft so far: what is picked and, per step, what is still missing. Never derives from missing picks. */
export function draftCard(d: CharacterDraft, step?: StepId): string {
  const edition = rulesEdition(d)
  const classes = d.classes
    .map(cl => {
      const name = classById(cl.classId, edition)?.name ?? cl.classId
      const sub = cl.subclassId ? subclassById(cl.subclassId, edition)?.name ?? d.customSubclasses?.find(s => s.classId === cl.classId)?.name ?? cl.subclassId : ''
      return `${name} ${cl.level}${sub ? ` (${sub})` : ''}`
    })
    .join(' / ')
  const race = d.raceId ? `${raceById(d.raceId)?.name ?? d.raceId}${d.subraceId ? ` (${d.subraceId})` : ''}` : 'not picked'
  const bg = d.backgroundId ? getBackground(d)?.name ?? d.customBackground?.name ?? d.backgroundId : 'not picked'
  const assigned = ABILITIES.some(a => d.baseAbilities[a] > 0)
  const scores = assigned ? getAbilityScores(d) : undefined
  const lines = [
    `Builder draft: ${d.name || '(no name yet)'}. Rules edition ${edition}. ${edition === '2024' ? 'Species' : 'Race'}: ${race}. Class: ${classes || 'not picked'}. Background: ${bg}.`,
    scores ? `Ability scores (${d.abilityMethod}, with bonuses): ${ABILITIES.map(a => `${a.toUpperCase()} ${scores[a]}`).join(', ')}.` : `Ability scores: not assigned yet (${d.abilityMethod}).`,
  ]
  if (d.chosenSkills.length) lines.push(`Chosen skills: ${d.chosenSkills.join(', ')}.`)
  const feats = (d.improvements ?? []).filter(i => i.featId).map(i => featById(i.featId!, edition)?.name ?? i.customFeat?.name ?? i.featId)
  if (feats.length) lines.push(`Feats: ${feats.join(', ')}.`)
  if (d.spells?.length) lines.push(`Spells picked: ${d.spells.map(s => s.id).join(', ')}.`)
  if (step) lines.push(`Step on screen: ${step}.`)
  const open = STEP_IDS.map(s => [s, stepIssues(s, d)] as const).filter(([, issues]) => issues.length)
  lines.push(open.length ? `Still missing: ${open.map(([s, issues]) => `${s}: ${issues.slice(0, 3).join('; ')}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ''}`).join(' | ')}.` : 'Every step is complete.')
  return lines.join('\n')
}

// "Suggest for my class": fills the picks with an obvious answer from the class's main abilities.
import type { Improvement } from '../model/character'
import { SKILLS, STANDARD_ARRAY, classById, getAbilityScores, improvementSlots, type Ability, type CharacterDraft, type SkillId } from '../rules'
import { grantedSkills, skillPicks } from './validate'

/** Abilities in the order the class wants them: its primary ones, then CON, DEX, WIS, STR, CHA, INT. */
function abilityOrder(draft: CharacterDraft): Ability[] {
  const cls = classById(draft.classes[0]?.classId ?? '', draft.rulesEdition)
  return [...new Set<Ability>([...(cls?.primary ?? []), 'con', 'dex', 'wis', 'str', 'cha', 'int'])]
}

/** Standard array laid out for the starting class. */
export function suggestedArray(draft: CharacterDraft): CharacterDraft['baseAbilities'] {
  const out = { ...draft.baseAbilities }
  abilityOrder(draft).forEach((a, i) => { out[a] = STANDARD_ARRAY[i] })
  return out
}

/** Fills every empty ASI slot: +2 to the first class ability under 20, split +1/+1 when it is odd. Picked slots stay. */
export function suggestedImprovements(draft: CharacterDraft): Improvement[] {
  const kept = draft.improvements ?? []
  const filled = (s: { classId: string; level: number }) => kept.some(i => i.classId === s.classId && i.level === s.level && (i.featId || Object.values(i.abilities ?? {}).some(v => v)))
  let improvements = kept.filter(i => filled(i))
  for (const slot of improvementSlots(draft)) {
    if (filled(slot)) continue
    const scores = getAbilityScores({ ...draft, improvements })
    const open = abilityOrder(draft).filter(a => scores[a] < 20)
    if (!open.length) continue
    // An odd score wastes a point on +2, so it takes +1 and the other +1 goes to one of the next two abilities, an odd one first.
    const [first, ...rest] = open
    const second = rest.slice(0, 2).find(a => scores[a] % 2 === 1) ?? rest[0]
    const split = second && (scores[first] >= 19 || scores[first] % 2 === 1)
    const abilities: Partial<Record<Ability, number>> = split ? { [first]: 1, [second]: 1 } : { [first]: scores[first] <= 18 ? 2 : 1 }
    improvements = [...improvements, { classId: slot.classId, level: slot.level, abilities }]
  }
  return improvements
}

/** Fills the open skill picks: the race's short list, class skills, the background's list, then any skill, each by the character's best abilities. */
export function suggestedSkills(draft: CharacterDraft): SkillId[] {
  const { classCount, classFrom, raceCount, bgCount, bgFrom, raceListCount, raceFrom } = skillPicks(draft)
  const granted = grantedSkills(draft)
  const scores = getAbilityScores(draft)
  const rank = (list: SkillId[]) => [...list].sort((a, b) => scores[SKILLS[b].ability] - scores[SKILLS[a].ability])
  const out = draft.chosenSkills.filter(s => !granted.has(s))
  const add = (list: SkillId[], upTo: number) => {
    for (const s of rank(list)) if (out.length < upTo && !out.includes(s) && !granted.has(s)) out.push(s)
  }
  // The race's short list (Keen Senses) first, so the class's longer list can't use it all up.
  add(raceFrom, raceListCount)
  add(classFrom, raceListCount + classCount)
  add(bgFrom, raceListCount + classCount + bgCount)
  add(Object.keys(SKILLS) as SkillId[], classCount + bgCount + raceListCount + raceCount)
  return out
}

// "Suggest for my class": fills the picks with an obvious answer from the class's main abilities.
import type { Improvement } from '../model/character'
import {
  SKILLS, STANDARD_ARRAY, classById, classPickSlots, fixedLanguages, fixedTools, getAbilityScores, improvementSlots, languagePickCount, pickKey, rulesEdition, tableLanguages, toolPickGroups,
  type Ability, type CharacterDraft, type SkillId,
} from '../rules'
import { grantedSkills, skillPicks, suggestedForPick } from './validate'

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

/**
 * Everything the Background & skills step asks for, with what was picked kept: skills, then class picks
 * (Expertise sees the skills, Scholar its list), languages from the table in order, tools from each pick's own list.
 */
export function suggestedSkillStep(draft: CharacterDraft): Pick<CharacterDraft, 'chosenSkills' | 'classPicks' | 'chosenLanguages' | 'chosenTools'> {
  let d: CharacterDraft = { ...draft, chosenSkills: suggestedSkills(draft) }
  const scores = getAbilityScores(d)
  const classPicks = { ...(d.classPicks ?? {}) }
  // Expertise can also go on a tool (Thieves' Tools): those rank as DEX.
  const rank = (x: string) => scores[x in SKILLS ? SKILLS[x as SkillId].ability : 'dex']
  for (const { classId, pick } of classPickSlots(d)) {
    if (pick.kind === 'language') continue
    const key = pickKey(classId, pick.id)
    const picked = (classPicks[key] ?? []).slice(0, pick.count)
    // Other picks of the same kind count, so a second Expertise doesn't repeat the first.
    const taken = new Set(classPickSlots(d).filter(s => s.pick.kind === pick.kind && pickKey(s.classId, s.pick.id) !== key).flatMap(s => s.picked))
    const options = [...suggestedForPick(d, pick)].filter(s => !picked.includes(s) && !taken.has(s))
      .sort((a, b) => rank(b) - rank(a))
    classPicks[key] = [...picked, ...options.slice(0, pick.count - picked.length)]
    d = { ...d, classPicks }
  }
  const knownLangs = fixedLanguages(d)
  const langs = Array.from({ length: languagePickCount(d) }, (_, i) => d.chosenLanguages?.[i] ?? '')
  const freeLangs = tableLanguages(rulesEdition(d)).filter(l => !knownLangs.includes(l) && !langs.includes(l))
  const chosenLanguages = langs.map(l => l || freeLangs.shift() || '')
  const knownTools = fixedTools(d)
  const chosenTools: string[] = []
  let at = 0
  for (const g of toolPickGroups(d)) {
    for (let k = 0; k < g.count; k++, at++) {
      const own = d.chosenTools?.[at] ?? ''
      const usedLater = (x: string) => (d.chosenTools ?? []).slice(at + 1).includes(x)
      chosenTools.push(own || g.from.find(x => !knownTools.includes(x) && !chosenTools.includes(x) && !usedLater(x)) || '')
    }
  }
  return { chosenSkills: d.chosenSkills, classPicks, chosenLanguages, chosenTools }
}

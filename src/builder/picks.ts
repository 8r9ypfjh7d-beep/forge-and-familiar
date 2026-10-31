// What picking a race, class or background changes in a draft: the pick plus the later picks it clears.
// Pure, shared by the builder steps and the Familiar's Apply cards, so both change a draft the same way.
import { CUSTOM_BACKGROUND, getBackground, rulesEdition, type Ability, type CharacterDraft } from '../rules'
import type { Improvement } from '../model/character'

/** A new race: its subrace, bonuses (2014), origin swaps, race skill/language/tool picks, trait choices and origin feat start over. */
export function racePatch(draft: CharacterDraft, raceId: string): Partial<CharacterDraft> {
  return {
    raceId, subraceId: undefined, freeAbilityBonuses: rulesEdition(draft) === '2024' ? draft.freeAbilityBonuses : [], racialBonusTargets: undefined, originSwaps: undefined,
    chosenSkills: [], chosenLanguages: [], chosenTools: [], traitChoices: {}, originFeatId: undefined, sizeChoice: undefined,
  }
}

/** A subrace (or none): its language, skill and bonus picks start over. */
export const subracePatch = (subraceId: string | undefined): Partial<CharacterDraft> => ({
  subraceId, chosenLanguages: [], chosenSkills: [], freeAbilityBonuses: [], originFeatId: undefined, racialBonusTargets: undefined, originSwaps: undefined,
})

/** A new first class at the same level: its skills, tools, gear, ASIs, class choices and the old class's options start over. */
export function classPatch(draft: CharacterDraft, classId: string): Partial<CharacterDraft> {
  const current = draft.classes[0]
  const extras = draft.classes.slice(1)
  return {
    classes: [{ classId, level: current?.level ?? 1 }, ...extras.filter(x => x.classId !== classId)],
    chosenSkills: [], chosenTools: [], equipmentPicks: [], startingWealth: undefined, improvements: [], featureChoices: {}, classPicks: {}, weaponMasteries: [],
    classOptions: (draft.classOptions ?? []).filter(p => p.classId !== current?.classId || p.classId === classId),
  }
}

/** 2024 suggestion: +2 and +1 to the background's two listed abilities with the best base scores. */
export function suggestedBonuses(draft: CharacterDraft): Ability[] {
  const listed = [...(getBackground(draft)?.abilityScores ?? [])]
  const [first, second] = listed.sort((a, b) => draft.baseAbilities[b] - draft.baseAbilities[a])
  return first && second ? [first, first, second] : []
}

/** 2024: a new background keeps bonuses the player placed off the old list; otherwise it takes the new one's suggested +2/+1. */
export function bonusesAfterBackground(draft: CharacterDraft, backgroundId: string): Ability[] {
  const listed = getBackground(draft)?.abilityScores ?? []
  return draft.freeAbilityBonuses.some(a => !listed.includes(a)) ? draft.freeAbilityBonuses : suggestedBonuses({ ...draft, backgroundId })
}

/** A new background: its skill, language and tool picks start over; 2024 moves the ability bonuses to it. */
export function backgroundPatch(draft: CharacterDraft, backgroundId: string): Partial<CharacterDraft> {
  return {
    backgroundId,
    chosenSkills: [],
    chosenLanguages: [],
    chosenTools: [],
    ...(rulesEdition(draft) === '2024' ? { freeAbilityBonuses: bonusesAfterBackground(draft, backgroundId) } : {}),
    customBackground: backgroundId === CUSTOM_BACKGROUND ? draft.customBackground ?? { name: '', feature: '', skills: [], tools: [], languages: [] } : draft.customBackground,
  }
}

/** Sets one Ability Score Improvement slot (ability bonuses or a feat), replacing what the slot had. */
export const improvementPatch = (draft: CharacterDraft, next: Improvement): Partial<CharacterDraft> => ({
  improvements: [...(draft.improvements ?? []).filter(i => i.classId !== next.classId || i.level !== next.level), next],
})

import { translate, type Translate } from '../i18n/translate'
import {
  ABILITIES, POINT_BUY_BUDGET, STANDARD_ARRAY, backgroundById, classById, getAbilityScores, meetsPrereq, pointBuyCost,
  prereqLabel, raceById,
  type CharacterDraft, type SkillId,
} from '../rules'

export type StepId = 'race' | 'class' | 'abilities' | 'skills' | 'equipment' | 'details'

/** Skills granted automatically by race and background (not choosable). */
export function grantedSkills(d: CharacterDraft): Set<SkillId> {
  return new Set([
    ...(raceById(d.raceId)?.skillProficiencies ?? []),
    ...(backgroundById(d.backgroundId)?.skillProficiencies ?? []),
  ])
}

export function skillPicks(d: CharacterDraft) {
  const cls = classById(d.classes[0]?.classId ?? '')
  return { classCount: cls?.skillChoices.count ?? 0, classFrom: cls?.skillChoices.from ?? [], raceCount: raceById(d.raceId)?.freeSkillChoices ?? 0 }
}

const english: Translate = (key, vars) => translate('en', key, vars)

/** Problems that block leaving a step. Empty means the step is complete. */
export function stepIssues(step: StepId, d: CharacterDraft, t: Translate = english): string[] {
  const out: string[] = []
  const race = raceById(d.raceId)
  switch (step) {
    case 'race':
      if (!race) out.push(t('builder.issue.race'))
      else if (race.subraces?.length && !race.subraces.some(s => s.id === d.subraceId)) out.push(t('builder.issue.subrace'))
      break
    case 'class':
      if (!classById(d.classes[0]?.classId ?? '')) out.push(t('builder.issue.class'))
      break
    case 'abilities': {
      const scores = ABILITIES.map(a => d.baseAbilities[a])
      if (d.abilityMethod === 'standard') {
        const sorted = [...scores].sort((a, b) => b - a)
        if (sorted.join() !== STANDARD_ARRAY.join()) out.push(t('builder.issue.standard'))
      } else if (d.abilityMethod === 'pointBuy') {
        const cost = pointBuyCost(d.baseAbilities)
        if (cost === null) out.push(t('builder.issue.pointBuyRange'))
        else if (cost > POINT_BUY_BUDGET) out.push(t('builder.issue.pointBuyOver', { cost, budget: POINT_BUY_BUDGET }))
      } else if (scores.some(s => s < 3 || s > 20)) {
        out.push(t('builder.issue.manualRange'))
      }
      const free = race?.freeAbilityBonuses
      if (free && d.freeAbilityBonuses.length !== free.count) out.push(t('builder.issue.freeBonus', { count: free.count }))
      if (d.classes.length > 1 && scores.every(s => s > 0)) {
        const final = getAbilityScores(d)
        for (const cl of d.classes) {
          if (!meetsPrereq(cl.classId, final)) out.push(t('builder.issue.multiclass', { className: classById(cl.classId)?.name ?? cl.classId, prereq: prereqLabel(cl.classId) }))
        }
      }
      break
    }
    case 'skills': {
      const { classCount, classFrom, raceCount } = skillPicks(d)
      const granted = grantedSkills(d)
      if (d.chosenSkills.some(s => granted.has(s))) out.push(t('builder.issue.skillGranted'))
      const fromClass = d.chosenSkills.filter(s => classFrom.includes(s)).length
      if (d.chosenSkills.length !== classCount + raceCount || fromClass < classCount) {
        out.push(raceCount
          ? t('builder.issue.skillsMixed', { classCount, raceCount })
          : t('builder.issue.skillsClass', { classCount }))
      }
      break
    }
    case 'equipment':
      break
    case 'details':
      if (!d.name.trim()) out.push(t('builder.issue.name'))
      break
  }
  return out
}

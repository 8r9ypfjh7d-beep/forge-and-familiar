import { translate, type Translate } from '../i18n/translate'
import {
  ABILITIES, CUSTOM_BACKGROUND, activeImprovements, POINT_BUY_BUDGET, STANDARD_ARRAY, classById, featById, fixedLanguages, fixedTools, getAbilityScores,
  getBackground, improvementSlots, languagePickCount, meetsPrereq, pointBuyCost, prereqLabel, raceById, racialBonuses,
  subclassesFor, toolPickGroups,
  type CharacterDraft, type SkillId,
} from '../rules'

export type StepId = 'race' | 'class' | 'abilities' | 'skills' | 'equipment' | 'details'

/** Skills granted automatically by race and background (not choosable). */
export function grantedSkills(d: CharacterDraft): Set<SkillId> {
  return new Set([
    ...(raceById(d.raceId)?.skillProficiencies ?? []),
    ...(getBackground(d)?.skillProficiencies ?? []),
  ])
}

export function skillPicks(d: CharacterDraft) {
  const cls = classById(d.classes[0]?.classId ?? '')
  return { classCount: cls?.skillChoices.count ?? 0, classFrom: cls?.skillChoices.from ?? [], raceCount: raceById(d.raceId)?.freeSkillChoices ?? 0 }
}

/** Class entries at or past their subclass level. Classes with no subclass to choose from are skipped. */
export function subclassSlots(d: CharacterDraft) {
  return d.classes.filter(cl => {
    const def = classById(cl.classId)
    return def && cl.level >= def.subclassLevel && subclassesFor(cl.classId).length > 0
  })
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
      if (race?.traitChoice && !race.traitChoice.options.some(o => o.id === d.traitChoices?.[race.traitChoice!.id])) {
        out.push(t('builder.issue.traitChoice', { trait: race.traitChoice.name }))
      }
      break
    case 'class':
      if (!classById(d.classes[0]?.classId ?? '')) out.push(t('builder.issue.class'))
      for (const cl of subclassSlots(d)) {
        if (!subclassesFor(cl.classId).some(s => s.id === cl.subclassId)) {
          out.push(t('builder.issue.subclass', { className: classById(cl.classId)!.name, title: classById(cl.classId)!.subclassTitle }))
        }
      }
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
      const racial = racialBonuses(d)
      for (const slot of improvementSlots(d)) {
        const imp = d.improvements?.find(i => i.classId === slot.classId && i.level === slot.level)
        const points = ABILITIES.reduce((n, a) => n + (imp?.abilities?.[a] ?? 0), 0)
        const done = imp?.featId ? !!featById(imp.featId) : points === 2
        if (!done) out.push(t('builder.issue.asi', { className: classById(slot.classId)?.name ?? slot.classId, level: slot.level }))
      }
      if (scores.every(s => s > 0)) {
        const asi = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
        for (const i of activeImprovements(d)) for (const a of ABILITIES) asi[a] += i.featId ? 0 : (i.abilities?.[a] ?? 0)
        for (const a of ABILITIES) {
          if (asi[a] && d.baseAbilities[a] + racial[a] + asi[a] > 20) out.push(t('builder.issue.asiCap', { ability: a.toUpperCase() }))
        }
      }
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
      if (d.backgroundId === CUSTOM_BACKGROUND) {
        const cb = d.customBackground
        if (!cb?.name.trim()) out.push(t('builder.issue.customName'))
        if (new Set(cb?.skills ?? []).size !== 2) out.push(t('builder.issue.customSkills'))
        if ((cb?.tools.length ?? 0) + (cb?.languages.length ?? 0) !== 2) out.push(t('builder.issue.customProfs'))
      }
      const langs = d.chosenLanguages ?? []
      const fixedLangs = fixedLanguages(d)
      if (langs.length !== languagePickCount(d) || new Set(langs).size !== langs.length || langs.some(l => !l.trim() || fixedLangs.includes(l))) {
        out.push(t('builder.issue.languages', { count: languagePickCount(d) }))
      }
      const groups = toolPickGroups(d)
      const tools = d.chosenTools ?? []
      const known = fixedTools(d)
      let at = 0
      const toolsOk = groups.every(g => {
        const picks = tools.slice(at, (at += g.count))
        return picks.length === g.count && picks.every(p => g.from.includes(p) && !known.includes(p))
      }) && tools.length === at && new Set(tools).size === tools.length
      if (!toolsOk) out.push(t('builder.issue.tools'))
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

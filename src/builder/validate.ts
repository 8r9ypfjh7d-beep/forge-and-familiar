import { translate, type Translate } from '../i18n/translate'
import {
  ABILITIES, CUSTOM_BACKGROUND, CUSTOM_SUBCLASS, POINT_BUY_BUDGET, STANDARD_ARRAY, usesRolledPool, classById, classChoices, featById, featSkillPicks, fixedRacialBonuses, improvementBonuses,
  fixedLanguages, fixedTools, getBackground, improvementSlots, languagePickCount, pointBuyCost,
  raceById, racialBonuses, racialSkills, racialLanguages, racialWeapons, bookOrigin, rulesEdition, subclassOf, subclassesFor, toolPickGroups,
  type Ability, type CharacterDraft, type SkillId,
} from '../rules'

export type StepId = 'race' | 'class' | 'abilities' | 'skills' | 'equipment' | 'details'

/** Skills granted automatically by race and background (not choosable). */
export function grantedSkills(d: CharacterDraft): Set<SkillId> {
  return new Set([
    ...racialSkills(d),
    ...(getBackground(d)?.skillProficiencies ?? []),
  ])
}

/** Skill picks: the first class's list, plus picks of any skill from the race and feats (2024 Skilled) as `raceCount`. */
export function skillPicks(d: CharacterDraft) {
  const cls = classById(d.classes[0]?.classId ?? '', d.rulesEdition)
  const free = (raceById(d.raceId, d.rulesEdition)?.freeSkillChoices ?? 0) + featSkillPicks(d)
  return { classCount: cls?.skillChoices.count ?? 0, classFrom: cls?.skillChoices.from ?? [], raceCount: free }
}

/** Class entries at or past their subclass level. Classes with no subclass to choose from are skipped. */
export function subclassSlots(d: CharacterDraft) {
  return d.classes.filter(cl => {
    const def = classById(cl.classId, d.rulesEdition)
    return def && cl.level >= def.subclassLevel && subclassesFor(cl.classId, d.rulesEdition).length > 0
  })
}

const english: Translate = (key, vars) => translate('en', key, vars)
/** Localised SRD names (useI18n's `term`). */
type Term = (kind: string, id: string, name: string) => string

/** Problems that block leaving a step. Empty means the step is complete. */
export function stepIssues(step: StepId, d: CharacterDraft, t: Translate = english): string[] {
  const out: string[] = []
  const edition = rulesEdition(d)
  const race = raceById(d.raceId, edition)
  const className = (id: string) => classById(id, edition)?.name ?? id
  switch (step) {
    case 'race':
      if (!race) out.push(t('builder.issue.race'))
      else if (race.subraces?.length && !race.subraces.some(s => s.id === d.subraceId)) out.push(t('builder.issue.subrace'))
      if (race?.traitChoice && !race.traitChoice.options.some(o => o.id === d.traitChoices?.[race.traitChoice!.id])) {
        out.push(t('builder.issue.traitChoice', { trait: race.traitChoice.name }))
      }
      if (race?.originFeatChoice && featById(d.originFeatId ?? '', edition)?.category !== 'origin') out.push(t('builder.issue.originFeat'))
      break
    case 'class':
      if (!classById(d.classes[0]?.classId ?? '', edition)) out.push(t('builder.issue.class'))
      for (const cl of subclassSlots(d)) {
        if (cl.subclassId === CUSTOM_SUBCLASS) {
          if (!subclassOf(d, cl)?.name.trim()) out.push(t('builder.issue.customSubclass', { title: classById(cl.classId, edition)!.subclassTitle }))
        } else if (!subclassesFor(cl.classId, edition).some(s => s.id === cl.subclassId)) {
          out.push(t('builder.issue.subclass', { className: className(cl.classId), title: classById(cl.classId, edition)!.subclassTitle }))
        }
      }
      for (const x of classChoices(d)) {
        if (!x.picked) out.push(t('builder.issue.classChoice', { className: className(x.classId), choice: x.choice.name }))
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
      } else if (d.abilityMethod === 'rolled') {
        if (!d.rolledScores?.length) out.push(t('builder.issue.rollFirst'))
        else if (!usesRolledPool(d.baseAbilities, d.rolledScores)) out.push(t('builder.issue.rolled'))
      } else if (scores.some(s => s < 3 || s > 20)) {
        out.push(t('builder.issue.manualRange'))
      }
      const free = edition === '2014' ? race?.freeAbilityBonuses : undefined
      if (free && d.freeAbilityBonuses.length !== free.count) out.push(t('builder.issue.freeBonus', { count: free.count }))
      if (edition === '2024') {
        // Any ability works (the background's three are a suggestion, see stepWarnings); only the +2/+1 shape is required.
        const n = (a: string) => d.freeAbilityBonuses.filter(x => x === a).length
        if (d.freeAbilityBonuses.length !== 3 || d.freeAbilityBonuses.some(a => n(a) > 2)) out.push(t('builder.issue.bgBonus'))
      }
      for (const slot of improvementSlots(d)) {
        const imp = d.improvements?.find(i => i.classId === slot.classId && i.level === slot.level)
        const points = ABILITIES.reduce((n, a) => n + (imp?.abilities?.[a] ?? 0), 0)
        const feat = imp?.featId ? featById(imp.featId, edition) : undefined
        const choice = feat?.effects.find(e => e.kind === 'abilityChoice')
        const done = imp?.featId ? !!feat && (!choice || (choice.kind === 'abilityChoice' && !!imp.featAbility && choice.from.includes(imp.featAbility))) : points === 2
        if (!done) out.push(t('builder.issue.asi', { className: className(slot.classId), level: slot.level }))
      }
      // Missing multiclass minimums only warn (MulticlassPicker, derive warnings): tables often allow it.
      break
    }
    case 'skills': {
      const { classCount, raceCount } = skillPicks(d)
      const granted = grantedSkills(d)
      if (d.chosenSkills.some(s => granted.has(s))) out.push(t('builder.issue.skillGranted'))
      // Skills off the class list only warn (stepWarnings): the count is what matters.
      if (d.chosenSkills.length !== classCount + raceCount) {
        out.push(raceCount
          ? t('builder.issue.skillsMixed', { classCount, raceCount })
          : t('builder.issue.skillsClass', { classCount }))
      }
      if (!getBackground(d)) out.push(t('builder.issue.background'))
      if (d.backgroundId === CUSTOM_BACKGROUND && edition === '2014') {
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
      // Any tool fills a pick; one outside the group's list only warns (stepWarnings).
      const toolsOk = groups.every(g => {
        const picks = tools.slice(at, (at += g.count))
        return picks.length === g.count && picks.every(p => !!p && !known.includes(p))
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

/**
 * Choices that leave the book but are fine at many tables. They never block a step: the builder shows them
 * as notes so the player can check with their DM. Hard blocks (stepIssues) are only for missing picks.
 */
export function stepWarnings(step: StepId, d: CharacterDraft, t: Translate = english, term: Term = (_kind, _id, name) => name): string[] {
  const out: string[] = []
  const abbr = (list: Ability[]) => [...new Set(list)].map(a => term('abilityShort', a, a.toUpperCase())).join(', ')
  const edition = rulesEdition(d)
  const race = raceById(d.raceId, edition)
  switch (step) {
    case 'race': {
      const book = bookOrigin(d)
      if (edition === '2014' && (racialSkills(d).join() !== book.skills.join() || racialLanguages(d).join() !== book.languages.join() || racialWeapons(d).join() !== book.weapons.join())) {
        out.push(t('builder.warn.originSwapped'))
      }
      break
    }
    case 'abilities': {
      if (edition === '2024') {
        const bg = getBackground(d)
        const listed = bg?.abilityScores ?? []
        const off = d.freeAbilityBonuses.filter(a => !listed.includes(a))
        if (bg && off.length) out.push(t('builder.warn.bgBonus', { background: term('background', bg.id, bg.name), abilities: abbr(off) }))
      }
      const free = edition === '2014' ? race?.freeAbilityBonuses : undefined
      const excluded = free ? d.freeAbilityBonuses.filter(a => free.exclude.includes(a)) : []
      if (race && excluded.length) out.push(t('builder.warn.freeExcluded', { race: term('race', race.id, race.name), abilities: abbr(excluded) }))
      if (fixedRacialBonuses(d).some(b => b.ability !== b.book)) out.push(t('builder.warn.racialMoved'))
      if (ABILITIES.every(a => d.baseAbilities[a] > 0)) {
        const racial = racialBonuses(d)
        const asi = improvementBonuses(d)
        for (const a of ABILITIES) {
          if (asi[a] && d.baseAbilities[a] + racial[a] + asi[a] > 20) out.push(t('builder.warn.asiCap', { ability: abbr([a]) }))
        }
      }
      for (const slot of improvementSlots(d)) {
        const imp = d.improvements?.find(i => i.classId === slot.classId && i.level === slot.level)
        const feat = imp?.featId ? featById(imp.featId, edition) : undefined
        if (feat?.minLevel && feat.minLevel > slot.level) out.push(t('builder.warn.featLevel', { feat: term('feat', feat.id, feat.name), level: feat.minLevel }))
      }
      break
    }
    case 'skills': {
      const { classCount, classFrom } = skillPicks(d)
      const fromClass = d.chosenSkills.filter(s => classFrom.includes(s)).length
      if (classCount && d.chosenSkills.length && fromClass < Math.min(classCount, d.chosenSkills.length)) out.push(t('builder.warn.skillsOffList'))
      const tools = d.chosenTools ?? []
      let at = 0
      const off = toolPickGroups(d).some(g => tools.slice(at, (at += g.count)).some(p => p && !g.from.includes(p)))
      if (off) out.push(t('builder.warn.toolsOffList'))
      break
    }
  }
  return out
}

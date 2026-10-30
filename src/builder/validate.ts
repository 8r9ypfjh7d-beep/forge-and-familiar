import { translate, type Translate } from '../i18n/translate'
import { coinText } from './shop'
import {
  ABILITIES, ALL_SKILLS, CUSTOM_BACKGROUND, CUSTOM_FEAT, classPickSlots, getProficiencies, getWeaponMasteryCount, MASTERY_WEAPONS, CUSTOM_SUBCLASS, POINT_BUY_BUDGET, STANDARD_ARRAY, usesRolledPool, classById, classChoices, featById, featSkillPicks, fixedRacialBonuses, improvementBonuses, improvementFeat,
  fixedLanguages, fixedTools, getBackground, improvementSlots, languagePickCount, pointBuyCost,
  flexibleBonuses, pickedOptions, raceProfile, racialBonuses, racialSkills, racialLanguages, racialWeapons, bookOrigin, rulesEdition, startingCoins, SECRET_LANGUAGES, subclassById, subclassOf, subclassPickLists, toolPickGroups,
  type Ability, type CharacterDraft, type ClassPick, type SkillId,
} from '../rules'

export type StepId = 'race' | 'class' | 'abilities' | 'skills' | 'spells' | 'equipment' | 'details'
export const STEP_IDS: StepId[] = ['race', 'class', 'abilities', 'skills', 'spells', 'equipment', 'details']

/** Skills granted automatically by race and background (not choosable). */
export function grantedSkills(d: CharacterDraft): Set<SkillId> {
  return new Set([
    ...racialSkills(d),
    ...(getBackground(d)?.skillProficiencies ?? []),
  ])
}

/**
 * Skill picks: the first class's list, picks of any skill from the race and feats (2024 Skilled) as `raceCount`,
 * and the background's short list (Haunted One) as `bgCount`/`bgFrom`.
 */
export function skillPicks(d: CharacterDraft) {
  const cls = classById(d.classes[0]?.classId ?? '', d.rulesEdition)
  const free = raceProfile(d).freeSkillChoices + featSkillPicks(d)
  const bg = getBackground(d)?.skillChoices
  return {
    classCount: cls?.skillChoices.count ?? 0, classFrom: cls?.skillChoices.from ?? [], raceCount: free,
    bgCount: bg?.count ?? 0, bgFrom: bg?.from ?? [],
  }
}

/** Class entries at or past their subclass level. A class with no listed subclasses (a new homebrew class) still gets one: Custom. */
export function subclassSlots(d: CharacterDraft) {
  return d.classes.filter(cl => {
    const def = classById(cl.classId, d.rulesEdition)
    return def && cl.level >= def.subclassLevel
  })
}

/** Skills the draft is proficient in before Expertise: race, background, chosen skills and skill picks (Primal Knowledge). */
export function draftProficientSkills(d: CharacterDraft): Set<SkillId> {
  const extra = classPickSlots(d).flatMap(s => (s.pick.kind === 'skill' ? s.picked : [])) as SkillId[]
  return new Set([...grantedSkills(d), ...d.chosenSkills, ...extra])
}

/** Skills a pick suggests; the rest only warn. Expertise needs proficiency (Scholar also its list); a skill pick wants a new skill. */
export function suggestedForPick(d: CharacterDraft, pick: ClassPick): SkillId[] {
  if (pick.kind !== 'expertise') {
    const known = new Set([...grantedSkills(d), ...d.chosenSkills])
    return (pick.from ?? ALL_SKILLS).filter(s => !known.has(s))
  }
  const prof = draftProficientSkills(d)
  return (pick.from ?? ALL_SKILLS).filter(s => prof.has(s))
}

/** Weapons a draft can master without a warning: ones it is proficient with (Barbarian: melee only). */
export function suggestedMasteryWeapons(d: CharacterDraft): string[] {
  const { weapons, weaponIds } = getProficiencies(d)
  const meleeOnly = d.classes.every(cl => cl.classId === 'barbarian')
  return MASTERY_WEAPONS.filter(w => (weapons.has(w.category) || weaponIds.has(w.id)) && !(meleeOnly && w.properties.includes('ranged'))).map(w => w.id)
}

const english: Translate = (key, vars) => translate('en', key, vars)
/** Localised SRD names (useI18n's `term`). */
export type Term = (kind: string, id: string, name: string) => string

/** Problems that block leaving a step. Empty means the step is complete. */
export function stepIssues(step: StepId, d: CharacterDraft, t: Translate = english, term: Term = (_kind, _id, name) => name): string[] {
  const out: string[] = []
  const edition = rulesEdition(d)
  const profile = raceProfile(d)
  const race = profile.race
  const className = (id: string) => term('class', id, classById(id, edition)?.name ?? id)
  const subclassTitle = (id: string) => { const title = classById(id, edition)!.subclassTitle; return term('feature', title, title) }
  switch (step) {
    case 'race':
      if (!race) out.push(t('builder.issue.race'))
      else if (race.subraces?.length && !race.subraceOptional && !race.subraces.some(s => s.id === d.subraceId)) out.push(t('builder.issue.subrace'))
      if (race?.traitChoice && !race.traitChoice.options.some(o => o.id === d.traitChoices?.[race.traitChoice!.id])) {
        out.push(t('builder.issue.traitChoice', { trait: race.traitChoice.name }))
      }
      for (const ch of profile.choices) {
        const picked = pickedOptions(d, ch.id).filter(id => ch.options.some(o => o.id === id))
        if (picked.length !== Math.min(ch.count ?? 1, ch.options.length)) out.push(t('builder.issue.traitChoice', { trait: ch.name }))
      }
      if (profile.featChoice) {
        const ok = d.originFeatId === CUSTOM_FEAT ? !!d.customOriginFeat?.name.trim() : !!featById(d.originFeatId ?? '', edition)
        if (!ok) out.push(t(profile.featChoice === 'origin' ? 'builder.issue.originFeat' : 'builder.issue.raceFeat'))
      }
      break
    case 'class':
      if (!classById(d.classes[0]?.classId ?? '', edition)) out.push(t('builder.issue.class'))
      for (const cl of subclassSlots(d)) {
        if (cl.subclassId === CUSTOM_SUBCLASS) {
          if (!subclassOf(d, cl)?.name.trim()) out.push(t('builder.issue.customSubclass', { title: subclassTitle(cl.classId) }))
        } else if (!cl.subclassId || (!subclassOf(d, cl) && subclassById(cl.subclassId, edition))) {
          // Another class's subclass is a wrong pick; an id that isn't found at all (homebrew from another device) is kept and only warned about.
          out.push(t('builder.issue.subclass', { className: className(cl.classId), title: subclassTitle(cl.classId) }))
        }
      }
      for (const x of classChoices(d)) {
        // Optional rules (Tasha's) left unpicked keep the base rules.
        if (!x.picked && !x.choice.optional) out.push(t('builder.issue.classChoice', { className: className(x.classId), choice: term('feature', x.choice.name, x.choice.name) }))
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
      const free = edition === '2014' ? profile.freeAbilityBonuses : undefined
      if (free && d.freeAbilityBonuses.length !== free.count) out.push(t('builder.issue.freeBonus', { count: free.count }))
      if (edition === '2014' && profile.flexibleAbilityBonuses) {
        const sum = ABILITIES.reduce((n, a) => n + flexibleBonuses(d.freeAbilityBonuses)[a], 0)
        if (sum !== 3 || d.freeAbilityBonuses.length !== 3) out.push(t('builder.issue.flexibleBonus'))
      }
      if (edition === '2024') {
        // Any ability works (the background's three are a suggestion, see stepWarnings); only the +2/+1 shape is required.
        const n = (a: string) => d.freeAbilityBonuses.filter(x => x === a).length
        if (d.freeAbilityBonuses.length !== 3 || d.freeAbilityBonuses.some(a => n(a) > 2)) out.push(t('builder.issue.bgBonus'))
      }
      for (const slot of improvementSlots(d)) {
        const imp = d.improvements?.find(i => i.classId === slot.classId && i.level === slot.level)
        const points = ABILITIES.reduce((n, a) => n + (imp?.abilities?.[a] ?? 0), 0)
        const feat = imp?.featId && (imp.featId !== CUSTOM_FEAT || imp.customFeat?.name.trim()) ? improvementFeat(d, imp) : undefined
        const choice = feat?.effects.find(e => e.kind === 'abilityChoice')
        const done = imp?.featId ? !!feat && (!choice || (choice.kind === 'abilityChoice' && !!imp.featAbility && choice.from.includes(imp.featAbility))) : points === 2
        if (!done) out.push(t('builder.issue.asi', { className: className(slot.classId), level: slot.level }))
      }
      // Missing multiclass minimums only warn (MulticlassPicker, derive warnings): tables often allow it.
      break
    }
    case 'skills': {
      const { classCount, raceCount, bgCount } = skillPicks(d)
      const granted = grantedSkills(d)
      if (d.chosenSkills.some(s => granted.has(s))) out.push(t('builder.issue.skillGranted'))
      // Skills off the class and background lists only warn (stepWarnings): the count is what matters.
      if (bgCount && d.chosenSkills.length !== classCount + raceCount + bgCount) out.push(t('builder.issue.skillsBackground', { count: bgCount }))
      if (d.chosenSkills.length !== classCount + raceCount + bgCount) {
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
      for (const { classId, pick, picked } of classPickSlots(d)) {
        if (pick.kind !== 'language' && picked.length !== pick.count) out.push(t('builder.issue.classPick', { className: className(classId), pick: term('feature', pick.name, pick.name), count: pick.count }))
      }
      break
    }
    case 'spells':
      // Spell counts are guidance only: the Spells step shows how many are picked of the usual number.
      break
    case 'equipment': {
      const count = getWeaponMasteryCount(d)
      if (count && (d.weaponMasteries ?? []).slice(0, count).length !== count) out.push(t('builder.issue.mastery', { count }))
      break
    }
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
  const profile = raceProfile(d)
  const race = profile.race
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
      const free = edition === '2014' ? profile.freeAbilityBonuses : undefined
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
    case 'class':
      for (const cl of subclassSlots(d)) {
        if (cl.subclassId && cl.subclassId !== CUSTOM_SUBCLASS && !subclassOf(d, cl)) {
          out.push(t('builder.warn.subclassMissing', { className: term('class', cl.classId, classById(cl.classId, edition)?.name ?? cl.classId), id: cl.subclassId }))
        }
      }
      // Subclass picks (maneuvers, runes...) only warn: a player may decide later, and tables bend the counts.
      for (const at of subclassPickLists(d)) {
        const vars = { feature: term('feature', at.list.feature, at.list.feature), className: term('class', at.classId, classById(at.classId, edition)?.name ?? at.classId), max: at.max, picked: at.picked.length }
        if (at.picked.length < at.max) out.push(t('builder.warn.picks', vars))
        else if (at.picked.length > at.max) out.push(t('builder.warn.picksOver', vars))
        for (const o of at.options.filter(o => o.minLevel && o.minLevel > at.level && at.picked.some(p => p.id === o.id))) {
          out.push(t('builder.warn.pickLevel', { option: term('option', o.id, o.name), level: o.minLevel! }))
        }
      }
      break
    case 'skills': {
      const { classCount, classFrom, bgCount, bgFrom } = skillPicks(d)
      const fromClass = d.chosenSkills.filter(s => classFrom.includes(s)).length
      const fromBg = d.chosenSkills.filter(s => bgFrom.includes(s) && !classFrom.includes(s)).length
      const listed = classCount + bgCount
      if (listed && d.chosenSkills.length && Math.min(fromClass, classCount) + fromBg < Math.min(listed, d.chosenSkills.length)) out.push(t('builder.warn.skillsOffList'))
      const tools = d.chosenTools ?? []
      let at = 0
      const off = toolPickGroups(d).some(g => tools.slice(at, (at += g.count)).some(p => p && !g.from.includes(p)))
      if (off) out.push(t('builder.warn.toolsOffList'))
      const picked = [...(d.chosenLanguages ?? []), ...(d.backgroundId === CUSTOM_BACKGROUND ? d.customBackground?.languages ?? [] : [])]
      const teacher: Record<string, string> = { Druidic: 'druid', "Thieves' Cant": 'rogue' }
      for (const lang of SECRET_LANGUAGES) {
        if (picked.includes(lang) && !d.classes.some(cl => cl.classId === teacher[lang])) out.push(t('builder.warn.secretLanguage', { language: term('language', lang, lang) }))
      }
      // Expertise outside the skills you're proficient in (or Scholar's list), or a Primal Knowledge skill off the class list.
      const prof = draftProficientSkills(d)
      for (const { pick, picked } of classPickSlots(d)) {
        if (pick.kind === 'language') continue
        const offList = picked.some(s => (pick.from && !pick.from.includes(s as SkillId)) || (pick.kind === 'expertise' && !prof.has(s as SkillId)))
        if (offList) out.push(t(pick.kind === 'expertise' ? 'builder.warn.expertiseOffList' : 'builder.warn.pickOffList', { pick: term('feature', pick.name, pick.name) }))
      }
      break
    }
    case 'equipment': {
      const ok = suggestedMasteryWeapons(d)
      const unproficient = (d.weaponMasteries ?? []).slice(0, getWeaponMasteryCount(d)).some(id => !ok.includes(id))
      if (unproficient) out.push(t('builder.warn.masteryOffList'))
      const { leftCp } = startingCoins(d)
      if (leftCp < 0) out.push(t('builder.warn.overBudget', { over: coinText(-leftCp, t) }))
      break
    }
  }
  return out
}

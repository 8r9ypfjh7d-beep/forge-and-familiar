// Rolls a whole random level 1 character: every builder step filled in and valid.
// Randomness lives here, not in src/rules; pass a seeded rng in tests.
import { grantedSkills, skillPicks, subclassSlots, suggestedForPick, suggestedMasteryWeapons } from '../builder/validate'
import {
  ABILITIES, ALIGNMENTS, ALL_SKILLS, CUSTOM_BACKGROUND, tableLanguages, RACES, SPECIES, STANDARD_ARRAY,
  allFeats, anyFilter, classPickSlots, getWeaponMasteryCount, pickKey, anyOptions, backgroundsFor, choiceKey, classById, classChoices, classesFor, fixedLanguages, fixedTools,
  getBackground, languagePickCount, raceById, subclassesFor, toolPickGroups,
  type Ability, type CharacterDraft, type RulesEdition, type SkillId,
} from '../rules'
import { pick, randomName, type Rng } from './names'

/** Number of backstory hooks; their text is `random.hook.<n>` in the locales. */
export const HOOK_COUNT = 16

export const randomHookKey = (rng: Rng = Math.random) => `random.hook.${Math.floor(rng() * HOOK_COUNT) % HOOK_COUNT}`

/** `count` different items from `list`, in random order. */
function pickSome<T>(list: readonly T[], count: number, rng: Rng): T[] {
  const pool = [...list]
  const out: T[] = []
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0])
  return out
}

/** Standard array with the class's main abilities first, then CON and DEX; the rest shuffled. */
function abilitiesFor(primary: Ability[], rng: Rng) {
  const lead = [...new Set<Ability>([...primary, 'con', 'dex'])]
  const order = [...lead, ...pickSome(ABILITIES.filter(a => !lead.includes(a)), 6, rng)]
  const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  order.forEach((a, i) => { out[a] = STANDARD_ARRAY[i] })
  return out
}

/** A finished draft at level 1 for `edition`, using SRD content only. */
export function randomDraft(ownerId: string, edition: RulesEdition = '2014', rng: Rng = Math.random): CharacterDraft {
  const is2024 = edition === '2024'
  const race = pick(is2024 ? SPECIES : RACES, rng)
  const cls = pick(classesFor(edition).filter(c => !c.id.startsWith('hb:')), rng)
  const bg = pick(backgroundsFor(edition).filter(b => b.id !== CUSTOM_BACKGROUND), rng)
  const d: CharacterDraft = {
    ownerId,
    name: '',
    playerName: '',
    alignment: pick(ALIGNMENTS, rng),
    rulesEdition: is2024 ? '2024' : undefined,
    raceId: race.id,
    subraceId: race.subraces?.length ? pick(race.subraces, rng).id : undefined,
    backgroundId: bg.id,
    classes: [{ classId: cls.id, level: 1 }],
    abilityMethod: 'standard',
    baseAbilities: abilitiesFor(cls.primary, rng),
    freeAbilityBonuses: [],
    chosenSkills: [],
    traitChoices: race.traitChoice ? { [race.traitChoice.id]: pick(race.traitChoice.options, rng).id } : {},
    featureChoices: {},
    improvements: [],
  }
  d.name = randomName(d.raceId, rng)

  // Clerics, Sorcerers and Warlocks (2014) pick a subclass at 1st level.
  for (const cl of subclassSlots(d)) {
    const options = subclassesFor(cl.classId, edition)
    if (options.length) cl.subclassId = pick(options, rng).id
  }
  for (const x of classChoices(d)) d.featureChoices![choiceKey(x.classId, x.choice.id)] = pick(x.choice.options, rng).id
  if (race.originFeatChoice) d.originFeatId = pick(allFeats(edition).filter(f => f.category === 'origin'), rng).id

  // Ability bonuses: 2014 Half-Elf style free +1s, 2024 background +2/+1 favouring the class's main ability.
  const free = raceById(d.raceId, edition)?.freeAbilityBonuses
  if (!is2024 && free) {
    const order = [...new Set<Ability>([...cls.primary, 'con', ...pickSome(ABILITIES, 6, rng)])]
    d.freeAbilityBonuses = order.filter(a => !free.exclude.includes(a)).slice(0, free.count)
  }
  if (is2024) {
    const allowed = getBackground(d)?.abilityScores ?? []
    const best = allowed.find(a => cls.primary.includes(a)) ?? pick(allowed, rng)
    const second = pick(allowed.filter(a => a !== best), rng)
    d.freeAbilityBonuses = [best, best, second]
  }

  const { classCount, classFrom, raceCount, bgCount, bgFrom } = skillPicks(d)
  const granted = grantedSkills(d)
  const fromBg = pickSome(bgFrom.filter(s => !granted.has(s)), bgCount, rng)
  const fromClass = pickSome(classFrom.filter(s => !granted.has(s) && !fromBg.includes(s)), classCount, rng)
  const any = pickSome((ALL_SKILLS as readonly SkillId[]).filter(s => !granted.has(s) && !fromClass.includes(s) && !fromBg.includes(s)), raceCount, rng)
  d.chosenSkills = [...fromClass, ...fromBg, ...any]

  // Expertise and Primal Knowledge, one class pick at a time so Expertise sees earlier skill picks.
  d.classPicks = {}
  for (const { classId, pick: p } of classPickSlots(d)) {
    if (p.kind !== 'language') d.classPicks[pickKey(classId, p.id)] = pickSome(suggestedForPick(d, p), p.count, rng)
  }
  d.weaponMasteries = pickSome(suggestedMasteryWeapons(d), getWeaponMasteryCount(d), rng)

  const knownLangs = fixedLanguages(d)
  d.chosenLanguages = pickSome(tableLanguages(edition).filter(l => !knownLangs.includes(l)), languagePickCount(d), rng)
  const knownTools = fixedTools(d)
  const tools: string[] = []
  for (const g of toolPickGroups(d)) tools.push(...pickSome(g.from.filter(x => !knownTools.includes(x) && !tools.includes(x)), g.count, rng))
  d.chosenTools = tools

  d.equipmentPicks = (classById(cls.id, edition)?.equipmentChoices ?? []).map(choice => {
    const option = Math.floor(rng() * choice.options.length) % choice.options.length
    const items = choice.options[option].items.flatMap(id => {
      const filter = anyFilter(id)
      return filter ? [pick(anyOptions(filter), rng).id] : []
    })
    return { option, items }
  })
  return d
}

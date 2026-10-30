// Rolls a whole random level 1 character: every builder step filled in and valid.
// Randomness lives here, not in src/rules; pass a seeded rng in tests.
import { grantedSkills, skillPicks, subclassSlots, suggestedForPick, suggestedMasteryWeapons } from '../builder/validate'
import {
  ABILITIES, ALIGNMENTS, ALL_SKILLS, CUSTOM_BACKGROUND, tableLanguages, RACES, SPECIES, STANDARD_ARRAY,
  allFeats, anyFilter, classPickSlots, getWeaponMasteryCount, pickKey, anyOptions, backgroundsFor, choiceKey, classById, classChoices, classesFor, fixedLanguages, fixedTools,
  getBackground, itemById, languagePickCount, raceById, subclassesFor, toolPickGroups,
  type Ability, type CharacterDraft, type ClassChoiceOption, type ClassDef, type Item, type RulesEdition, type SkillId,
} from '../rules'
import { editionOf } from '../spellbook/access'
import { pick, randomName, type Rng } from './names'
import { loadSpellLibrary, randomSpells } from './spells'

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

type Weapon = Extract<Item, { kind: 'weapon' }>
const isWeapon = (i: Item | undefined): i is Weapon => i?.kind === 'weapon'
const melee = (w: Weapon) => !w.properties.includes('ranged')
const twoHanded = (w: Weapon) => w.properties.includes('two-handed')
/** The items of `list` that pass `keep`, or the whole list when none do. */
const narrow = <T>(list: T[], keep: (x: T) => boolean) => (list.some(keep) ? list.filter(keep) : list)

/** One kit option per class gear choice (never the coins-only one), with "any weapon" slots that go together. */
function randomKit(def: ClassDef | undefined, rng: Rng): NonNullable<CharacterDraft['equipmentPicks']> {
  return (def?.equipmentChoices ?? []).map(choice => {
    const withItems = choice.options.flatMap((o, i) => (o.items.length ? [i] : []))
    const option = withItems.length ? pick(withItems, rng) : 0
    const slots = choice.options[option].items
    const shield = slots.includes('shield')
    // Two "any martial weapon" slots: half the time a pair of light weapons for two-weapon fighting.
    const pair = slots.filter(id => anyFilter(id)).length > 1 && rng() < 0.5
    const items = slots.flatMap(id => {
      const filter = anyFilter(id)
      if (!filter) return []
      let options = anyOptions(filter)
      // With a shield, a weapon for one hand.
      if (shield) options = narrow(options, i => isWeapon(i) && melee(i) && !twoHanded(i))
      else if (pair) options = narrow(options, i => isWeapon(i) && melee(i) && i.properties.includes('light'))
      return [pick(options, rng).id]
    })
    return { option, items }
  })
}

/** Every item the class kit gives: its fixed gear plus the picked options, "any" slots filled in. */
export function kitItems(def: ClassDef | undefined, picks: CharacterDraft['equipmentPicks'] = []): string[] {
  const out = [...(def?.startingEquipment ?? [])]
  ;(def?.equipmentChoices ?? []).forEach((choice, i) => {
    const p = picks[i]
    if (!p) return
    let n = 0
    for (const id of choice.options[p.option]?.items ?? []) out.push(anyFilter(id) ? p.items[n++] : id)
  })
  return out.filter(Boolean)
}

/** What the kit is good for, to pick a fighting style and main ability that suit it. */
function gearTraits(items: string[]) {
  const all = items.map(itemById)
  const weapons = all.filter(isWeapon)
  const armor = all.filter((i): i is Extract<Item, { kind: 'armor' }> => i?.kind === 'armor')
  const meleeWeapons = weapons.filter(melee)
  return {
    armor: armor.some(a => a.category !== 'shield'),
    heavyArmor: armor.some(a => a.category === 'heavy'),
    shield: armor.some(a => a.category === 'shield'),
    ranged: weapons.some(w => !melee(w)),
    thrown: weapons.some(w => w.properties.includes('thrown')),
    twoHanded: meleeWeapons.some(twoHanded),
    oneHanded: meleeWeapons.some(w => !twoHanded(w)),
    lightPair: meleeWeapons.filter(w => w.properties.includes('light')).length >= 2,
    finesse: meleeWeapons.some(w => w.properties.includes('finesse')),
  }
}
type Gear = ReturnType<typeof gearTraits>

/** Fighting styles and the gear that makes them work. Styles not listed (cantrips, maneuvers) are never rolled. */
const STYLE_FITS: Record<string, (g: Gear) => boolean> = {
  archery: g => g.ranged,
  defense: g => g.armor,
  dueling: g => g.oneHanded && !g.lightPair,
  'great-weapon-fighting': g => g.twoHanded,
  protection: g => g.shield,
  'two-weapon-fighting': g => g.lightPair,
  'thrown-weapon-fighting': g => g.thrown,
}

/** A fighting style the character's gear can use; Defense (or any plain style) when nothing fits. */
function pickStyle(options: ClassChoiceOption[], gear: Gear, rng: Rng): ClassChoiceOption {
  const plain = options.filter(o => STYLE_FITS[o.id])
  const fits = plain.filter(o => STYLE_FITS[o.id](gear))
  return pick(fits.length ? fits : narrow(plain.length ? plain : options, o => o.id === 'defense'), rng)
}

/** A finished draft at level 1 for `edition`, using SRD content only. */
export function randomDraft(ownerId: string, edition: RulesEdition = '2014', rng: Rng = Math.random): CharacterDraft {
  const is2024 = edition === '2024'
  const race = pick(is2024 ? SPECIES : RACES, rng)
  const cls = pick(classesFor(edition).filter(c => !c.id.startsWith('hb:')), rng)
  const bg = pick(backgroundsFor(edition).filter(b => b.id !== CUSTOM_BACKGROUND), rng)
  const def = classById(cls.id, edition)
  const equipmentPicks = randomKit(def, rng)
  const kit = kitItems(def, equipmentPicks)
  const gear = gearTraits(kit)
  // Strength-or-Dexterity classes (Fighter) lead with Dexterity for a bow or finesse kit without heavy gear.
  const dexFirst = cls.primary.includes('str') && cls.primary.includes('dex') && (gear.ranged || gear.finesse) && !gear.heavyArmor && !gear.twoHanded
  const primary = dexFirst ? ['dex' as const, ...cls.primary.filter(a => a !== 'dex')] : cls.primary
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
    baseAbilities: abilitiesFor(primary, rng),
    freeAbilityBonuses: [],
    chosenSkills: [],
    traitChoices: race.traitChoice ? { [race.traitChoice.id]: pick(race.traitChoice.options, rng).id } : {},
    featureChoices: {},
    improvements: [],
    equipmentPicks,
  }
  d.name = randomName(d.raceId, rng)

  // Clerics, Sorcerers and Warlocks (2014) pick a subclass at 1st level.
  for (const cl of subclassSlots(d)) {
    const options = subclassesFor(cl.classId, edition)
    if (options.length) cl.subclassId = pick(options, rng).id
  }
  for (const x of classChoices(d)) {
    d.featureChoices![choiceKey(x.classId, x.choice.id)] = (x.choice.pool === 'fightingStyle' ? pickStyle(x.choice.options, gear, rng) : pick(x.choice.options, rng)).id
  }
  if (race.originFeatChoice) d.originFeatId = pick(allFeats(edition).filter(f => f.category === 'origin'), rng).id

  // Ability bonuses: 2014 Half-Elf style free +1s, 2024 background +2/+1 favouring the class's main ability.
  const free = raceById(d.raceId, edition)?.freeAbilityBonuses
  if (!is2024 && free) {
    const order = [...new Set<Ability>([...primary, 'con', ...pickSome(ABILITIES, 6, rng)])]
    d.freeAbilityBonuses = order.filter(a => !free.exclude.includes(a)).slice(0, free.count)
  }
  if (is2024) {
    const allowed = getBackground(d)?.abilityScores ?? []
    const best = allowed.find(a => primary.includes(a)) ?? pick(allowed, rng)
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
  // Weapon Mastery: the kit's own weapons first, then others the class can use.
  const masteryCount = getWeaponMasteryCount(d)
  const masteryOptions = suggestedMasteryWeapons(d)
  const owned = masteryOptions.filter(id => kit.includes(id))
  d.weaponMasteries = [...pickSome(owned, masteryCount, rng), ...pickSome(masteryOptions.filter(id => !owned.includes(id)), masteryCount - owned.length, rng)]

  const knownLangs = fixedLanguages(d)
  d.chosenLanguages = pickSome(tableLanguages(edition).filter(l => !knownLangs.includes(l)), languagePickCount(d), rng)
  const knownTools = fixedTools(d)
  const tools: string[] = []
  for (const g of toolPickGroups(d)) tools.push(...pickSome(g.from.filter(x => !knownTools.includes(x) && !tools.includes(x)), g.count, rng))
  d.chosenTools = tools

  return d
}

/** `randomDraft` with spells picked too. The spell lists load from the content library; if they can't, no spells. */
export async function randomCharacterDraft(ownerId: string, edition: RulesEdition = '2014', rng: Rng = Math.random): Promise<CharacterDraft> {
  const d = randomDraft(ownerId, edition, rng)
  try {
    d.spells = randomSpells(d, await loadSpellLibrary(editionOf(d)), rng)
  } catch { /* the Spells step still lets the player pick */ }
  return d
}

/** Whether the player has made real picks, so rolling would throw them away (the rules edition alone doesn't count). */
export const hasPicks = (d: CharacterDraft) =>
  !!(d.name || d.raceId || d.backgroundId || d.classes.length || Object.values(d.baseAbilities).some(Boolean))

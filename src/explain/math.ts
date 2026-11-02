// "Show the math": breaks each derived number into the parts that add up to it.
// Pure, like src/rules. Every breakdown is additive (the line values sum to the
// total), and explain.test.ts checks each total against derive() so the two never drift.
import type { Character } from '../model/character'
import {
  applyItemAbilities, auraOfProtection, effectsOf, entryItem, itemBonuses,
  ABILITY_NAMES, SKILLS, abilityMod, backgroundBonuses, getBackground, classById, derive, featBonus, featEffects, fixedRacialBonuses, getAbilityMods, getAbilityScores,
  getArmorClass, getEquippedArmor, getMaxHp, liveEffects, getSkillProficiencies, proficiencyBonus, naturalArmorAc, raceProfile, rulesEdition, totalLevel, flexibleBonuses,
  type Ability, type ClassDef, type SkillId,
} from '../rules'
import { translate, type Translate } from '../i18n/translate'

export interface MathLine {
  label: string
  value: number
}

export interface StatMath {
  title: string
  total: number
  /** Show the total as a modifier (+3) rather than a plain number (15). */
  signed: boolean
  lines: MathLine[]
  notes: string[]
}

export type StatKey =
  | 'ac' | 'initiative' | 'speed' | 'proficiency' | 'maxHp' | 'passivePerception'
  | 'spellDc' | 'spellAttack' | 'carryingCapacity'
  | `ability:${Ability}` | `mod:${Ability}` | `save:${Ability}` | `skill:${SkillId}` | `attack:${number}`

/** How labels are worded: English by default, the UI passes its own language (see ShowMath). */
export interface MathWords {
  t: Translate
  ability: (a: Ability) => string
  abilityShort: (a: Ability) => string
  className: (id: string, englishName: string) => string
  skill: (s: SkillId) => string
  /** An item, race, background, feat or feature by its English name. */
  name: (englishName: string) => string
  attackName: (englishName: string) => string
  damageType: (type: string) => string
}

export const ENGLISH_WORDS: MathWords = {
  t: (key, vars) => translate('en', key, vars),
  ability: a => ABILITY_NAMES[a],
  abilityShort: a => a.toUpperCase(),
  className: (_id, name) => name,
  skill: s => SKILLS[s].name,
  name: n => n,
  attackName: n => n,
  damageType: d => d,
}

// Set for the length of one explain() call; every function below is synchronous.
let w: MathWords = ENGLISH_WORDS
const ABBR = (a: Ability) => w.abilityShort(a)
const mod = (a: Ability, why?: string) => (why ? w.t('math.modOf', { ability: ABBR(a), why }) : w.t('math.mod', { ability: ABBR(a) }))
const cls = (def: ClassDef) => w.className(def.id, def.name)

/** One line per worn item that adds to this kind of number. */
const itemLines = (...args: Parameters<typeof itemBonuses>): MathLine[] =>
  itemBonuses(...args).map(b => ({ label: w.name(b.source), value: b.value }))

function classesOf(c: Character): { def: ClassDef; level: number }[] {
  return c.classes.flatMap(cl => {
    const def = classById(cl.classId, rulesEdition(c))
    return def ? [{ def, level: cl.level }] : []
  })
}

function make(title: string, lines: MathLine[], opts: { signed?: boolean; notes?: string[] } = {}): StatMath {
  return { title, total: lines.reduce((n, l) => n + l.value, 0), signed: !!opts.signed, lines, notes: opts.notes ?? [] }
}

function profLine(c: Character): MathLine {
  return { label: w.t('math.profBonus'), value: proficiencyBonus(totalLevel(c)) }
}

function jackOfAllTrades(c: Character): number {
  const bard = classesOf(c).find(x => x.def.id === 'bard')
  return bard && bard.level >= 2 ? Math.floor(proficiencyBonus(totalLevel(c)) / 2) : 0
}

function abilityScore(c: Character, a: Ability): StatMath {
  const lines: MathLine[] = [{ label: w.t('math.baseScore'), value: c.baseAbilities[a] }]
  const profile = raceProfile(c)
  const { race, subrace: sub } = profile
  const is2014 = rulesEdition(c) === '2014'
  const fromBackground = is2014 ? 0 : backgroundBonuses(c)[a]
  if (fromBackground) lines.push({ label: w.t('math.yourPick', { source: getBackground(c) ? w.name(getBackground(c)!.name) : w.t('math.background') }), value: fromBackground })
  if (is2014 && race && profile.flexibleAbilityBonuses) {
    const v = flexibleBonuses(c.freeAbilityBonuses)[a]
    if (v) lines.push({ label: w.t('math.yourPick', { source: w.name(race.name) }), value: v })
  }
  for (const b of fixedRacialBonuses(c)) {
    if (b.ability === a) lines.push({ label: b.book === a ? w.name(b.source) : w.t('math.moved', { source: w.name(b.source) }), value: b.value })
  }
  const free = profile.freeAbilityBonuses
  if (is2014 && race && free && c.freeAbilityBonuses.slice(0, free.count).includes(a)) {
    lines.push({ label: w.t('math.yourPick', { source: w.name(sub?.freeAbilityBonuses ? sub.name : race.name) }), value: free.value ?? 1 })
  }
  const raw = lines.reduce((n, l) => n + l.value, 0)
  if (raw > 20) lines.push({ label: w.t('math.capped'), value: 20 - raw })
  const before = getAbilityScores({ ...c, inventory: [] })
  for (const l of applyItemAbilities(c, before).lines[a]) lines.push({ label: w.name(l.source), value: l.value })
  return make(w.ability(a), lines)
}

function abilityModifier(c: Character, a: Ability): StatMath {
  const score = getAbilityScores(c)[a]
  return make(w.t('math.modTitle', { ability: w.ability(a) }), [{ label: w.t('math.modFormula', { score }), value: abilityMod(score) }], { signed: true })
}

function save(c: Character, a: Ability): StatMath {
  const first = classesOf(c)[0]?.def
  const proficient = !!first?.savingThrows.includes(a)
  const lines = [{ label: mod(a), value: getAbilityMods(getAbilityScores(c))[a] }]
  const fromItem = effectsOf(c, 'saveProficiency').find(x => x.effect.ability === a)
  if (proficient) lines.push({ ...profLine(c), label: w.t('math.profFrom', { source: cls(first) }) })
  else if (fromItem) lines.push({ ...profLine(c), label: w.t('math.profFrom', { source: w.name(fromItem.source) }) })
  lines.push(...itemLines(c, 'saves'))
  for (const x of effectsOf(c, 'save')) if (x.effect.ability === a) lines.push({ label: w.name(x.source), value: x.effect.value })
  const aura = auraOfProtection(c)
  if (aura) lines.push({ label: w.t('math.aura'), value: aura })
  const notes = classesOf(c).length > 1 ? [w.t('math.saveFirstClass')] : []
  return make(w.t('math.saveTitle', { ability: w.ability(a) }), lines, { signed: true, notes })
}

function skillSources(c: Character, s: SkillId): string[] {
  const race = raceProfile(c)
  const bg = getBackground(c)
  const out: string[] = []
  if (c.chosenSkills.includes(s)) out.push(w.t('math.yourChoice'))
  if (race.race && race.skillProficiencies.includes(s)) out.push(w.name(race.subrace?.skillProficiencies?.includes(s) ? race.subrace.name : race.race.name))
  if (bg?.skillProficiencies.includes(s)) out.push(w.name(bg.name))
  return out
}

function skill(c: Character, s: SkillId): StatMath {
  const ability = SKILLS[s].ability
  const lines = [{ label: mod(ability), value: getAbilityMods(getAbilityScores(c))[ability] }]
  const fromItems = effectsOf(c, 'skillProficiency').filter(x => x.effect.skill === s)
  const expertise = fromItems.find(x => x.effect.expertise)
  if (expertise) lines.push({ ...profLine(c), label: w.t('math.profFrom', { source: skillSources(c, s).concat(fromItems.map(x => w.name(x.source))).join(', ') }) }, { ...profLine(c), label: w.t('math.expertise', { source: w.name(expertise.source) }) })
  else if (getSkillProficiencies(c).has(s) || fromItems.length) lines.push({ ...profLine(c), label: w.t('math.profFrom', { source: skillSources(c, s).concat(fromItems.map(x => w.name(x.source))).join(', ') }) })
  else if (jackOfAllTrades(c)) lines.push({ label: w.t('math.jack'), value: jackOfAllTrades(c) })
  lines.push(...itemLines(c, 'checks'))
  for (const x of effectsOf(c, 'skill')) if (x.effect.skill === s) lines.push({ label: w.name(x.source), value: x.effect.value })
  return make(w.skill(s), lines, { signed: true })
}

function armorClass(c: Character): StatMath {
  const mods = getAbilityMods(getAbilityScores(c))
  const { armor, shield } = getEquippedArmor(c)
  const lines: MathLine[] = []
  const notes: string[] = []
  if (armor) {
    lines.push({ label: w.name(armor.name), value: armor.baseAc })
    const dex = armor.dexCap === undefined ? mods.dex : Math.min(mods.dex, armor.dexCap)
    lines.push({ label: armor.dexCap === undefined ? mod('dex') : w.t('math.dexMax', { ability: ABBR('dex'), max: armor.dexCap }), value: dex })
  } else {
    lines.push({ label: w.t('ac.unarmored'), value: 10 }, { label: mod('dex'), value: mods.dex })
    let best = 0
    let from: ClassDef | undefined
    for (const { def } of classesOf(c)) {
      const extra = def.unarmoredDefense
      if (!extra) continue
      if (def.id === 'monk' && shield) { notes.push(w.t('math.monkShield')); continue }
      if (mods[extra] > best) { best = mods[extra]; from = def }
    }
    const natural = raceProfile(c).naturalArmor
    const naturalAc = naturalArmorAc(natural, mods)
    if (natural && naturalAc > 10 + mods.dex + best) {
      lines.length = 0
      lines.push({ label: w.name('Natural Armor'), value: natural.base })
      if (natural.dex) lines.push({ label: mod('dex'), value: mods.dex })
      if (natural.ability) lines.push({ label: mod(natural.ability), value: mods[natural.ability] })
    } else if (from) lines.push({ label: mod(from.unarmoredDefense!, `${w.name('Unarmored Defense')}, ${cls(from)}`), value: best })
  }
  const featAc = featBonus(c, 'ac') + (armor ? featBonus(c, 'armoredAc') : 0)
  if (featAc) lines.push({ label: w.t('cs.feats'), value: featAc })
  if (shield) lines.push({ label: w.name(shield.name), value: shield.baseAc })
  const magic = c.inventory.filter(e => e.equipped && e.magicBonus && entryItem(e)?.kind === 'armor').reduce((n, e) => n + (e.magicBonus ?? 0), 0)
  if (magic) lines.push({ label: w.t('math.magicArmor'), value: magic })
  lines.push(...itemLines(c, 'ac', !armor && !shield, undefined, !!armor))
  // Mage Armor and Barkskin replace the base or set a floor: one line with what they add.
  const shaping = liveEffects(c).find(e => e.acBase || e.acMin)
  const gap = getArmorClass(c).value - lines.reduce((n, l) => n + l.value, 0)
  if (shaping && gap) lines.push({ label: w.name(shaping.name), value: gap })
  return make(w.t('math.acTitle'), lines, { notes })
}

function initiative(c: Character): StatMath {
  const lines = [{ label: mod('dex'), value: getAbilityMods(getAbilityScores(c)).dex }]
  if (featEffects(c, 'initiativeProficiency').length) lines.push({ ...profLine(c), label: w.t('math.profFrom', { source: w.name('Alert') }) })
  else if (jackOfAllTrades(c)) lines.push({ label: w.t('math.jack'), value: jackOfAllTrades(c) })
  if (featBonus(c, 'initiative')) lines.push({ label: w.t('cs.feats'), value: featBonus(c, 'initiative') })
  lines.push(...itemLines(c, 'checks'), ...itemLines(c, 'initiative'))
  return make(w.t('math.initTitle'), lines, { signed: true })
}

const MONK_MOVEMENT: [number, number][] = [[18, 30], [14, 25], [10, 20], [6, 15], [2, 10]]

function speed(c: Character): StatMath {
  const { race, subrace: sub, speed: base } = raceProfile(c)
  const abilities = getAbilityScores(c)
  const { armor, shield } = getEquippedArmor(c)
  const lines: MathLine[] = [{ label: race ? w.t('math.walkOf', { source: w.name(sub?.speed ? sub.name : race.name) }) : w.t('math.walk'), value: base }]
  if (featBonus(c, 'speed')) lines.push({ label: w.t('cs.feats'), value: featBonus(c, 'speed') })
  if (armor?.category === 'heavy' && armor.strengthReq && abilities.str < armor.strengthReq) {
    lines.push({ label: w.t('math.needsStr', { armor: w.name(armor.name), ability: ABBR('str'), n: armor.strengthReq }), value: -10 })
  }
  const monk = classesOf(c).find(x => x.def.id === 'monk')
  if (monk && !armor && !shield) {
    lines.push({ label: `${w.name('Unarmored Movement')} (${w.className('monk', 'Monk')})`, value: MONK_MOVEMENT.find(([l]) => monk.level >= l)?.[1] ?? 0 })
  }
  const barb = classesOf(c).find(x => x.def.id === 'barbarian')
  if (barb && barb.level >= 5 && armor?.category !== 'heavy') lines.push({ label: `${w.name('Fast Movement')} (${w.className('barbarian', 'Barbarian')})`, value: 10 })
  lines.push(...itemLines(c, 'speed'))
  return make(w.t('math.speedTitle'), lines)
}

function proficiency(c: Character): StatMath {
  const level = totalLevel(c)
  const lines = [{ label: w.t('math.base'), value: 2 }]
  if (level > 4) lines.push({ label: w.t('math.profStep', { level }), value: proficiencyBonus(level) - 2 })
  return make(w.t('math.profBonus'), lines, { signed: true, notes: [w.t('math.profNote', { level })] })
}

function maxHp(c: Character): StatMath {
  const con = getAbilityMods(getAbilityScores(c)).con
  const { race, subrace: sub, hpPerLevel: perLevel } = raceProfile(c)
  const level = totalLevel(c)
  const lines: MathLine[] = []
  let floor = 0
  let n = 0
  for (const { def, level: l } of classesOf(c)) {
    const avg = def.hitDie / 2 + 1
    const startsAtOne = n === 0
    if (startsAtOne) lines.push({ label: w.t('math.hpFirst', { className: cls(def), die: def.hitDie }), value: def.hitDie })
    const rest = startsAtOne ? l - 1 : l
    if (rest > 0) lines.push({ label: w.t('math.hpMore', { className: cls(def), count: rest, avg, die: def.hitDie }), value: rest * avg })
    for (let i = 0; i < l; i++) {
      const roll = n++ === 0 ? def.hitDie : avg
      floor += Math.max(1, roll + con) - (roll + con)
    }
  }
  lines.push({ label: w.t('math.hpCon', { ability: ABBR('con'), count: level }), value: con * level })
  if (perLevel) lines.push({ label: w.t('math.hpRace', { source: w.name(sub?.hpPerLevel ? sub.name : race!.name), count: level }), value: perLevel * level })
  if (floor) lines.push({ label: w.t('math.hpFloor'), value: floor })
  lines.push(...itemLines(c, 'hp'))
  const base = getMaxHp(c)
  const sum = lines.reduce((t, l) => t + l.value, 0)
  if (base > sum) lines.push({ label: w.t('math.hpMin'), value: base - sum })
  const notes = [w.t('math.hpNote')]
  return make(w.t('math.hpTitle'), lines, { notes })
}

function passivePerception(c: Character): StatMath {
  const perception = skill(c, 'perception')
  return make(w.t('math.passiveTitle'), [{ label: w.t('math.base'), value: 10 }, ...perception.lines, ...itemLines(c, 'passivePerception')])
}

function spellcasting(c: Character, kind: 'spellDc' | 'spellAttack'): StatMath | null {
  const caster = classesOf(c).find(x => x.def.spellAbility)
  const a = caster?.def.spellAbility
  if (!caster || !a) return null
  const lines = [
    ...(kind === 'spellDc' ? [{ label: w.t('math.base'), value: 8 }] : []),
    profLine(c),
    { label: mod(a, w.t('math.spellcasting', { className: cls(caster.def) })), value: getAbilityMods(getAbilityScores(c))[a] },
    ...itemLines(c, kind),
  ]
  return kind === 'spellDc' ? make(w.t('stat.spellDc'), lines) : make(w.t('math.spellAttack'), lines, { signed: true })
}

function attack(c: Character, index: number): StatMath | null {
  const atk = derive(c).attacks[index]
  if (!atk) return null
  const lines = [{ label: mod(atk.ability), value: getAbilityMods(getAbilityScores(c))[atk.ability] }]
  if (atk.proficient) lines.push(profLine(c))
  lines.push(...itemLines(c, 'attack', true, atk.reach === undefined ? 'ranged' : 'melee'))
  const magic = atk.bonus - lines.reduce((t, l) => t + l.value, 0)
  if (magic) lines.push({ label: w.t('math.magicWeapon'), value: magic })
  const notes = [w.t('math.damageNote', { damage: atk.damage, type: w.damageType(atk.damageType), ability: ABBR(atk.ability) })]
  if (!atk.proficient) notes.push(w.t('math.notProficient'))
  return make(w.t('math.toHit', { name: w.attackName(atk.name) }), lines, { signed: true, notes })
}

function carryingCapacity(c: Character): StatMath {
  const str = getAbilityScores(c).str
  return make(w.t('math.carryTitle'), [{ label: w.t('math.carry', { ability: ABBR('str'), score: str }), value: str * 15 }])
}

/** The breakdown for one number on the sheet, or null when it does not apply (no spellcasting, no such attack). */
export function explain(c: Character, key: StatKey, words: MathWords = ENGLISH_WORDS): StatMath | null {
  const before = w
  w = words
  try { return explainWith(c, key) } finally { w = before }
}

function explainWith(c: Character, key: StatKey): StatMath | null {
  switch (key) {
    case 'ac': return armorClass(c)
    case 'initiative': return initiative(c)
    case 'speed': return speed(c)
    case 'proficiency': return proficiency(c)
    case 'maxHp': return maxHp(c)
    case 'passivePerception': return passivePerception(c)
    case 'spellDc':
    case 'spellAttack': return spellcasting(c, key)
    case 'carryingCapacity': return carryingCapacity(c)
  }
  const [kind, arg] = key.split(':') as [string, string]
  if (kind === 'ability') return abilityScore(c, arg as Ability)
  if (kind === 'mod') return abilityModifier(c, arg as Ability)
  if (kind === 'save') return save(c, arg as Ability)
  if (kind === 'skill') return skill(c, arg as SkillId)
  if (kind === 'attack') return attack(c, Number(arg))
  return null
}

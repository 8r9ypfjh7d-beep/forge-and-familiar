// "Show the math": breaks each derived number into the parts that add up to it.
// Pure, like src/rules. Every breakdown is additive (the line values sum to the
// total), and explain.test.ts checks each total against derive() so the two never drift.
import type { Character } from '../model/character'
import {
  applyItemAbilities, effectsOf, entryItem, itemBonuses,
  ABILITY_NAMES, SKILLS, abilityMod, backgroundBonuses, getBackground, classById, derive, featBonus, featEffects, fixedRacialBonuses, getAbilityMods, getAbilityScores,
  getEquippedArmor, getMaxHp, getSkillProficiencies, proficiencyBonus, raceById, rulesEdition, totalLevel,
  type Ability, type ClassDef, type SkillId,
} from '../rules'

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

const ABBR = (a: Ability) => a.toUpperCase()

/** One line per worn item that adds to this kind of number. */
const itemLines = (...args: Parameters<typeof itemBonuses>): MathLine[] =>
  itemBonuses(...args).map(b => ({ label: b.source, value: b.value }))

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
  return { label: 'Proficiency bonus', value: proficiencyBonus(totalLevel(c)) }
}

function jackOfAllTrades(c: Character): number {
  const bard = classesOf(c).find(x => x.def.id === 'bard')
  return bard && bard.level >= 2 ? Math.floor(proficiencyBonus(totalLevel(c)) / 2) : 0
}

function abilityScore(c: Character, a: Ability): StatMath {
  const lines: MathLine[] = [{ label: 'Base score', value: c.baseAbilities[a] }]
  const race = raceById(c.raceId, rulesEdition(c))
  const fromBackground = rulesEdition(c) === '2024' ? backgroundBonuses(c)[a] : 0
  if (fromBackground) lines.push({ label: `${getBackground(c)?.name ?? 'Background'} (your pick)`, value: fromBackground })
  for (const b of fixedRacialBonuses(c)) {
    if (b.ability === a) lines.push({ label: b.book === a ? b.source : `${b.source} (moved)`, value: b.value })
  }
  const free = race?.freeAbilityBonuses
  if (free && c.freeAbilityBonuses.slice(0, free.count).includes(a)) {
    lines.push({ label: `${race.name} (your pick)`, value: 1 })
  }
  const raw = lines.reduce((n, l) => n + l.value, 0)
  if (raw > 20) lines.push({ label: 'Capped at 20', value: 20 - raw })
  const before = getAbilityScores({ ...c, inventory: [] })
  for (const l of applyItemAbilities(c, before).lines[a]) lines.push({ label: l.source, value: l.value })
  return make(ABILITY_NAMES[a], lines)
}

function abilityModifier(c: Character, a: Ability): StatMath {
  const score = getAbilityScores(c)[a]
  return make(`${ABILITY_NAMES[a]} modifier`, [{ label: `(${score} − 10) ÷ 2, rounded down`, value: abilityMod(score) }], { signed: true })
}

function save(c: Character, a: Ability): StatMath {
  const first = classesOf(c)[0]?.def
  const proficient = !!first?.savingThrows.includes(a)
  const lines = [{ label: `${ABBR(a)} modifier`, value: getAbilityMods(getAbilityScores(c))[a] }]
  const fromItem = effectsOf(c, 'saveProficiency').find(x => x.effect.ability === a)
  if (proficient) lines.push({ ...profLine(c), label: `Proficiency (${first.name})` })
  else if (fromItem) lines.push({ ...profLine(c), label: `Proficiency (${fromItem.source})` })
  lines.push(...itemLines(c, 'saves'))
  for (const x of effectsOf(c, 'save')) if (x.effect.ability === a) lines.push({ label: x.source, value: x.effect.value })
  const notes = classesOf(c).length > 1 ? ['Saving throw proficiencies come from your first class only.'] : []
  return make(`${ABILITY_NAMES[a]} save`, lines, { signed: true, notes })
}

function skillSources(c: Character, s: SkillId): string[] {
  const race = raceById(c.raceId, rulesEdition(c))
  const bg = getBackground(c)
  const out: string[] = []
  if (c.chosenSkills.includes(s)) out.push('your choice')
  if (race?.skillProficiencies?.includes(s)) out.push(race.name)
  if (bg?.skillProficiencies.includes(s)) out.push(bg.name)
  return out
}

function skill(c: Character, s: SkillId): StatMath {
  const ability = SKILLS[s].ability
  const lines = [{ label: `${ABBR(ability)} modifier`, value: getAbilityMods(getAbilityScores(c))[ability] }]
  const fromItems = effectsOf(c, 'skillProficiency').filter(x => x.effect.skill === s)
  const expertise = fromItems.find(x => x.effect.expertise)
  if (expertise) lines.push({ ...profLine(c), label: `Proficiency (${skillSources(c, s).concat(fromItems.map(x => x.source)).join(', ')})` }, { ...profLine(c), label: `Expertise (${expertise.source})` })
  else if (getSkillProficiencies(c).has(s) || fromItems.length) lines.push({ ...profLine(c), label: `Proficiency (${skillSources(c, s).concat(fromItems.map(x => x.source)).join(', ')})` })
  else if (jackOfAllTrades(c)) lines.push({ label: 'Jack of All Trades (half proficiency)', value: jackOfAllTrades(c) })
  lines.push(...itemLines(c, 'checks'))
  for (const x of effectsOf(c, 'skill')) if (x.effect.skill === s) lines.push({ label: x.source, value: x.effect.value })
  return make(SKILLS[s].name, lines, { signed: true })
}

function armorClass(c: Character): StatMath {
  const mods = getAbilityMods(getAbilityScores(c))
  const { armor, shield } = getEquippedArmor(c)
  const lines: MathLine[] = []
  const notes: string[] = []
  if (armor) {
    lines.push({ label: armor.name, value: armor.baseAc })
    const dex = armor.dexCap === undefined ? mods.dex : Math.min(mods.dex, armor.dexCap)
    lines.push({ label: armor.dexCap === undefined ? 'DEX modifier' : `DEX modifier (max ${armor.dexCap})`, value: dex })
  } else {
    lines.push({ label: 'Unarmored', value: 10 }, { label: 'DEX modifier', value: mods.dex })
    let best = 0
    let from: ClassDef | undefined
    for (const { def } of classesOf(c)) {
      const extra = def.unarmoredDefense
      if (!extra) continue
      if (def.id === 'monk' && shield) { notes.push('Monk Unarmored Defense does not work with a shield.'); continue }
      if (mods[extra] > best) { best = mods[extra]; from = def }
    }
    if (from) lines.push({ label: `${ABBR(from.unarmoredDefense!)} modifier (Unarmored Defense, ${from.name})`, value: best })
  }
  const featAc = featBonus(c, 'ac') + (armor ? featBonus(c, 'armoredAc') : 0)
  if (featAc) lines.push({ label: 'Feats', value: featAc })
  if (shield) lines.push({ label: shield.name, value: shield.baseAc })
  const magic = c.inventory.filter(e => e.equipped && e.magicBonus && entryItem(e)?.kind === 'armor').reduce((n, e) => n + (e.magicBonus ?? 0), 0)
  if (magic) lines.push({ label: 'Magic armor and shield', value: magic })
  lines.push(...itemLines(c, 'ac', !armor && !shield, undefined, !!armor))
  return make('Armor class', lines, { notes })
}

function initiative(c: Character): StatMath {
  const lines = [{ label: 'DEX modifier', value: getAbilityMods(getAbilityScores(c)).dex }]
  if (featEffects(c, 'initiativeProficiency').length) lines.push({ ...profLine(c), label: 'Proficiency (Alert)' })
  else if (jackOfAllTrades(c)) lines.push({ label: 'Jack of All Trades (half proficiency)', value: jackOfAllTrades(c) })
  if (featBonus(c, 'initiative')) lines.push({ label: 'Feats', value: featBonus(c, 'initiative') })
  lines.push(...itemLines(c, 'checks'), ...itemLines(c, 'initiative'))
  return make('Initiative', lines, { signed: true })
}

const MONK_MOVEMENT: [number, number][] = [[18, 30], [14, 25], [10, 20], [6, 15], [2, 10]]

function speed(c: Character): StatMath {
  const race = raceById(c.raceId, rulesEdition(c))
  const sub = race?.subraces?.find(s => s.id === c.subraceId)
  const abilities = getAbilityScores(c)
  const { armor, shield } = getEquippedArmor(c)
  const lines: MathLine[] = [{ label: race ? `${sub?.speed ? sub.name : race.name} walking speed` : 'Walking speed', value: sub?.speed ?? race?.speed ?? 30 }]
  if (featBonus(c, 'speed')) lines.push({ label: 'Feats', value: featBonus(c, 'speed') })
  if (armor?.category === 'heavy' && armor.strengthReq && abilities.str < armor.strengthReq) {
    lines.push({ label: `${armor.name} needs STR ${armor.strengthReq}`, value: -10 })
  }
  const monk = classesOf(c).find(x => x.def.id === 'monk')
  if (monk && !armor && !shield) {
    lines.push({ label: 'Unarmored Movement (Monk)', value: MONK_MOVEMENT.find(([l]) => monk.level >= l)?.[1] ?? 0 })
  }
  const barb = classesOf(c).find(x => x.def.id === 'barbarian')
  if (barb && barb.level >= 5 && armor?.category !== 'heavy') lines.push({ label: 'Fast Movement (Barbarian)', value: 10 })
  lines.push(...itemLines(c, 'speed'))
  return make('Speed (ft.)', lines)
}

function proficiency(c: Character): StatMath {
  const level = totalLevel(c)
  const lines = [{ label: 'Base', value: 2 }]
  if (level > 4) lines.push({ label: `Level ${level}: +1 per 4 levels after 1st`, value: proficiencyBonus(level) - 2 })
  return make('Proficiency bonus', lines, { signed: true, notes: [`Goes up at levels 5, 9, 13 and 17. You are level ${level}.`] })
}

function maxHp(c: Character): StatMath {
  const con = getAbilityMods(getAbilityScores(c)).con
  const race = raceById(c.raceId, rulesEdition(c))
  const sub = race?.subraces?.find(s => s.id === c.subraceId)
  const perLevel = (sub?.hpPerLevel ?? 0) + (race?.hpPerLevel ?? 0)
  const level = totalLevel(c)
  const lines: MathLine[] = []
  let floor = 0
  let n = 0
  for (const { def, level: l } of classesOf(c)) {
    const avg = def.hitDie / 2 + 1
    const startsAtOne = n === 0
    if (startsAtOne) lines.push({ label: `${def.name} level 1: d${def.hitDie} at max`, value: def.hitDie })
    const rest = startsAtOne ? l - 1 : l
    if (rest > 0) lines.push({ label: `${def.name} ${rest} more level${rest > 1 ? 's' : ''}: ${rest} × ${avg} (d${def.hitDie} average)`, value: rest * avg })
    for (let i = 0; i < l; i++) {
      const roll = n++ === 0 ? def.hitDie : avg
      floor += Math.max(1, roll + con) - (roll + con)
    }
  }
  lines.push({ label: `CON modifier × ${level} level${level === 1 ? '' : 's'}`, value: con * level })
  if (perLevel) lines.push({ label: `${sub?.hpPerLevel ? sub.name : race!.name} × ${level} level${level === 1 ? '' : 's'}`, value: perLevel * level })
  if (floor) lines.push({ label: 'Each level gives at least 1 HP', value: floor })
  lines.push(...itemLines(c, 'hp'))
  const base = getMaxHp(c)
  const sum = lines.reduce((t, l) => t + l.value, 0)
  if (base > sum) lines.push({ label: 'Minimum 1 HP', value: base - sum })
  const notes = ['Uses the fixed average for levels after 1st.']
  return make('Max hit points', lines, { notes })
}

function passivePerception(c: Character): StatMath {
  const perception = skill(c, 'perception')
  return make('Passive Perception', [{ label: 'Base', value: 10 }, ...perception.lines, ...itemLines(c, 'passivePerception')])
}

function spellcasting(c: Character, kind: 'spellDc' | 'spellAttack'): StatMath | null {
  const caster = classesOf(c).find(x => x.def.spellAbility)
  const a = caster?.def.spellAbility
  if (!caster || !a) return null
  const lines = [
    ...(kind === 'spellDc' ? [{ label: 'Base', value: 8 }] : []),
    profLine(c),
    { label: `${ABBR(a)} modifier (${caster.def.name} spellcasting)`, value: getAbilityMods(getAbilityScores(c))[a] },
    ...itemLines(c, kind),
  ]
  return kind === 'spellDc' ? make('Spell save DC', lines) : make('Spell attack', lines, { signed: true })
}

function attack(c: Character, index: number): StatMath | null {
  const atk = derive(c).attacks[index]
  if (!atk) return null
  const lines = [{ label: `${ABBR(atk.ability)} modifier`, value: getAbilityMods(getAbilityScores(c))[atk.ability] }]
  if (atk.proficient) lines.push(profLine(c))
  lines.push(...itemLines(c, 'attack', true, atk.reach === undefined ? 'ranged' : 'melee'))
  const magic = atk.bonus - lines.reduce((t, l) => t + l.value, 0)
  if (magic) lines.push({ label: 'Magic weapon', value: magic })
  const notes = [`Damage ${atk.damage} ${atk.damageType}: weapon die + ${ABBR(atk.ability)} modifier.`]
  if (!atk.proficient) notes.push('Not proficient, so no proficiency bonus.')
  return make(`${atk.name} to hit`, lines, { signed: true, notes })
}

function carryingCapacity(c: Character): StatMath {
  const str = getAbilityScores(c).str
  return make('Carrying capacity (lb)', [{ label: `STR score ${str} × 15`, value: str * 15 }])
}

/** The breakdown for one number on the sheet, or null when it does not apply (no spellcasting, no such attack). */
export function explain(c: Character, key: StatKey): StatMath | null {
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

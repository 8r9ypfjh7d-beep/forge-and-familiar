// Build comparison: apply a what-if level-up to a character and line up two builds stat by stat.
// Pure TypeScript over the rules engine. No React, no storage.
import type { Character } from '../model/character'
import {
  ABILITIES, ABILITY_NAMES, ALL_SKILLS, SKILLS, classById, derive, formatMod, totalLevel,
  type Ability, type Attack, type DerivedStats,
} from '../rules'

/** A what-if change on top of a saved build. */
export interface BuildTweak {
  /** Add one level in this class (an existing class or a new multiclass). */
  levelClassId?: string
  /** Ability score improvement: two +1s, or the same ability twice for +2. */
  asi?: (Ability | undefined)[]
}

/** The build with play state cleared, so exhaustion or conditions don't skew the numbers. */
export function asBuild(c: Character): Character {
  return { ...c, state: { ...c.state, exhaustion: 0, conditions: [] } }
}

export function applyTweak(c: Character, t: BuildTweak): Character {
  const next = structuredClone(asBuild(c))
  if (t.levelClassId && classById(t.levelClassId) && totalLevel(next) < 20) {
    const existing = next.classes.find(cl => cl.classId === t.levelClassId)
    if (existing) existing.level += 1
    else next.classes.push({ classId: t.levelClassId, level: 1 })
  }
  for (const a of t.asi ?? []) if (a) next.baseAbilities[a] += 1
  return next
}

// ---------- Damage per round ----------

/** Average of a damage string like "1d8+3", "2d6−1" or "4". `dice` is the part a critical hit doubles. */
export function averageDamage(expr: string): { dice: number; flat: number } {
  let dice = 0
  let flat = 0
  for (const m of expr.replace(/\s/g, '').matchAll(/([+−-]?)(\d+)(?:d(\d+))?/g)) {
    const sign = m[1] === '−' || m[1] === '-' ? -1 : 1
    const n = Number(m[2])
    if (m[3]) dice += sign * n * (Number(m[3]) + 1) / 2
    else flat += sign * n
  }
  return { dice, flat }
}

/** Chance to hit: a natural 1 always misses and a natural 20 always hits. */
export const hitChance = (bonus: number, targetAc: number) =>
  Math.min(0.95, Math.max(0.05, (21 - (targetAc - bonus)) / 20))

/** Expected damage of one attack, counting critical hits (5%) as doubled dice. */
export function expectedHit(attack: Pick<Attack, 'bonus' | 'damage'>, targetAc: number): number {
  const { dice, flat } = averageDamage(attack.damage)
  return Math.max(0, hitChance(attack.bonus, targetAc) * (dice + flat) + 0.05 * dice)
}

/** Weapon attacks per Attack action: Extra Attack at 5, Fighter 3 at 11 and 4 at 20. */
export function attacksPerAction(c: Character): number {
  let n = 1
  for (const cl of c.classes) {
    const def = classById(cl.classId)
    if (!def) continue
    if (def.id === 'fighter') n = Math.max(n, cl.level >= 20 ? 4 : cl.level >= 11 ? 3 : 1)
    if (def.features.some(f => f.name === 'Extra Attack' && f.level <= cl.level)) n = Math.max(n, 2)
  }
  return n
}

export interface DamagePerRound {
  attack: Attack
  attacks: number
  perRound: number
  notes: string[]
}

/**
 * Best expected damage per round against a target AC, using the best single attack for
 * every swing. Adds the Monk's bonus unarmed strike and one Rogue Sneak Attack per round.
 * Leaves out spells, Action Surge, Rage and Smite.
 */
export function damagePerRound(c: Character, targetAc: number, d: DerivedStats = derive(c)): DamagePerRound {
  const attacks = attacksPerAction(c)
  const best = d.attacks.reduce((a, b) => (expectedHit(b, targetAc) > expectedHit(a, targetAc) ? b : a))
  let perRound = attacks * expectedHit(best, targetAc)
  const notes: string[] = []

  const monk = c.classes.find(cl => cl.classId === 'monk')
  const unarmed = d.attacks.find(a => a.name === 'Unarmed Strike')
  if (monk && unarmed?.damage.includes('d')) {
    perRound += expectedHit(unarmed, targetAc)
    notes.push('+ Martial Arts bonus strike')
  }

  const rogue = c.classes.find(cl => cl.classId === 'rogue')
  if (rogue) {
    const sneakDice = Math.ceil(rogue.level / 2)
    const p = hitChance(best.bonus, targetAc)
    const anyHit = 1 - (1 - p) ** attacks
    perRound += anyHit * sneakDice * 3.5 + 0.05 * sneakDice * 3.5
    notes.push(`+ Sneak Attack ${sneakDice}d6 once`)
  }
  return { attack: best, attacks, perRound: Math.round(perRound * 10) / 10, notes }
}

// ---------- Side-by-side rows ----------

export interface CompareRow {
  label: string
  a: string
  b: string
  /** b minus a, for numeric rows. */
  delta: number | null
  /** Which side the row favours, or null when equal or not comparable. */
  better: 'a' | 'b' | null
  /** Optional detail shown under the values (AC source, attack used). */
  detailA?: string
  detailB?: string
}

export interface CompareSection {
  title: string
  rows: CompareRow[]
}

const text = (label: string, a: string, b: string): CompareRow => ({ label, a, b, delta: null, better: null })

function num(label: string, va: number, vb: number, fmt: (n: number) => string = String, lowerIsBetter = false): CompareRow {
  const delta = Math.round((vb - va) * 10) / 10
  const better = delta === 0 ? null : (delta > 0) !== lowerIsBetter ? 'b' : 'a'
  return { label, a: fmt(va), b: fmt(vb), delta, better }
}

/** A stat only some builds have (spell DC): compared as a number only when both have it. */
function optional(label: string, va: number | undefined, vb: number | undefined, fmt: (n: number) => string): CompareRow {
  if (va !== undefined && vb !== undefined) return num(label, va, vb, fmt)
  return {
    label,
    a: va === undefined ? '—' : fmt(va),
    b: vb === undefined ? '—' : fmt(vb),
    delta: null,
    better: va === vb ? null : va === undefined ? 'b' : 'a',
  }
}

export const classLine = (c: Pick<Character, 'classes'>) =>
  c.classes.map(cl => `${classById(cl.classId)?.name ?? cl.classId} ${cl.level}`).join(' / ')

const slotLine = (d: DerivedStats) => {
  const used = d.spellSlots.slots.filter(n => n > 0)
  const parts = used.length ? [used.join('/')] : []
  if (d.spellSlots.pact) parts.push(`${d.spellSlots.pact.count}× L${d.spellSlots.pact.level} pact`)
  return parts.join(' + ') || '—'
}

const totalSlots = (d: DerivedStats) => d.spellSlots.slots.reduce((n, s) => n + s, 0) + (d.spellSlots.pact?.count ?? 0)

const oneDecimal = (n: number) => n.toFixed(1)

export function compareBuilds(a: Character, b: Character, targetAc = 15): CompareSection[] {
  const da = derive(a)
  const db = derive(b)
  const dprA = damagePerRound(a, targetAc, da)
  const dprB = damagePerRound(b, targetAc, db)

  const ac = num('Armor Class', da.armorClass.value, db.armorClass.value)
  ac.detailA = da.armorClass.source
  ac.detailB = db.armorClass.source

  const dpr = num(`Damage per round vs AC ${targetAc}`, dprA.perRound, dprB.perRound, oneDecimal)
  dpr.detailA = [`${dprA.attacks}× ${dprA.attack.name}`, ...dprA.notes].join(' ')
  dpr.detailB = [`${dprB.attacks}× ${dprB.attack.name}`, ...dprB.notes].join(' ')

  const sections: CompareSection[] = [
    {
      title: 'Overview',
      rows: [
        text('Classes', classLine(a), classLine(b)),
        num('Level', da.level, db.level),
        num('Proficiency bonus', da.proficiencyBonus, db.proficiencyBonus, formatMod),
        num('Max HP', da.baseMaxHp, db.baseMaxHp),
        ac,
        num('Initiative', da.initiative, db.initiative, formatMod),
        num('Speed', da.speed, db.speed, n => `${n} ft.`),
        num('Passive Perception', da.passivePerception, db.passivePerception),
      ],
    },
    {
      title: 'Offense',
      rows: [
        dpr,
        text('Best attack', `${dprA.attack.name} ${formatMod(dprA.attack.bonus)}, ${dprA.attack.damage}`,
          `${dprB.attack.name} ${formatMod(dprB.attack.bonus)}, ${dprB.attack.damage}`),
        num('Attacks per action', dprA.attacks, dprB.attacks),
        optional('Spell save DC', da.spellcasting?.saveDc, db.spellcasting?.saveDc, String),
        optional('Spell attack', da.spellcasting?.attackBonus, db.spellcasting?.attackBonus, formatMod),
      ],
    },
    {
      title: 'Ability scores',
      rows: ABILITIES.map(x =>
        num(ABILITY_NAMES[x], da.abilities[x], db.abilities[x], n => `${n} (${formatMod(Math.floor((n - 10) / 2))})`)),
    },
    {
      title: 'Saving throws',
      rows: ABILITIES.map(x => {
        const row = num(ABILITY_NAMES[x], da.saves[x].bonus, db.saves[x].bonus, formatMod)
        if (da.saves[x].proficient) row.detailA = 'proficient'
        if (db.saves[x].proficient) row.detailB = 'proficient'
        return row
      }),
    },
    {
      title: 'Skills that differ',
      rows: ALL_SKILLS.filter(s => da.skills[s].bonus !== db.skills[s].bonus)
        .map(s => num(SKILLS[s].name, da.skills[s].bonus, db.skills[s].bonus, formatMod)),
    },
    {
      title: 'Spellcasting',
      rows: [
        text('Slots by level', slotLine(da), slotLine(db)),
        num('Total slots', totalSlots(da), totalSlots(db)),
      ],
    },
    {
      title: 'Class resources',
      rows: [...new Set([...da.resources, ...db.resources].map(r => r.id))].map(id => {
        const ra = da.resources.find(r => r.id === id)
        const rb = db.resources.find(r => r.id === id)
        const row = num((ra ?? rb)!.label, ra?.max ?? 0, rb?.max ?? 0, n => (n ? String(n) : '—'))
        if (ra) row.detailA = `${ra.recharge} rest`
        if (rb) row.detailB = `${rb.recharge} rest`
        return row
      }),
    },
  ]
  return sections.filter(s => s.rows.length > 0)
}

/** Features one build has and the other doesn't, by class and name. */
export function featureDiff(a: Character, b: Character): { onlyA: string[]; onlyB: string[] } {
  const names = (c: Character) => derive(c).features.map(f => `${f.name} (${f.className} ${f.level})`)
  const fa = names(a)
  const fb = names(b)
  return { onlyA: fa.filter(f => !fb.includes(f)), onlyB: fb.filter(f => !fa.includes(f)) }
}

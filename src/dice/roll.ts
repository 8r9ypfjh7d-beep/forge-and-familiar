// Core rolling. Pure apart from the default RNG.
import { formatNotation, parseNotation, termToString } from './notation'
import type { DieRoll, RollType, RollMode, RollOptions, RollResult, Rng, Term, TermResult } from './types'

/** Unbiased crypto RNG (rejection sampling). Falls back to Math.random where crypto is missing. */
export const cryptoRng: Rng = sides => {
  const c = globalThis.crypto
  if (!c?.getRandomValues) return 1 + Math.floor(Math.random() * sides)
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / sides) * sides
  do c.getRandomValues(buf)
  while (buf[0] >= limit)
  return 1 + (buf[0] % sides)
}

let counter = 0
const newId = () => `roll-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** Combines every source of advantage and disadvantage: any of both means a normal roll. */
export function resolveMode(mode: RollMode | RollMode[] = 'normal'): RollMode {
  const modes = Array.isArray(mode) ? mode : [mode]
  const adv = modes.includes('advantage')
  const dis = modes.includes('disadvantage')
  return adv === dis ? 'normal' : adv ? 'advantage' : 'disadvantage'
}

function rollTerm(t: Term, rng: Rng): TermResult {
  if (t.kind === 'const') return t
  const rolls: DieRoll[] = Array.from({ length: t.count }, () => ({ sides: t.sides, value: rng(t.sides), kept: true }))
  if (t.keep) {
    const { type, n } = t.keep
    // Indices sorted lowest first; ties keep roll order, so results are stable.
    const order = rolls.map((_, i) => i).sort((a, b) => rolls[a].value - rolls[b].value || a - b)
    const keepCount = type === 'kh' || type === 'kl' ? n : t.count - n
    const keepHigh = type === 'kh' || type === 'dl'
    const kept = new Set(keepHigh ? order.slice(-keepCount) : order.slice(0, keepCount))
    rolls.forEach((r, i) => (r.kept = kept.has(i)))
  }
  const subtotal = rolls.reduce((s, r) => s + (r.kept ? r.value : 0), 0)
  return { kind: 'dice', sign: t.sign, notation: termToString(t), rolls, subtotal }
}

function breakdownOf(terms: TermResult[]): string {
  return terms
    .map((t, i) => {
      const op = t.sign < 0 ? (i ? ' − ' : '−') : i ? ' + ' : ''
      if (t.kind === 'const') return op + t.value
      const dice = t.rolls.map(r => (r.kept ? String(r.value) : `~~${r.value}~~`)).join(', ')
      return `${op}[${dice}]`
    })
    .join('')
}

function build(terms: Term[], type: RollType, opts: RollOptions): RollResult {
  const results = terms.map(t => rollTerm(t, opts.rng ?? cryptoRng))
  const total = results.reduce((s, t) => s + t.sign * (t.kind === 'const' ? t.value : t.subtotal), 0)
  return {
    id: newId(),
    notation: formatNotation(terms),
    label: opts.label,
    type,
    total,
    terms: results,
    breakdown: breakdownOf(results),
    roller: opts.roller ?? (opts.character && { characterId: opts.character.id, characterName: opts.character.name }),
    timestamp: new Date().toISOString(),
  }
}

/** Rolls any notation, e.g. roll('2d6+3'). Throws DiceNotationError on bad input. */
export function roll(notation: string, opts: RollOptions = {}, type: RollType = 'custom'): RollResult {
  return build(parseNotation(notation), type, opts)
}

/**
 * Great Weapon Fighting on one dice term: kept dice of 1 or 2 are rerolled once (2014) or count as 3 (2024).
 * The old die stays in the list struck through, the new value follows it.
 */
export function lowDiceUp(t: TermResult, how: 'reroll' | 'min3', rng: Rng = cryptoRng): TermResult {
  if (t.kind !== 'dice') return t
  const rolls = t.rolls.flatMap(r => (r.kept && r.value <= 2
    ? [{ ...r, kept: false }, { sides: r.sides, value: how === 'min3' ? 3 : rng(r.sides), kept: true }]
    : [r]))
  return { ...t, rolls, subtotal: rolls.reduce((n, r) => n + (r.kept ? r.value : 0), 0) }
}

function total(terms: TermResult[]) {
  return terms.reduce((s, t) => s + t.sign * (t.kind === 'const' ? t.value : t.subtotal), 0)
}

/**
 * Rolls several named parts as one roll, e.g. a weapon's "2d6+4" plus Hex's "1d6", and tags each term with
 * its part's `source`. `crit` doubles every die (flat modifiers stay).
 */
export function rollParts(
  parts: { notation: string; source?: string; lowDice?: 'reroll' | 'min3' }[], opts: RollOptions = {}, type: RollType = 'custom', crit = false,
): RollResult {
  const meta: { source?: string; lowDice?: 'reroll' | 'min3' }[] = []
  const terms = parts.flatMap(p => parseNotation(p.notation).map((t): Term => {
    meta.push(p)
    return crit && t.kind === 'dice' ? { ...t, count: t.count * 2 } : t
  }))
  const result = build(terms, type, opts)
  result.terms = result.terms.map((t, i) => {
    const { source, lowDice } = meta[i]
    const done = lowDice ? lowDiceUp(t, lowDice, opts.rng) : t
    return source ? { ...done, source } : done
  })
  if (parts.some(p => p.lowDice)) {
    result.total = total(result.terms)
    result.breakdown = breakdownOf(result.terms)
  }
  return result
}

/** A d20 roll plus a flat bonus, with advantage or disadvantage. Flags natural 20s and 1s. */
export function rollD20(bonus: number, opts: RollOptions = {}, type: RollType = 'check'): RollResult {
  const mode = resolveMode(opts.mode)
  const d20: Term =
    mode === 'normal'
      ? { kind: 'dice', sign: 1, count: 1, sides: 20 }
      : { kind: 'dice', sign: 1, count: 2, sides: 20, keep: { type: mode === 'advantage' ? 'kh' : 'kl', n: 1 } }
  const terms: Term[] = bonus ? [d20, { kind: 'const', sign: bonus < 0 ? -1 : 1, value: Math.abs(bonus) }] : [d20]
  // Dice from running spells (Bless's 1d4) come after the bonus.
  for (const extra of opts.bonusDice ?? []) terms.push(...parseNotation(extra))
  const result = build(terms, type, opts)
  if (opts.lucky) luckyReroll(result, mode, opts.rng ?? cryptoRng)
  const first = result.terms[0]
  const natural = first.kind === 'dice' ? first.subtotal : 0
  result.d20 = { mode, natural, crit: natural === 20, fumble: natural === 1 }
  return result
}

/**
 * Halfling Lucky: when the d20 that counts shows a 1, that die is rerolled and the new roll is used
 * (with advantage or disadvantage the two dice are compared again). The 1 stays struck through.
 */
function luckyReroll(result: RollResult, mode: RollMode, rng: Rng) {
  const d20 = result.terms[0]
  if (d20.kind !== 'dice') return
  const i = d20.rolls.findIndex(r => r.kept && r.value === 1)
  if (i < 0) return
  const again = { sides: 20, value: rng(20), kept: true }
  const live = [...d20.rolls.filter((_, j) => j !== i), again]
  if (live.length > 1) {
    const best = mode === 'disadvantage' ? Math.min(...live.map(r => r.value)) : Math.max(...live.map(r => r.value))
    const at = live.findIndex(r => r.value === best)
    live.forEach((r, j) => (r.kept = j === at))
  }
  // The replaced 1 keeps its place, struck through; the reroll comes last.
  const rolls = [...d20.rolls.map((r, j) => (j === i ? { ...r, kept: false } : r)), again]
  result.terms[0] = { ...d20, rolls, subtotal: rolls.reduce((n, r) => n + (r.kept ? r.value : 0), 0) }
  result.total = total(result.terms)
  result.breakdown = breakdownOf(result.terms)
  result.label = `${result.label ? `${result.label} · ` : ''}Lucky`
}

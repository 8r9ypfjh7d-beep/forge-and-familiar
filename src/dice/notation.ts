// Dice notation parser: "2d6+3", "d20", "1d8−1", "d%", "4d6dl1", "2d20kh1+5".
import type { Term } from './types'

export const MAX_DICE = 100
export const MAX_SIDES = 1000

export class DiceNotationError extends Error {}

const TERM = /^(\d*)d(\d+|%)(?:(kh|kl|dh|dl)(\d*))?$|^(\d+)$/

/** Parses notation into terms. Accepts the unicode minus (−) that the rules engine uses in damage strings. */
export function parseNotation(input: string): Term[] {
  const src = input.toLowerCase().replace(/[−–]/g, '-').replace(/\s+/g, '')
  if (!src) throw new DiceNotationError('Empty roll')
  const parts = src.match(/[+-]?[^+-]+/g)
  if (!parts || parts.join('') !== src) throw new DiceNotationError(`Can't read "${input}"`)

  return parts.map(part => {
    const sign: 1 | -1 = part.startsWith('-') ? -1 : 1
    const body = part.replace(/^[+-]/, '')
    const m = TERM.exec(body)
    if (!m) throw new DiceNotationError(body === src ? `Can't read "${input.trim()}"` : `Can't read "${body}" in "${input.trim()}"`)
    if (m[5] !== undefined) return { kind: 'const', sign, value: Number(m[5]) }

    const count = m[1] === '' ? 1 : Number(m[1])
    const sides = m[2] === '%' ? 100 : Number(m[2])
    if (count < 1 || count > MAX_DICE) throw new DiceNotationError(`Roll between 1 and ${MAX_DICE} dice`)
    if (sides < 1 || sides > MAX_SIDES) throw new DiceNotationError(`Dice need 1 to ${MAX_SIDES} sides`)
    if (!m[3]) return { kind: 'dice', sign, count, sides }

    const n = m[4] === '' ? 1 : Number(m[4])
    const type = m[3] as 'kh' | 'kl' | 'dh' | 'dl'
    const keeps = type === 'kh' || type === 'kl'
    if (keeps ? n < 1 || n > count : n < 0 || n >= count) {
      throw new DiceNotationError(`Can't ${keeps ? 'keep' : 'drop'} ${n} of ${count} dice`)
    }
    return { kind: 'dice', sign, count, sides, keep: { type, n } }
  })
}

export function termToString(t: Term): string {
  if (t.kind === 'const') return String(t.value)
  return `${t.count}d${t.sides}${t.keep ? `${t.keep.type}${t.keep.n}` : ''}`
}

export function formatNotation(terms: Term[]): string {
  return terms.map((t, i) => (t.sign < 0 ? '-' : i > 0 ? '+' : '') + termToString(t)).join('')
}

export function isValidNotation(input: string): boolean {
  try {
    parseNotation(input)
    return true
  } catch {
    return false
  }
}

/** Critical hit: double every die, keep flat modifiers (PHB p.196). */
export function critNotation(input: string): string {
  return formatNotation(parseNotation(input).map(t => (t.kind === 'dice' ? { ...t, count: t.count * 2 } : t)))
}

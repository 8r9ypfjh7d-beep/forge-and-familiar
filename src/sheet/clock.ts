// In-game time. A time is a whole number of minutes since 00:00 on day 1.
// Dawn is fixed at 06:00, which is when "regains charges daily at dawn" items refill.

export const MINUTES_PER_DAY = 24 * 60
export const DAWN = 6 * 60
/** Where a character's clock starts before anyone moves it: day 1, 08:00. */
export const DEFAULT_START = 8 * 60

export const SHORT_REST_MINUTES = 60
export const LONG_REST_MINUTES = 8 * 60

const pad = (n: number) => String(n).padStart(2, '0')

export function dayOf(t: number): number {
  return Math.floor(t / MINUTES_PER_DAY) + 1
}

/** "14:05" */
export function timeOfDay(t: number): string {
  const m = ((t % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export type PartOfDay = 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening'

export function partOfDay(t: number): PartOfDay {
  const h = Math.floor((((t % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60)
  if (h < 5) return 'night'
  if (h < 7) return 'dawn'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 20) return 'evening'
  return 'night'
}

/** "Day 3, 14:05" (English; the UI builds it with clock.now). */
export function formatClock(t: number): string {
  return `Day ${dayOf(t)}, ${timeOfDay(t)}`
}

export type DurationUnit = 'd' | 'h' | 'min'
const englishUnit = (unit: DurationUnit, n: number) => `${n} ${unit}`

/** "1 d 2 h 5 min", "45 min". Pass `unit` to word each part in another language. */
export function formatDuration(minutes: number, unit: (unit: DurationUnit, n: number) => string = englishUnit): string {
  const d = Math.floor(minutes / MINUTES_PER_DAY)
  const h = Math.floor((minutes % MINUTES_PER_DAY) / 60)
  const m = minutes % 60
  const parts = [d && unit('d', d), h && unit('h', h), m && unit('min', m)].filter(Boolean)
  return parts.length ? parts.join(' ') : unit('min', 0)
}

/** How many dawns fall after `from` and up to and including `to`. Arriving exactly at 06:00 counts. */
export function dawnsBetween(from: number, to: number): number {
  if (to <= from) return 0
  const index = (t: number) => Math.floor((t - DAWN) / MINUTES_PER_DAY)
  return index(to) - index(from)
}

export function minutesToNextDawn(t: number): number {
  const since = (((t - DAWN) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return MINUTES_PER_DAY - since
}

/**
 * Reads durations players type: "90", "1h30", "1h 30m", "2 hours", "1d", "45 min".
 * A bare number is minutes. Returns null for anything else or for zero.
 */
export function parseDuration(input: string): number | null {
  const src = input.trim().toLowerCase()
  if (/^\d+$/.test(src)) return Number(src) || null
  const re = /(\d+)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m)\s*/gy
  let total = 0
  let m: RegExpExecArray | null
  let consumed = 0
  while ((m = re.exec(src))) {
    const unit = m[2][0]
    total += Number(m[1]) * (unit === 'd' ? MINUTES_PER_DAY : unit === 'h' ? 60 : 1)
    consumed = re.lastIndex
  }
  return consumed === src.length && total > 0 ? total : null
}

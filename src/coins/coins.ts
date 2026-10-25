// Pure SRD 5.1 coin math: conversion, totals and even loot splits. No React, no storage.
// 1 pp = 10 gp = 20 ep = 100 sp = 1000 cp.

export type Denom = 'cp' | 'sp' | 'ep' | 'gp' | 'pp'
export type Purse = Partial<Record<Denom, number>>

/** Largest first. */
export const DENOMS: Denom[] = ['pp', 'gp', 'ep', 'sp', 'cp']
export const CP_VALUE: Record<Denom, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }
export const DENOM_NAMES: Record<Denom, string> = { cp: 'copper', sp: 'silver', ep: 'electrum', gp: 'gold', pp: 'platinum' }

/** What a character purse stores today (model/character.ts coins). */
export const PURSE_DENOMS: Denom[] = ['gp', 'sp', 'cp']
/** Usual change: electrum is rare in play, so it is left out unless asked for. */
export const CHANGE_DENOMS: Denom[] = ['pp', 'gp', 'sp', 'cp']

const whole = (n: number | undefined) => (Number.isFinite(n) && n! > 0 ? Math.floor(n!) : 0)

/** Total value in copper. Negative, fractional or missing counts are ignored. */
export function toCp(purse: Purse): number {
  return DENOMS.reduce((sum, d) => sum + whole(purse[d]) * CP_VALUE[d], 0)
}

/** Fewest coins worth exactly `cp`, using only the given denominations (cp is always allowed). */
export function fromCp(cp: number, denoms: Denom[] = CHANGE_DENOMS): Purse {
  let left = whole(cp)
  const out: Purse = {}
  for (const d of DENOMS) {
    if (d !== 'cp' && !denoms.includes(d)) continue
    const n = Math.floor(left / CP_VALUE[d])
    if (n > 0) out[d] = n
    left -= n * CP_VALUE[d]
  }
  return out
}

/** Value of `amount` coins of `from` expressed in `to`: the whole coins, plus what is left in copper. */
export function convert(amount: number, from: Denom, to: Denom): { coins: number; leftoverCp: number; exact: number } {
  const cp = whole(amount) * CP_VALUE[from]
  return { coins: Math.floor(cp / CP_VALUE[to]), leftoverCp: cp % CP_VALUE[to], exact: cp / CP_VALUE[to] }
}

/** Coins added together, denomination by denomination. */
export function addPurses(a: Purse, b: Purse): Purse {
  const out: Purse = {}
  for (const d of DENOMS) {
    const n = whole(a[d]) + whole(b[d])
    if (n > 0) out[d] = n
  }
  return out
}

export interface LootSplit {
  /** Value each share gets, in copper. */
  shareCp: number
  /** Each share as the fewest coins in the payout denominations. */
  share: Purse
  /** Copper that cannot be split evenly (always less than the number of shares). */
  leftoverCp: number
  leftover: Purse
}

/**
 * Splits a pile evenly by value among `shares` people. Each share is paid out as the fewest coins
 * in `denoms`, so 3 pp among 2 is 15 gp each. What doesn't divide evenly is the leftover.
 */
export function splitLoot(pile: Purse, shares: number, denoms: Denom[] = CHANGE_DENOMS): LootSplit {
  const total = toCp(pile)
  const n = whole(shares)
  if (n === 0) return { shareCp: 0, share: {}, leftoverCp: total, leftover: fromCp(total, denoms) }
  const shareCp = Math.floor(total / n)
  const leftoverCp = total - shareCp * n
  return { shareCp, share: fromCp(shareCp, denoms), leftoverCp, leftover: fromCp(leftoverCp, denoms) }
}

/** "1 gp 5 sp", or "0 cp" for nothing. */
export function formatPurse(purse: Purse): string {
  const parts = DENOMS.filter(d => whole(purse[d]) > 0).map(d => `${whole(purse[d]).toLocaleString()} ${d}`)
  return parts.length ? parts.join(' ') : '0 cp'
}

/** A value in copper as gold with decimals, e.g. 1234 → "12.34 gp". */
export function formatGp(cp: number): string {
  return `${(whole(cp) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} gp`
}

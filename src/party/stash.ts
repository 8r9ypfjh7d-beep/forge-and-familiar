// Shared party inventory and gold. Pure updates like code.ts, so a backend can run the same rules.
import type { Coin, Coins, Party, PartyStash, StashItem } from './types'
import { AWARD_LIMIT } from './xp'

export const COINS: Coin[] = ['pp', 'gp', 'ep', 'sp', 'cp']
/** Value of each coin in copper (SRD 5.1 exchange rates). */
export const COIN_CP: Record<Coin, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }
export const STASH_LOG_LIMIT = 50

export const noCoins = (): Coins => ({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 })
export const emptyStash = (): PartyStash => ({ items: [], coins: noCoins(), log: [] })
export const getStash = (p: Party): PartyStash => p.stash ?? emptyStash()

export const toCp = (c: Partial<Coins>) => COINS.reduce((sum, k) => sum + (c[k] ?? 0) * COIN_CP[k], 0)

/** Copper as gold, silver and copper: the coins players usually split loot into. */
export function fromCp(total: number): Coins {
  return { ...noCoins(), gp: Math.floor(total / 100), sp: Math.floor((total % 100) / 10), cp: total % 10 }
}

/** "12 gp 5 sp". Zero coins are left out; an empty purse reads "0 gp". */
export function formatCoins(c: Partial<Coins>): string {
  const parts = COINS.filter(k => (c[k] ?? 0) !== 0).map(k => `${c[k]} ${k}`)
  return parts.length ? parts.join(' ') : '0 gp'
}

export interface Split {
  /** What each member gets, in gp/sp/cp. */
  share: Coins
  /** Copper that does not divide evenly; it stays in the stash. */
  leftoverCp: number
}

export function splitCoins(c: Coins, ways: number): Split {
  const total = toCp(c)
  if (ways < 1) return { share: noCoins(), leftoverCp: total }
  const each = Math.floor(total / ways)
  return { share: fromCp(each), leftoverCp: total - each * ways }
}

export type StashAction =
  | { type: 'add'; name: string; qty: number; itemId?: string; note?: string }
  | { type: 'qty'; id: string; delta: number }
  | { type: 'remove'; id: string }
  /** Actor carries the item, or puts it back in the party bag. */
  | { type: 'hold'; id: string; carry: boolean }
  | { type: 'coins'; delta: Partial<Coins>; reason?: string }
  /** Hands out equal shares to `ways` members; the uneven copper stays behind. */
  | { type: 'split'; ways: number }
  /** The DM gives XP (or a milestone level) to these players' characters; `names` is for the log. */
  | { type: 'award'; xp?: number; milestone?: boolean; level?: number; to: { userId: string; characterId: string }[]; names: string[] }

export type StashResult = { ok: true; party: Party } | { ok: false; reason: string }

const fail = (reason: string): StashResult => ({ ok: false, reason })

function commit(p: Party, userId: string, stash: Omit<PartyStash, 'log'>, text: string): StashResult {
  const now = new Date().toISOString()
  const log = [{ at: now, userId, text }, ...getStash(p).log].slice(0, STASH_LOG_LIMIT)
  return { ok: true, party: { ...p, stash: { ...getStash(p), ...stash, log }, updatedAt: now } }
}

const label = (it: Pick<StashItem, 'name' | 'qty'>, qty = it.qty) => (qty === 1 ? it.name : `${qty} × ${it.name}`)

/** Applies one change made by `userId`. Anyone in the party may change the stash. */
export function applyStash(p: Party, userId: string, action: StashAction): StashResult {
  const s = getStash(p)
  const find = (id: string) => s.items.find(i => i.id === id)
  const withItems = (items: StashItem[]) => ({ items, coins: s.coins })

  switch (action.type) {
    case 'add': {
      const name = action.name.trim()
      const qty = Math.floor(action.qty)
      const note = action.note?.trim() || undefined
      if (!name) return fail('Give the item a name.')
      if (!(qty >= 1)) return fail('Quantity must be at least 1.')
      // Stack onto the same item already in the bag, unless either one has its own note.
      const same = !note && s.items.find(i => !i.heldBy && !i.note &&
        (action.itemId ? i.itemId === action.itemId : !i.itemId && i.name.toLowerCase() === name.toLowerCase()))
      const items = same
        ? s.items.map(i => (i === same ? { ...i, qty: i.qty + qty } : i))
        : [...s.items, { id: crypto.randomUUID(), name, qty, itemId: action.itemId, note }]
      return commit(p, userId, withItems(items), `added ${label({ name, qty })}`)
    }
    case 'qty': {
      const it = find(action.id)
      if (!it) return fail('That item is gone.')
      const qty = Math.max(0, it.qty + Math.trunc(action.delta))
      if (qty === it.qty) return { ok: true, party: p }
      const items = qty === 0 ? s.items.filter(i => i !== it) : s.items.map(i => (i === it ? { ...i, qty } : i))
      const moved = Math.abs(qty - it.qty)
      return commit(p, userId, withItems(items), `${qty > it.qty ? 'added' : 'used'} ${label(it, moved)}`)
    }
    case 'remove': {
      const it = find(action.id)
      if (!it) return fail('That item is gone.')
      return commit(p, userId, withItems(s.items.filter(i => i !== it)), `removed ${label(it)}`)
    }
    case 'hold': {
      const it = find(action.id)
      if (!it) return fail('That item is gone.')
      const heldBy = action.carry ? userId : undefined
      if (it.heldBy === heldBy) return { ok: true, party: p }
      const items = s.items.map(i => (i === it ? { ...i, heldBy } : i))
      return commit(p, userId, withItems(items), action.carry ? `is carrying ${label(it)}` : `put ${label(it)} back in the bag`)
    }
    case 'coins': {
      const coins = { ...s.coins }
      for (const k of COINS) coins[k] += Math.trunc(action.delta[k] ?? 0)
      if (COINS.some(k => coins[k] < 0)) return fail("The stash doesn't have those coins.")
      const plus = Object.fromEntries(COINS.map(k => [k, Math.max(0, Math.trunc(action.delta[k] ?? 0))]))
      const minus = Object.fromEntries(COINS.map(k => [k, Math.max(0, -Math.trunc(action.delta[k] ?? 0))]))
      const words = [
        toCp(plus) > 0 && `added ${formatCoins(plus)}`,
        toCp(minus) > 0 && `took ${formatCoins(minus)}`,
      ].filter(Boolean).join(', ')
      if (!words) return { ok: true, party: p }
      const reason = action.reason?.trim()
      return commit(p, userId, { items: s.items, coins }, reason ? `${words} (${reason})` : words)
    }
    case 'split': {
      const ways = Math.floor(action.ways)
      if (!(ways >= 1)) return fail('Nobody to split with.')
      const { share, leftoverCp } = splitCoins(s.coins, ways)
      if (toCp(share) === 0) return fail('Not enough coin to split.')
      return commit(p, userId, { items: s.items, coins: { ...noCoins(), cp: leftoverCp } },
        `split the coin ${ways} ways: ${formatCoins(share)} each`)
    }
    case 'award': {
      if (userId !== p.dmId) return fail('Only the DM gives XP.')
      const xp = Math.trunc(action.xp ?? 0)
      const level = action.level === undefined ? undefined : Math.trunc(action.level)
      if (level !== undefined && !(level >= 2 && level <= 20)) return fail('Pick a level from 2 to 20.')
      if (!action.milestone && level === undefined && !(xp > 0)) return fail('Give at least 1 XP.')
      const to = action.to.filter(x => p.members.some(m => m.userId === x.userId && m.characterId === x.characterId))
      if (!to.length) return fail('Nobody to give XP to.')
      const kind = level !== undefined ? { milestone: true, level } : action.milestone ? { milestone: true } : { xp }
      const award = { id: crypto.randomUUID(), at: new Date().toISOString(), by: userId, ...kind, to }
      const awards = [award, ...(s.awards ?? [])].slice(0, AWARD_LIMIT)
      const who = action.names.join(', ')
      const text = level !== undefined ? `brought ${who} to level ${level}` : action.milestone ? `gave a milestone level to ${who}` : `gave ${xp} XP to ${who}`
      return commit(p, userId, { items: s.items, coins: s.coins, awards }, text)
    }
  }
}

/** A stash log line read back into its parts, so the screen can show it in any language. */
export type StashLogPart =
  | { kind: 'added' | 'used' | 'removed' | 'carrying' | 'putBack'; qty: number; name: string }
  | { kind: 'coins'; added?: Partial<Coins>; took?: Partial<Coins>; reason?: string }
  | { kind: 'split'; ways: number; share: Partial<Coins> }
  | { kind: 'milestone'; who: string }
  | { kind: 'toLevel'; level: number; who: string }
  | { kind: 'xp'; xp: number; who: string }
  | { kind: 'other'; text: string }

const COIN_RE = `\\d+ (?:${COINS.join('|')})(?: \\d+ (?:${COINS.join('|')}))*`

function parseCoins(s: string): Partial<Coins> {
  const out: Partial<Coins> = {}
  for (const m of s.matchAll(/(\d+) (\w\w)/g)) out[m[2] as Coin] = Number(m[1])
  return out
}

function parseLabel(s: string): { qty: number; name: string } {
  const m = /^(\d+) × (.+)$/.exec(s)
  return m ? { qty: Number(m[1]), name: m[2] } : { qty: 1, name: s }
}

/** Reads the English log text that `applyStash` writes (old entries included). Unknown text comes back as 'other'. */
export function parseStashLog(text: string): StashLogPart {
  let m: RegExpExecArray | null
  if ((m = new RegExp(`^(?:added (${COIN_RE}))?(?:, )?(?:took (${COIN_RE}))?(?: \\((.*)\\))?$`).exec(text)) && (m[1] || m[2])) {
    return { kind: 'coins', added: m[1] ? parseCoins(m[1]) : undefined, took: m[2] ? parseCoins(m[2]) : undefined, reason: m[3] }
  }
  if ((m = new RegExp(`^split the coin (\\d+) ways: (${COIN_RE}) each$`).exec(text))) return { kind: 'split', ways: Number(m[1]), share: parseCoins(m[2]) }
  if ((m = /^gave a milestone level to (.*)$/.exec(text))) return { kind: 'milestone', who: m[1] }
  if ((m = /^brought (.*) to level (\d+)$/.exec(text))) return { kind: 'toLevel', level: Number(m[2]), who: m[1] }
  if ((m = /^gave (\d+) XP to (.*)$/.exec(text))) return { kind: 'xp', xp: Number(m[1]), who: m[2] }
  if ((m = /^put (.+) back in the bag$/.exec(text))) return { kind: 'putBack', ...parseLabel(m[1]) }
  if ((m = /^is carrying (.+)$/.exec(text))) return { kind: 'carrying', ...parseLabel(m[1]) }
  if ((m = /^(added|used|removed) (.+)$/.exec(text))) return { kind: m[1] as 'added' | 'used' | 'removed', ...parseLabel(m[2]) }
  return { kind: 'other', text }
}

// Builds the end-of-session recap from a session's events. Pure, so it can be tested
// and later run on a server for the DM dashboard.
import type { RollResult } from '../dice/types'
import type { Session, SessionEvent } from './types'

export interface CharacterRecap {
  characterId?: string
  name: string
  damageTaken: number
  biggestHit: number
  healing: number
  lowestHp?: { hp: number; maxHp: number }
  timesDowned: number
  died: boolean
  rolls: number
  nat20s: RollResult[]
  nat1s: RollResult[]
  bestRoll?: RollResult
  damageRolled: number
  slotsUsed: number
  resourcesUsed: Record<string, number>
  loot: { name: string; qty: number }[]
  /** Net change in gold pieces (sp and cp folded in). */
  gold: number
  xp: number
  levelUps: number[]
  conditions: string[]
}

export interface Recap {
  title: string
  startedAt: string
  endedAt?: string
  minutes: number
  characters: CharacterRecap[]
  rests: { short: number; long: number }
  /** Short lines for the top of the recap, most dramatic first. */
  highlights: string[]
  totals: { damageTaken: number; healing: number; xp: number; gold: number; nat20s: number; nat1s: number; rolls: number }
}

const blank = (name: string, characterId?: string): CharacterRecap => ({
  characterId, name, damageTaken: 0, biggestHit: 0, healing: 0, timesDowned: 0, died: false, rolls: 0,
  nat20s: [], nat1s: [], damageRolled: 0, slotsUsed: 0, resourcesUsed: {}, loot: [], gold: 0, xp: 0, levelUps: [], conditions: [],
})

const toGold = (c: { cp: number; sp: number; gp: number }) => c.gp + c.sp / 10 + c.cp / 100
const round2 = (n: number) => Math.round(n * 100) / 100
export const rollLabel = (r: RollResult) => r.label ?? r.notation
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function buildRecap(s: Session, now = new Date().toISOString()): Recap {
  const byKey = new Map<string, CharacterRecap>()
  const rests = { short: 0, long: 0 }
  // Rests are recorded per character; count each table-wide rest once.
  const restTimes: Record<'short' | 'long', number[]> = { short: [], long: [] }
  const get = (e: SessionEvent) => {
    const key = e.characterId ?? 'table'
    let r = byKey.get(key)
    if (!r) byKey.set(key, (r = blank(e.characterName, e.characterId)))
    r.name = e.characterName
    return r
  }
  // Every character in the session gets a row, even a quiet one.
  for (const id of s.characterIds) {
    const name = s.steps[id]?.[s.steps[id].length - 1]?.snapshot.name ?? 'Unknown'
    byKey.set(id, blank(name, id))
  }

  // A long rest for someone with nothing but HP to recover looks like healing to full.
  // Close to a rest the rest of the table took, it is that rest, not healing.
  const longRests = s.events.flatMap(e => (e.kind === 'rest' && e.rest === 'long' ? [Date.parse(e.at)] : []))
  const nearRest = (at: string) => longRests.some(t => Math.abs(t - Date.parse(at)) < 10 * 60_000)

  for (const e of s.events) {
    const r = get(e)
    switch (e.kind) {
      case 'damage':
        r.damageTaken += e.amount
        r.biggestHit = Math.max(r.biggestHit, e.amount)
        if (!r.lowestHp || e.hpAfter / e.maxHp < r.lowestHp.hp / r.lowestHp.maxHp) r.lowestHp = { hp: e.hpAfter, maxHp: e.maxHp }
        break
      case 'heal': if (!(e.toFull && !e.hitDie && nearRest(e.at))) r.healing += e.amount; break
      case 'down': r.timesDowned++; break
      case 'death': r.died = true; break
      case 'revived': r.died = false; break
      case 'slot': r.slotsUsed += e.delta; break
      case 'resource': r.resourcesUsed[e.label] = (r.resourcesUsed[e.label] ?? 0) + e.delta; break
      case 'condition': if (e.added && !r.conditions.includes(e.condition)) r.conditions.push(e.condition); break
      case 'item': {
        const row = r.loot.find(l => l.name === e.name)
        if (row) row.qty += e.delta
        else r.loot.push({ name: e.name, qty: e.delta })
        break
      }
      case 'coins': r.gold = round2(r.gold + toGold(e.delta)); break
      case 'xp': r.xp += e.amount; break
      case 'levelUp': r.levelUps.push(e.to); break
      case 'rest': {
        const t = Date.parse(e.at)
        const times = restTimes[e.rest]
        // Rests within 10 minutes of each other are the same rest taken by several characters.
        if (!times.some(x => Math.abs(x - t) < 10 * 60_000)) { times.push(t); rests[e.rest]++ }
        break
      }
      case 'roll': {
        const roll = e.roll
        r.rolls++
        if (roll.type === 'damage') r.damageRolled += roll.total
        if (roll.d20?.natural === 20) r.nat20s.push(roll)
        if (roll.d20?.natural === 1) r.nat1s.push(roll)
        if (roll.d20 && roll.type !== 'deathSave' && (!r.bestRoll || roll.total > r.bestRoll.total)) r.bestRoll = roll
        break
      }
      default: break
    }
  }

  const characters = [...byKey.values()].map(r => ({ ...r, loot: r.loot.filter(l => l.qty !== 0), slotsUsed: Math.max(0, r.slotsUsed) }))
  const total = (f: (r: CharacterRecap) => number) => characters.reduce((n, r) => n + f(r), 0)
  const end = s.endedAt ?? now
  return {
    title: s.title,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    minutes: Math.max(0, Math.round((Date.parse(end) - Date.parse(s.startedAt)) / 60_000)),
    characters,
    rests,
    highlights: highlights(characters),
    totals: {
      damageTaken: total(r => r.damageTaken),
      healing: total(r => r.healing),
      xp: total(r => r.xp),
      gold: round2(total(r => r.gold)),
      nat20s: total(r => r.nat20s.length),
      nat1s: total(r => r.nat1s.length),
      rolls: total(r => r.rolls),
    },
  }
}

function highlights(cs: CharacterRecap[]): string[] {
  const out: string[] = []
  const players = cs.filter(c => c.characterId)
  for (const c of players) if (c.died) out.push(`${c.name} died.`)
  for (const c of players) {
    if (c.timesDowned > 0 && !c.died) out.push(`${c.name} dropped to 0 HP${c.timesDowned > 1 ? ` ${c.timesDowned} times` : ''} and lived.`)
  }
  for (const c of players) for (const lvl of c.levelUps) out.push(`${c.name} reached level ${lvl}.`)
  const hit = maxBy(players, c => c.biggestHit)
  if (hit && hit.biggestHit > 0) out.push(`Biggest hit: ${hit.name} took ${hit.biggestHit} damage in one blow.`)
  const close = players
    .filter(c => c.lowestHp && c.lowestHp.hp > 0 && c.lowestHp.hp / c.lowestHp.maxHp <= 0.25 && c.timesDowned === 0)
  for (const c of close) out.push(`Close call: ${c.name} was down to ${c.lowestHp!.hp} of ${c.lowestHp!.maxHp} HP.`)
  const crits = cs.filter(c => c.nat20s.length > 0).sort((a, b) => b.nat20s.length - a.nat20s.length)
  for (const c of crits) {
    out.push(c.nat20s.length === 1
      ? `${c.name} rolled a natural 20 on ${rollLabel(c.nat20s[0])}.`
      : `${c.name} rolled ${c.nat20s.length} natural 20s.`)
  }
  const fumbles = maxBy(cs, c => c.nat1s.length)
  if (fumbles && fumbles.nat1s.length >= 2) out.push(`${fumbles.name} rolled ${fumbles.nat1s.length} natural 1s. The dice were not kind.`)
  const loot = players.flatMap(c => c.loot.filter(l => l.qty > 0))
  if (loot.length > 0) out.push(`Loot: ${loot.map(l => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(', ')}.`)
  const gold = round2(players.reduce((n, c) => n + Math.max(0, c.gold), 0))
  if (gold > 0) out.push(`The party gained ${gold} gp.`)
  const xp = players.reduce((n, c) => n + c.xp, 0)
  if (xp > 0) out.push(`The party earned ${xp.toLocaleString('en')} XP.`)
  return out
}

function maxBy<T>(xs: T[], f: (x: T) => number): T | undefined {
  return xs.reduce<T | undefined>((best, x) => (best === undefined || f(x) > f(best) ? x : best), undefined)
}

/** Plain text for pasting into a group chat or campaign notes. */
export function recapToText(r: Recap): string {
  const date = new Date(r.startedAt).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const lines = [`${r.title}`, `${date} · ${formatMinutes(r.minutes)}`, '']
  if (r.highlights.length) lines.push(...r.highlights.map(h => `• ${h}`), '')
  const rests = [r.rests.long && `${r.rests.long} long rest${r.rests.long > 1 ? 's' : ''}`, r.rests.short && `${r.rests.short} short rest${r.rests.short > 1 ? 's' : ''}`].filter(Boolean)
  if (rests.length) lines.push(`Rests: ${rests.join(', ')}`, '')
  for (const c of r.characters) {
    if (!c.characterId && c.rolls === 0) continue
    const parts = [
      c.damageTaken && `took ${c.damageTaken} damage`,
      c.healing && `healed ${c.healing}`,
      c.timesDowned && `downed ${c.timesDowned}×`,
      c.slotsUsed && `${c.slotsUsed} spell slot${c.slotsUsed > 1 ? 's' : ''}`,
      c.rolls && `${c.rolls} roll${c.rolls > 1 ? 's' : ''}`,
      c.nat20s.length && `${c.nat20s.length} nat 20`,
      c.nat1s.length && `${c.nat1s.length} nat 1`,
      c.xp && `+${c.xp} XP`,
      c.gold && `${c.gold > 0 ? '+' : ''}${c.gold} gp`,
    ].filter(Boolean)
    lines.push(`${c.name}${c.died ? ' (fallen)' : ''}: ${parts.length ? parts.join(', ') : 'a quiet session'}`)
  }
  return lines.join('\n').trim()
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

/** One timeline line, without the character's name. */
export function describeEvent(e: SessionEvent): string {
  const n = (x: number, one: string, many = `${one}s`) => `${Math.abs(x)} ${Math.abs(x) === 1 ? one : many}`
  switch (e.kind) {
    case 'damage': return `took ${e.amount} damage (${e.hpAfter}/${e.maxHp} HP)`
    case 'heal': return e.hitDie ? `spent a ${e.hitDie} hit die, healed ${e.amount}` : `healed ${e.amount}${e.toFull ? ' (full HP)' : ''}`
    case 'tempHp': return `gained ${e.amount} temporary HP`
    case 'down': return 'dropped to 0 HP'
    case 'stable': return 'is stable'
    case 'death': return 'died'
    case 'revived': return 'was brought back'
    case 'slot': {
      const what = e.pact ? 'pact slot' : `level ${e.level} slot`
      return e.delta > 0 ? `used ${e.delta > 1 ? `${e.delta} ${what}s` : `a ${what}`}` : `regained ${n(e.delta, what)}`
    }
    case 'resource': return e.delta > 0 ? `used ${e.label}${e.delta > 1 ? ` ×${e.delta}` : ''}` : `regained ${e.label}${e.delta < -1 ? ` ×${-e.delta}` : ''}`
    case 'rest': return `took a ${e.rest} rest`
    case 'condition': return e.added ? `became ${e.condition}` : `is no longer ${e.condition}`
    case 'item': return e.delta > 0 ? `got ${e.name}${e.delta > 1 ? ` ×${e.delta}` : ''}` : `lost ${e.name}${e.delta < -1 ? ` ×${-e.delta}` : ''}`
    case 'coins': {
      const parts = (['gp', 'sp', 'cp'] as const).filter(k => e.delta[k]).map(k => `${e.delta[k] > 0 ? '+' : ''}${e.delta[k]} ${k}`)
      return `coins ${parts.join(', ')}`
    }
    case 'xp': return e.amount >= 0 ? `earned ${e.amount.toLocaleString('en')} XP` : `lost ${(-e.amount).toLocaleString('en')} XP`
    case 'levelUp': return `reached level ${e.to}`
    case 'roll': {
      const r = e.roll
      const tag = r.d20?.natural === 20 ? ' · nat 20' : r.d20?.natural === 1 ? ' · nat 1' : ''
      return `rolled ${rollLabel(r)}: ${r.total}${tag}`
    }
  }
}

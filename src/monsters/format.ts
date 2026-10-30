// Stat block text helpers: CR labels, speeds, usage notes. Pure.
import type { Monster, MonsterAction } from '../content'

/** 0.125 → "1/8". */
export function crLabel(cr: number): string {
  if (cr === 0.125) return '1/8'
  if (cr === 0.25) return '1/4'
  if (cr === 0.5) return '1/2'
  return String(cr)
}

/** "30 ft., swim 40 ft." */
export const speedText = (s: Monster['speed']) =>
  Object.entries(s).filter(([, v]) => typeof v === 'string').map(([k, v]) => (k === 'walk' ? v : `${k} ${v}`)).join(', ')

/** " (Recharge 5–6)", " (3/Day)", " (Recharges after a Short or Long Rest)". */
export const usageText = (a: MonsterAction) =>
  a.usage?.type === 'recharge' ? ` (Recharge ${a.usage.dice === '1d6' ? `${a.usage.minimum}–6` : a.usage.dice})`
    : a.usage?.type === 'per day' ? ` (${a.usage.times}/Day)`
      : a.usage?.type === 'per rest' ? ` (Recharges after a ${a.usage.rests.map(r => r[0].toUpperCase() + r.slice(1)).join(' or ')} Rest)` : ''

/** "Large aberration (shapechanger), lawful evil" */
export const typeLine = (m: Monster) =>
  `${m.sizes.join(' or ')} ${m.type}${m.subtype ? ` (${m.subtype})` : ''}, ${m.alignment}`

/** "darkvision 120 ft., passive Perception 20" */
export const sensesText = (m: Monster) =>
  Object.entries(m.senses).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)

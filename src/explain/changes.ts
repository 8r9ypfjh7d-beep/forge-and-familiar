// Plain-language diff of two versions of a character's play state, for the undo log.
import type { Character } from '../model/character'
import { getResources } from '../rules'

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

const from = (label: string, a: number, b: number) => (a === b ? [] : [`${label} ${a} → ${b}`])

/** What changed between two saves of the same character, e.g. "HP 31 → 23", "Ki Points used 1 → 2". */
export function describeChange(before: Character, after: Character): string[] {
  const s = before.state
  const t = after.state
  const out = [
    ...from('HP', s.currentHp, t.currentHp),
    ...from('Temp HP', s.tempHp, t.tempHp),
    ...from('Death save successes', s.deathSaves.successes, t.deathSaves.successes),
    ...from('Death save failures', s.deathSaves.failures, t.deathSaves.failures),
    ...from('Exhaustion', s.exhaustion, t.exhaustion),
  ]
  for (let i = 0; i < Math.max(s.spellSlotsUsed.length, t.spellSlotsUsed.length); i++) {
    out.push(...from(`${ORDINAL[i]}-level slots used`, s.spellSlotsUsed[i] ?? 0, t.spellSlotsUsed[i] ?? 0))
  }
  out.push(...from('Pact slots used', s.pactSlotsUsed, t.pactSlotsUsed))
  const labels = new Map(getResources(after).map(r => [r.id, r.label]))
  for (const id of new Set([...Object.keys(s.resources), ...Object.keys(t.resources)])) {
    out.push(...from(`${labels.get(id) ?? id} used`, s.resources[id]?.used ?? 0, t.resources[id]?.used ?? 0))
  }
  for (const die of new Set([...Object.keys(s.hitDiceSpent), ...Object.keys(t.hitDiceSpent)]) as Set<keyof typeof s.hitDiceSpent>) {
    out.push(...from(`${die} hit dice spent`, s.hitDiceSpent[die] ?? 0, t.hitDiceSpent[die] ?? 0))
  }
  const before_ = new Map((s.counters ?? []).map(k => [k.id, k]))
  const after_ = new Map((t.counters ?? []).map(k => [k.id, k]))
  for (const [id, k] of after_) {
    const old = before_.get(id)
    if (!old) out.push(`Added tracker ${k.label}`)
    else out.push(...from(`${k.label} used`, old.used, k.used), ...from(`${k.label} max`, old.max, k.max))
  }
  for (const [id, k] of before_) if (!after_.has(id)) out.push(`Removed tracker ${k.label}`)
  for (const c of t.conditions) if (!s.conditions.includes(c)) out.push(`Now ${c}`)
  for (const c of s.conditions) if (!t.conditions.includes(c)) out.push(`No longer ${c}`)
  return out
}

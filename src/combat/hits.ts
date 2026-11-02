// The player's side of live-combat hits: damage or healing the DM dealt to a character that lives on
// this player's device. Pure: the hook in ui/useLiveHits.ts reads the live row and saves the result.
// Damage to a concentrating character also queues its concentration save, which the HP card asks for.
import type { Character } from '../model/character'
import { concentrationDc } from '../rules/damage'
import { concentration } from '../sheet/effects'
import { heal, takeDamage } from '../sheet/engine'
import { editionOf } from '../spellbook/access'
import type { Hit } from './types'

const APPLIED_LIMIT = 100

type Check = NonNullable<Character['state']['concentrationChecks']>[number]

/** The concentration saves still owed: those for the spell the character is concentrating on now. */
export function owedConcentrationChecks(c: Character): Check[] {
  const held = concentration(c)
  return held ? (c.state.concentrationChecks ?? []).filter(x => x.effectId === held.id) : []
}

/** Answers one owed save: drops it, and on a failure ends the spell. */
export function answerConcentrationCheck(c: Character, id: string, kept: boolean): Character {
  const check = (c.state.concentrationChecks ?? []).find(x => x.id === id)
  const rest = (c.state.concentrationChecks ?? []).filter(x => x.id !== id)
  const effects = !kept && check ? (c.state.effects ?? []).filter(e => e.id !== check.effectId) : c.state.effects
  // A lost spell owes no more saves.
  const left = !kept && check ? rest.filter(x => x.effectId !== check.effectId) : rest
  return { ...c, state: { ...c.state, effects, concentrationChecks: left.length ? left : undefined } }
}

function hurt(c: Character, h: Hit): Character {
  const held = concentration(c)
  const next = takeDamage(c, h.amount, { critical: h.critical })
  // Still concentrating after the hit (not knocked out): the save is owed.
  const still = held && h.amount > 0 && concentration(next)?.id === held.id
  if (!still) return next
  const check: Check = { id: h.id, effectId: held.id, name: held.name, dc: concentrationDc(h.amount, editionOf(c)) }
  return { ...next, state: { ...next.state, concentrationChecks: [...owedConcentrationChecks(next), check] } }
}

/** The character with every hit for it that it hasn't taken yet; the same object when there is none. */
export function takeHits(c: Character, hits: readonly Hit[] | undefined): Character {
  const done = new Set(c.appliedHits ?? [])
  const fresh = (hits ?? []).filter(h => h.characterId === c.id && !done.has(h.id))
  if (!fresh.length) return c
  const next = fresh.reduce((ch, h) => (h.kind === 'heal' ? heal(ch, h.amount) : hurt(ch, h)), c)
  return { ...next, appliedHits: [...(c.appliedHits ?? []), ...fresh.map(h => h.id)].slice(-APPLIED_LIMIT) }
}

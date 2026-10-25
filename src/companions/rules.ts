// Pure companion rules (SRD 5.1): which forms a character may take, and HP changes.
// No React, no storage, no randomness; the UI saves what these return.
import type { Character } from '../model/character'
import { getAbilityScores, getResources } from '../rules'
import type { Abilities } from '../rules/types'
import { CREATURES, creatureById } from './data/creatures'
import type { Companion, CompanionKind, Creature } from './types'

export const KIND_LABEL: Record<CompanionKind, string> = {
  familiar: 'Familiar',
  companion: 'Companion',
  summon: 'Summon',
  wildShape: 'Wild shape',
}

export const classLevel = (c: Character, classId: string) =>
  c.classes.filter(cl => cl.classId === classId).reduce((n, cl) => n + cl.level, 0)

export const creatureOf = (comp: Companion): Creature | undefined =>
  comp.creatureId === 'custom' ? comp.custom : creatureById(comp.creatureId)

export function formatCr(cr: number): string {
  if (cr === 0.125) return '1/8'
  if (cr === 0.25) return '1/4'
  if (cr === 0.5) return '1/2'
  return String(cr)
}

export function formatSpeed(s: Creature['speed']): string {
  const parts = [`${s.walk} ft.`]
  if (s.climb) parts.push(`climb ${s.climb} ft.`)
  if (s.fly) parts.push(`fly ${s.fly} ft.`)
  if (s.swim) parts.push(`swim ${s.swim} ft.`)
  if (s.burrow) parts.push(`burrow ${s.burrow} ft.`)
  return parts.join(', ')
}

// ---- Wild shape (SRD 5.1 Druid, Circle of the Land) ----

export interface WildShapeLimits {
  maxCr: number
  fly: boolean
  swim: boolean
  /** Hours a form lasts: half the druid level, rounded down. */
  hours: number
}

/** Undefined below druid level 2. */
export function wildShapeLimits(druidLevel: number): WildShapeLimits | undefined {
  if (druidLevel < 2) return undefined
  const hours = Math.floor(druidLevel / 2)
  if (druidLevel >= 8) return { maxCr: 1, fly: true, swim: true, hours }
  if (druidLevel >= 4) return { maxCr: 0.5, fly: false, swim: true, hours }
  return { maxCr: 0.25, fly: false, swim: false, hours }
}

export function canWildShapeInto(creature: Creature, limits: WildShapeLimits): boolean {
  return creature.type === 'beast' && creature.cr <= limits.maxCr
    && (limits.fly || !creature.speed.fly) && (limits.swim || !creature.speed.swim)
}

export const wildShapeForms = (c: Character): Creature[] => {
  const limits = wildShapeLimits(classLevel(c, 'druid'))
  return limits ? CREATURES.filter(cr => canWildShapeInto(cr, limits)) : []
}

/** In wild shape the druid keeps their own Intelligence, Wisdom and Charisma. */
export function formAbilities(creature: Creature, comp: Companion, owner?: Character): Abilities {
  if (comp.kind !== 'wildShape' || !owner) return creature.abilities
  const own = getAbilityScores(owner)
  return { ...creature.abilities, int: own.int, wis: own.wis, cha: own.cha }
}

// ---- Which creatures each kind offers ----

/** Find Familiar forms, plus imp, pseudodragon, quasit and sprite for a warlock 3+ (Pact of the Chain). */
export function familiarForms(c: Character): Creature[] {
  const chain = classLevel(c, 'warlock') >= 3
  return CREATURES.filter(cr => cr.familiar === 'any' || (chain && cr.familiar === 'chain'))
}

export function formsFor(kind: CompanionKind, c: Character): Creature[] {
  if (kind === 'familiar') return familiarForms(c)
  if (kind === 'wildShape') return wildShapeForms(c)
  // Beast companions and summons (Conjure Animals and the like): any SRD beast here.
  return CREATURES.filter(cr => cr.type === 'beast')
}

// ---- Hit points ----

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export interface DamageResult {
  companion: Companion
  /** Damage left after dropping to 0 HP. In wild shape it carries over to the druid. */
  overflow: number
}

export function damageCompanion(comp: Companion, amount: number): DamageResult {
  if (amount <= 0) return { companion: comp, overflow: 0 }
  const absorbed = Math.min(comp.tempHp, amount)
  const rest = amount - absorbed
  const overflow = Math.max(0, rest - comp.currentHp)
  return {
    companion: { ...comp, tempHp: comp.tempHp - absorbed, currentHp: Math.max(0, comp.currentHp - rest) },
    overflow,
  }
}

export function healCompanion(comp: Companion, amount: number): Companion {
  if (amount <= 0) return comp
  return { ...comp, currentHp: clamp(comp.currentHp + amount, 0, comp.maxHp) }
}

/** Temp HP doesn't stack: keep the higher value. */
export function tempHpCompanion(comp: Companion, amount: number): Companion {
  return { ...comp, tempHp: Math.max(comp.tempHp, Math.max(0, amount)) }
}

/** Back to full HP, e.g. a familiar summoned again or a pet after a long rest. */
export function restoreCompanion(comp: Companion): Companion {
  return { ...comp, currentHp: comp.maxHp, tempHp: 0, conditions: [] }
}

export function setMaxHp(comp: Companion, maxHp: number): Companion {
  const max = Math.max(1, Math.floor(maxHp))
  return { ...comp, maxHp: max, currentHp: Math.min(comp.currentHp, max) }
}

/** What a 0 HP companion means at the table, by kind. */
export function downText(kind: CompanionKind): string {
  switch (kind) {
    case 'familiar': return 'Vanished. Cast Find Familiar again (1 hour, 10 gp) to bring it back.'
    case 'summon': return 'Gone. Remove it, or summon again.'
    case 'companion': return 'Down at 0 HP.'
    case 'wildShape': return 'Reverted to normal form.'
  }
}

/** Fresh companion at full HP. `now` and `id` are passed in to keep this pure. */
export function newCompanion(
  input: { kind: CompanionKind; name: string; creature: Creature; owner: Character; maxHp?: number },
  id: string,
  now: Date,
): Companion {
  const maxHp = Math.max(1, Math.floor(input.maxHp ?? input.creature.hp))
  const custom = creatureById(input.creature.id) ? undefined : input.creature
  return {
    id,
    characterId: input.owner.id,
    ownerId: input.owner.ownerId,
    kind: input.kind,
    name: input.name.trim() || input.creature.name,
    creatureId: custom ? 'custom' : input.creature.id,
    custom,
    maxHp,
    currentHp: maxHp,
    tempHp: 0,
    conditions: [],
    notes: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

/** Wild Shape uses for the druid, from the class resource the live sheet tracks. */
export function wildShapeUses(c: Character): { max: number; left: number } {
  const def = getResources(c).find(r => r.id === WILD_SHAPE)
  if (!def) return { max: 0, left: 0 }
  return { max: def.max, left: Math.max(0, def.max - (c.state.resources?.[WILD_SHAPE]?.used ?? 0)) }
}

export const WILD_SHAPE = 'wild-shape'

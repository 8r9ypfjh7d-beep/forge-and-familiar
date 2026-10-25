// Which reactions a character can take right now, and what each costs.
// Pure: reads a Character and the rules engine, never changes anything.
// SRD 5.1 only: Opportunity Attack, class features and the SRD reaction spells.
import type { Character } from '../model/character'
import { entryItem, getAbilityMods, getAbilityScores, getArmorClass, getAttacks, getSpellSlots, type ConditionId } from '../rules'

export type ReactionCost =
  | { kind: 'slot'; level: number }
  | { kind: 'none' }

export interface Reaction {
  id: string
  name: string
  /** Where it comes from, e.g. "Everyone", "Rogue 5", "1st-level spell". */
  source: string
  /** When you can use it. */
  trigger: string
  /** What it does, with this character's numbers filled in. */
  effect: string
  cost: ReactionCost
  /** False when the character has it but cannot pay for it now (no slot left). */
  ready: boolean
  /** Why it is not ready. */
  note?: string
}

/** Conditions that stop all reactions (each one includes or implies incapacitated). */
const NO_REACTIONS: ConditionId[] = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']

/** Why the character cannot react at all, or null if they can. */
export function reactionBlocker(c: Character): string | null {
  if (c.state.currentHp <= 0) return 'Unconscious at 0 HP'
  const blocked = NO_REACTIONS.find(id => c.state.conditions.includes(id))
  return blocked ? `${blocked[0].toUpperCase()}${blocked.slice(1)}` : null
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

interface SpellDef {
  id: string
  name: string
  level: number
  classes: string[]
  trigger: string
  effect: (c: Character) => string
}

const SPELLS: SpellDef[] = [
  {
    id: 'shield', name: 'Shield', level: 1, classes: ['sorcerer', 'wizard'],
    trigger: 'You are hit by an attack or targeted by magic missile.',
    effect: c => {
      const ac = getArmorClass(c).value
      return `+5 AC until the start of your next turn (AC ${ac} → ${ac + 5}), including against the triggering attack. No damage from magic missile.`
    },
  },
  {
    id: 'feather-fall', name: 'Feather Fall', level: 1, classes: ['bard', 'sorcerer', 'wizard'],
    trigger: 'You or a creature within 60 feet falls.',
    effect: () => 'Up to five falling creatures descend 60 feet per round and take no falling damage for 1 minute.',
  },
  {
    id: 'hellish-rebuke', name: 'Hellish Rebuke', level: 1, classes: ['warlock'],
    trigger: 'A creature within 60 feet that you can see damages you.',
    effect: () => 'It makes a DEX save or takes 2d10 fire damage (half on a success), +1d10 per slot level above 1st.',
  },
  {
    id: 'counterspell', name: 'Counterspell', level: 3, classes: ['sorcerer', 'warlock', 'wizard'],
    trigger: 'A creature within 60 feet that you can see casts a spell.',
    effect: () => 'A spell of 3rd level or lower fails. Higher: make a spellcasting check, DC 10 + its level, or cast with a slot of its level.',
  },
]

/** Lowest slot level at or above `level` that is still unspent, regular or pact. */
export function lowestFreeSlot(c: Character, level: number): { level: number; pact: boolean } | null {
  const { slots, pact } = getSpellSlots(c)
  const used = c.state.spellSlotsUsed
  const options: { level: number; pact: boolean }[] = []
  for (let i = level - 1; i < slots.length; i++) {
    if (slots[i] - (used[i] ?? 0) > 0) { options.push({ level: i + 1, pact: false }); break }
  }
  if (pact && pact.level >= level && pact.count - c.state.pactSlotsUsed > 0) options.push({ level: pact.level, pact: true })
  return options.sort((a, b) => a.level - b.level)[0] ?? null
}

/** Highest spell level the character has any slot for, spent or not. */
function maxSlotLevel(c: Character): number {
  const { slots, pact } = getSpellSlots(c)
  let max = 0
  slots.forEach((n, i) => { if (n > 0) max = i + 1 })
  return Math.max(max, pact?.count ? pact.level : 0)
}

function opportunityAttack(c: Character): Reaction {
  const meleeNames = new Set(c.inventory.flatMap(e => {
    const item = e.equipped ? entryItem(e) : undefined
    return item?.kind === 'weapon' && !item.properties.includes('ranged') ? [item.name] : []
  }))
  const melee = getAttacks(c).filter(a => meleeNames.has(a.name) || a.name === 'Unarmed Strike')
  const best = melee.find(a => a.name !== 'Unarmed Strike') ?? melee[melee.length - 1]
  const sign = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)
  return {
    id: 'opportunity-attack', name: 'Opportunity Attack', source: 'Everyone',
    trigger: 'A hostile creature you can see moves out of your reach (not if it Disengages or is moved without its own movement).',
    effect: best
      ? `One melee attack: ${best.name} ${sign(best.bonus)} to hit, ${best.damage} ${best.damageType}.`
      : 'One melee attack against it.',
    cost: { kind: 'none' }, ready: true,
  }
}

/** Every reaction this character has: Opportunity Attack, then class features, then spells. */
export function getReactions(c: Character): Reaction[] {
  const out: Reaction[] = [opportunityAttack(c)]
  const levelIn = (id: string) => c.classes.find(cl => cl.classId === id)?.level ?? 0
  const mods = getAbilityMods(getAbilityScores(c))

  const rogue = levelIn('rogue')
  if (rogue >= 5) {
    out.push({
      id: 'uncanny-dodge', name: 'Uncanny Dodge', source: 'Rogue 5',
      trigger: 'An attacker you can see hits you with an attack.',
      effect: "Halve the attack's damage against you.",
      cost: { kind: 'none' }, ready: true,
    })
  }

  const monk = levelIn('monk')
  if (monk >= 3) {
    out.push({
      id: 'deflect-missiles', name: 'Deflect Missiles', source: 'Monk 3',
      trigger: 'You are hit by a ranged weapon attack.',
      effect: `Reduce the damage by 1d10${mods.dex + monk >= 0 ? '+' : '−'}${Math.abs(mods.dex + monk)}. At 0 damage you catch it and can spend 1 ki to throw it back.`,
      cost: { kind: 'none' }, ready: true,
    })
  }
  if (monk >= 4) {
    out.push({
      id: 'slow-fall', name: 'Slow Fall', source: 'Monk 4',
      trigger: 'You fall.',
      effect: `Reduce the falling damage by ${5 * monk}.`,
      cost: { kind: 'none' }, ready: true,
    })
  }

  const top = maxSlotLevel(c)
  for (const spell of SPELLS) {
    if (!c.classes.some(cl => spell.classes.includes(cl.classId)) || top < spell.level) continue
    const slot = lowestFreeSlot(c, spell.level)
    out.push({
      id: spell.id, name: spell.name, source: `${ORDINAL[spell.level - 1]}-level spell, if prepared`,
      trigger: spell.trigger, effect: spell.effect(c),
      cost: { kind: 'slot', level: spell.level }, ready: slot !== null,
      note: slot ? undefined : `No ${ORDINAL[spell.level - 1]}-level or higher slot left`,
    })
  }
  return out
}

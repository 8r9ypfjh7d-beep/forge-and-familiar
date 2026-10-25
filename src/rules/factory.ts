import { CHARACTER_SCHEMA_VERSION, type Character, type CharacterState } from '../model/character'
import { classKit } from './choices'
import { getBackground } from './data/backgrounds'
import { classById } from './data/classes'
import { itemById } from './data/items'
import { getMaxHp } from './derive'

/** The choices the builder collects before a character exists. */
export type CharacterDraft = Omit<Character, 'id' | 'schemaVersion' | 'inventory' | 'state' | 'createdAt' | 'updatedAt' | 'xp' | 'notes' | 'coins'>

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)

export function freshState(maxHp: number): CharacterState {
  return {
    currentHp: maxHp,
    tempHp: 0,
    deathSaves: { successes: 0, failures: 0 },
    hitDiceSpent: {},
    spellSlotsUsed: Array(9).fill(0),
    pactSlotsUsed: 0,
    resources: {},
    conditions: [],
    counters: [],
  }
}

/** Starting gear ids from the class kit and the background, merged into stacks. */
export function startingItemIds(draft: Pick<CharacterDraft, 'classes' | 'backgroundId' | 'customBackground' | 'equipmentPicks'>): string[] {
  const cls = classById(draft.classes[0]?.classId ?? '')
  const bg = getBackground(draft)
  return [...(cls ? classKit(cls, draft.equipmentPicks) : []), ...(bg?.equipment ?? [])]
}

const AMMO_BUNDLE: Record<string, number> = { arrows: 20, bolts: 20, rations: 5, torch: 5 }

/** Turn a finished draft into a saved character, full HP, starting kit equipped. */
export function createCharacter(draft: CharacterDraft, now = new Date()): Character {
  const inventory: Character['inventory'] = []
  let wornArmor = false
  let weapons = 0
  for (const itemId of startingItemIds(draft)) {
    const stack = inventory.find(e => e.itemId === itemId)
    if (stack) {
      stack.qty += 1
      continue
    }
    // Equip the first body armor, a shield and up to two weapons.
    const item = itemById(itemId)
    let equipped = false
    if (item?.kind === 'armor' && item.category === 'shield') equipped = true
    else if (item?.kind === 'armor') {
      equipped = !wornArmor
      wornArmor = true
    } else if (item?.kind === 'weapon') {
      equipped = weapons < 2
      weapons += 1
    }
    inventory.push({ uid: uid(), itemId, qty: AMMO_BUNDLE[itemId] ?? 1, equipped })
  }

  const base: Character = {
    ...draft,
    id: uid(),
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    xp: 0,
    notes: '',
    coins: { cp: 0, sp: 0, gp: 15 },
    inventory,
    state: freshState(1),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  base.state = freshState(getMaxHp(base))
  return base
}

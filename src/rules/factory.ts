import { CHARACTER_SCHEMA_VERSION, type Character, type CharacterState } from '../model/character'
import { classKit, kitGold } from './choices'
import { BACKGROUNDS, getBackground } from './data/backgrounds'
import { classById } from './data/classes'
import { itemById } from './data/items'
import { ARTISAN_TOOLS, GAMING_SETS, MUSICAL_INSTRUMENTS } from './data/proficiencies'
import { getMaxHp } from './derive'
import type { Item } from './types'
import { rulesEdition } from './edition'
import { BACKGROUND_GOLD_2024, coinsFromCp, purchasesCp, takesBackgroundGold, takesClassGold } from './wealth'

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

type GearInput = Pick<CharacterDraft, 'classes' | 'backgroundId' | 'customBackground' | 'equipmentPicks' | 'rulesEdition' | 'startingWealth'>

/** Starting gear ids from the class kit and the background, merged into stacks. Starting wealth taken instead drops them. */
export function startingItemIds(draft: GearInput): string[] {
  if (takesClassGold(draft)) return []
  const cls = classById(draft.classes[0]?.classId ?? '', rulesEdition(draft))
  const bg = takesBackgroundGold(draft) ? undefined : getBackground(draft)
  return [...(cls ? classKit(cls, draft.equipmentPicks) : []), ...(bg?.equipment ?? [])]
}

/**
 * Starting gold before shopping. 2014: an official background's purse (15 gp plus the coins of a homebrew one),
 * or the class gold taken instead of the gear. 2024: the class kit's and the background's coins (50 gp when the background's option B is taken).
 */
export function startingGold(draft: GearInput): number {
  if (rulesEdition(draft) !== '2024') {
    if (takesClassGold(draft)) return Math.max(0, draft.startingWealth?.classGold ?? 0)
    const bg = getBackground(draft)
    return bg && BACKGROUNDS.some(b => b.id === bg.id) ? bg.gold ?? 15 : 15 + (bg?.gold ?? 0)
  }
  const cls = classById(draft.classes[0]?.classId ?? '', '2024')
  const bg = takesBackgroundGold(draft) ? BACKGROUND_GOLD_2024 : (getBackground(draft)?.gold ?? 0)
  return (cls ? kitGold(cls, draft.equipmentPicks) : 0) + bg
}

/** Coins left after the builder purchases (never below 0) and how far over budget the cart is, in cp. */
export function startingCoins(draft: GearInput & Pick<CharacterDraft, 'purchases'>): { coins: Character['coins']; leftCp: number } {
  const leftCp = startingGold(draft) * 100 - purchasesCp(draft.purchases)
  return { coins: coinsFromCp(leftCp), leftCp }
}

const AMMO_BUNDLE: Record<string, number> = { arrows: 20, bolts: 20, rations: 5, torch: 5 }

/** Kit items that stand for the tool the player picks ("Artisan's Tools (same as above)"). */
const PICKED_TOOL: Record<string, string[]> = { 'artisans-tools': ARTISAN_TOOLS, 'gaming-set': GAMING_SETS, 'musical-instrument': MUSICAL_INSTRUMENTS }

/** Turn a finished draft into a saved character, full HP, starting kit equipped. */
export function createCharacter(draft: CharacterDraft, now = new Date()): Character {
  const inventory: Character['inventory'] = []
  let wornArmor = false
  const gear: { itemId: string; item?: Item; qty?: number }[] = [
    ...startingItemIds(draft).map(itemId => ({ itemId })),
    ...(draft.purchases ?? []).filter(p => p.qty > 0),
  ]
  for (const { itemId, item: embedded, qty } of gear) {
    const stack = inventory.find(e => e.itemId === itemId && !e.item === !embedded)
    if (stack) {
      stack.qty += qty ?? AMMO_BUNDLE[itemId] ?? 1
      continue
    }
    // Equip the first body armor, a shield and every weapon, so each one shows under Attacks.
    const item = embedded ?? itemById(itemId)
    let equipped = false
    if (item?.kind === 'armor' && item.category === 'shield') equipped = true
    else if (item?.kind === 'armor') {
      equipped = !wornArmor
      wornArmor = true
    } else if (item?.kind === 'weapon') equipped = true
    const picked = PICKED_TOOL[itemId] && draft.chosenTools?.find(t => PICKED_TOOL[itemId].includes(t))
    inventory.push({ uid: uid(), itemId, qty: qty ?? AMMO_BUNDLE[itemId] ?? 1, equipped, ...(embedded ? { item: embedded } : {}), ...(picked ? { name: picked } : {}) })
  }

  const base: Character = {
    ...draft,
    id: uid(),
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    xp: 0,
    notes: '',
    coins: startingCoins(draft).coins,
    inventory,
    state: freshState(1),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  base.state = freshState(getMaxHp(base))
  return base
}

// Editing a saved character with the builder: turn it back into a draft, then put the
// edited choices back on it without losing play state.
import type { Character } from '../model/character'
import { coinsFromCp, createCharacter, startingCoins, startingItemIds, type CharacterDraft } from '../rules'
import { effectiveMaxHp, normalize } from '../sheet/engine'

/** Fields a character has that the builder does not edit. */
const NOT_IN_DRAFT = ['id', 'schemaVersion', 'inventory', 'state', 'createdAt', 'updatedAt', 'xp', 'notes', 'coins'] as const

/** The builder draft for an existing character. Lists are copied so edits never touch the original. */
export function draftFrom(c: Character): CharacterDraft {
  const copy = structuredClone(c) as Partial<Character>
  for (const key of NOT_IN_DRAFT) delete copy[key]
  return {
    ...(copy as CharacterDraft),
    freeAbilityBonuses: copy.freeAbilityBonuses ?? [],
    chosenSkills: copy.chosenSkills ?? [],
  }
}

const sameList = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join()

/** Starting gear ids plus builder purchases (`id×qty`), for comparing two versions. */
const startingGear = (c: CharacterDraft) => [...startingItemIds(c), ...(c.purchases ?? []).map(p => `${p.itemId}×${p.qty}`)]

/** True when the edit changes the class kit, background gear or builder purchases the character started with. */
export function startingGearChanged(original: Character, draft: CharacterDraft): boolean {
  return !sameList(startingGear(original), startingGear(draft))
}

/** Takes the old starting gear out of the inventory and adds the new one. Other items stay. */
function swapStartingGear(original: Character, draft: CharacterDraft): Character['inventory'] {
  const inventory = original.inventory.map(e => ({ ...e }))
  for (const old of createCharacter(draftFrom(original)).inventory) {
    let left = old.qty
    for (const e of inventory) {
      if (left === 0) break
      if (e.itemId !== old.itemId) continue
      const take = Math.min(left, e.qty)
      e.qty -= take
      left -= take
    }
  }
  const kept = inventory.filter(e => e.qty > 0)
  for (const fresh of createCharacter(draft).inventory) {
    const stack = kept.find(e => e.itemId === fresh.itemId)
    if (stack) stack.qty += fresh.qty
    else kept.push(fresh)
  }
  return kept
}

/** Coins moved by the change in starting money left after shopping, never below 0 in total. */
function swapStartingCoins(original: Character, draft: CharacterDraft): Character['coins'] {
  const delta = startingCoins(draft).leftCp - startingCoins(original).leftCp
  if (delta === 0) return original.coins
  const { cp, sp, gp } = original.coins
  if (delta < 0) return coinsFromCp(cp + sp * 10 + gp * 100 + delta)
  const add = coinsFromCp(delta)
  return { cp: cp + add.cp, sp: sp + add.sp, gp: gp + add.gp }
}

/**
 * The saved character with the edited choices applied. Id, owner, XP, notes, coins and
 * play state are kept; swapping the starting gear also moves the coins by the change in starting money.
 * Current HP moves with max HP, so a full-health character stays full;
 * slots, hit dice and resources are clamped to the new maxima.
 */
export function applyEdit(original: Character, draft: CharacterDraft, opts: { replaceGear?: boolean } = {}): Character {
  const next: Character = {
    ...original,
    ...draft,
    id: original.id,
    ownerId: original.ownerId,
    inventory: opts.replaceGear ? swapStartingGear(original, draft) : original.inventory,
    coins: opts.replaceGear ? swapStartingCoins(original, draft) : original.coins,
    state: { ...original.state },
  }
  const hp = original.state.currentHp
  if (hp > 0) next.state.currentHp = Math.max(1, hp + effectiveMaxHp(next) - effectiveMaxHp(original))
  return normalize(next)
}

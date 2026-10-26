import type { InventoryEntry, Item } from '../types'

// SRD 5.1 weapons, armor and a little adventuring gear.
export const ITEMS: Item[] = [
  // Simple melee
  { kind: 'weapon', id: 'club', name: 'Club', category: 'simple', damage: '1d4', damageType: 'bludgeoning', properties: ['light'], weight: 2 },
  { kind: 'weapon', id: 'dagger', name: 'Dagger', category: 'simple', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'light', 'thrown'], range: '20/60', weight: 1 },
  { kind: 'weapon', id: 'handaxe', name: 'Handaxe', category: 'simple', damage: '1d6', damageType: 'slashing', properties: ['light', 'thrown'], range: '20/60', weight: 2 },
  { kind: 'weapon', id: 'javelin', name: 'Javelin', category: 'simple', damage: '1d6', damageType: 'piercing', properties: ['thrown'], range: '30/120', weight: 2 },
  { kind: 'weapon', id: 'mace', name: 'Mace', category: 'simple', damage: '1d6', damageType: 'bludgeoning', properties: [], weight: 4 },
  { kind: 'weapon', id: 'quarterstaff', name: 'Quarterstaff', category: 'simple', damage: '1d6', damageType: 'bludgeoning', properties: ['versatile'], versatile: '1d8', weight: 4 },
  { kind: 'weapon', id: 'greatclub', name: 'Greatclub', category: 'simple', damage: '1d8', damageType: 'bludgeoning', properties: ['two-handed'], weight: 10 },
  { kind: 'weapon', id: 'light-hammer', name: 'Light Hammer', category: 'simple', damage: '1d4', damageType: 'bludgeoning', properties: ['light', 'thrown'], range: '20/60', weight: 2 },
  { kind: 'weapon', id: 'sickle', name: 'Sickle', category: 'simple', damage: '1d4', damageType: 'slashing', properties: ['light'], weight: 2 },
  { kind: 'weapon', id: 'spear', name: 'Spear', category: 'simple', damage: '1d6', damageType: 'piercing', properties: ['thrown', 'versatile'], versatile: '1d8', range: '20/60', weight: 3 },
  // Simple ranged
  { kind: 'weapon', id: 'light-crossbow', name: 'Light Crossbow', category: 'simple', damage: '1d8', damageType: 'piercing', properties: ['ranged', 'ammunition', 'loading', 'two-handed'], range: '80/320', weight: 5 },
  { kind: 'weapon', id: 'dart', name: 'Dart', category: 'simple', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'thrown'], range: '20/60', weight: 0.25 },
  { kind: 'weapon', id: 'sling', name: 'Sling', category: 'simple', damage: '1d4', damageType: 'bludgeoning', properties: ['ranged', 'ammunition'], range: '30/120', weight: 0 },
  { kind: 'weapon', id: 'shortbow', name: 'Shortbow', category: 'simple', damage: '1d6', damageType: 'piercing', properties: ['ranged', 'ammunition', 'two-handed'], range: '80/320', weight: 2 },
  // Martial melee
  { kind: 'weapon', id: 'battleaxe', name: 'Battleaxe', category: 'martial', damage: '1d8', damageType: 'slashing', properties: ['versatile'], versatile: '1d10', weight: 4 },
  { kind: 'weapon', id: 'greataxe', name: 'Greataxe', category: 'martial', damage: '1d12', damageType: 'slashing', properties: ['heavy', 'two-handed'], weight: 7 },
  { kind: 'weapon', id: 'flail', name: 'Flail', category: 'martial', damage: '1d8', damageType: 'bludgeoning', properties: [], weight: 2 },
  { kind: 'weapon', id: 'glaive', name: 'Glaive', category: 'martial', damage: '1d10', damageType: 'slashing', properties: ['heavy', 'reach', 'two-handed'], weight: 6 },
  { kind: 'weapon', id: 'greatsword', name: 'Greatsword', category: 'martial', damage: '2d6', damageType: 'slashing', properties: ['heavy', 'two-handed'], weight: 6 },
  { kind: 'weapon', id: 'halberd', name: 'Halberd', category: 'martial', damage: '1d10', damageType: 'slashing', properties: ['heavy', 'reach', 'two-handed'], weight: 6 },
  { kind: 'weapon', id: 'lance', name: 'Lance', category: 'martial', damage: '1d12', damageType: 'piercing', properties: ['reach'], weight: 6 },
  { kind: 'weapon', id: 'longsword', name: 'Longsword', category: 'martial', damage: '1d8', damageType: 'slashing', properties: ['versatile'], versatile: '1d10', weight: 3 },
  { kind: 'weapon', id: 'maul', name: 'Maul', category: 'martial', damage: '2d6', damageType: 'bludgeoning', properties: ['heavy', 'two-handed'], weight: 10 },
  { kind: 'weapon', id: 'morningstar', name: 'Morningstar', category: 'martial', damage: '1d8', damageType: 'piercing', properties: [], weight: 4 },
  { kind: 'weapon', id: 'pike', name: 'Pike', category: 'martial', damage: '1d10', damageType: 'piercing', properties: ['heavy', 'reach', 'two-handed'], weight: 18 },
  { kind: 'weapon', id: 'rapier', name: 'Rapier', category: 'martial', damage: '1d8', damageType: 'piercing', properties: ['finesse'], weight: 2 },
  { kind: 'weapon', id: 'scimitar', name: 'Scimitar', category: 'martial', damage: '1d6', damageType: 'slashing', properties: ['finesse', 'light'], weight: 3 },
  { kind: 'weapon', id: 'shortsword', name: 'Shortsword', category: 'martial', damage: '1d6', damageType: 'piercing', properties: ['finesse', 'light'], weight: 2 },
  { kind: 'weapon', id: 'trident', name: 'Trident', category: 'martial', damage: '1d6', damageType: 'piercing', properties: ['thrown', 'versatile'], versatile: '1d8', range: '20/60', weight: 4 },
  { kind: 'weapon', id: 'war-pick', name: 'War Pick', category: 'martial', damage: '1d8', damageType: 'piercing', properties: [], weight: 2 },
  { kind: 'weapon', id: 'warhammer', name: 'Warhammer', category: 'martial', damage: '1d8', damageType: 'bludgeoning', properties: ['versatile'], versatile: '1d10', weight: 2 },
  { kind: 'weapon', id: 'whip', name: 'Whip', category: 'martial', damage: '1d4', damageType: 'slashing', properties: ['finesse', 'reach'], weight: 3 },
  // Martial ranged
  { kind: 'weapon', id: 'blowgun', name: 'Blowgun', category: 'martial', damage: '1', damageType: 'piercing', properties: ['ranged', 'ammunition', 'loading'], range: '25/100', weight: 1 },
  { kind: 'weapon', id: 'heavy-crossbow', name: 'Heavy Crossbow', category: 'martial', damage: '1d10', damageType: 'piercing', properties: ['ranged', 'ammunition', 'heavy', 'loading', 'two-handed'], range: '100/400', weight: 18 },
  { kind: 'weapon', id: 'longbow', name: 'Longbow', category: 'martial', damage: '1d8', damageType: 'piercing', properties: ['ranged', 'ammunition', 'heavy', 'two-handed'], range: '150/600', weight: 2 },
  { kind: 'weapon', id: 'hand-crossbow', name: 'Hand Crossbow', category: 'martial', damage: '1d6', damageType: 'piercing', properties: ['ranged', 'ammunition', 'light', 'loading'], range: '30/120', weight: 3 },

  // Armor
  { kind: 'armor', id: 'padded', name: 'Padded Armor', category: 'light', baseAc: 11, stealthDisadvantage: true, weight: 8 },
  { kind: 'armor', id: 'leather', name: 'Leather Armor', category: 'light', baseAc: 11, weight: 10 },
  { kind: 'armor', id: 'studded-leather', name: 'Studded Leather', category: 'light', baseAc: 12, weight: 13 },
  { kind: 'armor', id: 'hide', name: 'Hide Armor', category: 'medium', baseAc: 12, dexCap: 2, weight: 12 },
  { kind: 'armor', id: 'chain-shirt', name: 'Chain Shirt', category: 'medium', baseAc: 13, dexCap: 2, weight: 20 },
  { kind: 'armor', id: 'scale-mail', name: 'Scale Mail', category: 'medium', baseAc: 14, dexCap: 2, stealthDisadvantage: true, weight: 45 },
  { kind: 'armor', id: 'breastplate', name: 'Breastplate', category: 'medium', baseAc: 14, dexCap: 2, weight: 20 },
  { kind: 'armor', id: 'half-plate', name: 'Half Plate', category: 'medium', baseAc: 15, dexCap: 2, stealthDisadvantage: true, weight: 40 },
  { kind: 'armor', id: 'ring-mail', name: 'Ring Mail', category: 'heavy', baseAc: 14, dexCap: 0, stealthDisadvantage: true, weight: 40 },
  { kind: 'armor', id: 'chain-mail', name: 'Chain Mail', category: 'heavy', baseAc: 16, dexCap: 0, stealthDisadvantage: true, strengthReq: 13, weight: 55 },
  { kind: 'armor', id: 'splint', name: 'Splint Armor', category: 'heavy', baseAc: 17, dexCap: 0, stealthDisadvantage: true, strengthReq: 15, weight: 60 },
  { kind: 'armor', id: 'plate', name: 'Plate Armor', category: 'heavy', baseAc: 18, dexCap: 0, stealthDisadvantage: true, strengthReq: 15, weight: 65 },
  { kind: 'armor', id: 'shield', name: 'Shield', category: 'shield', baseAc: 2, weight: 6 },

  // Gear
  { kind: 'gear', id: 'arrows', name: 'Arrows', weight: 0.05 },
  { kind: 'gear', id: 'bolts', name: 'Crossbow Bolts', weight: 0.075 },
  { kind: 'gear', id: 'backpack', name: 'Backpack', weight: 5 },
  { kind: 'gear', id: 'bedroll', name: 'Bedroll', weight: 7 },
  { kind: 'gear', id: 'rations', name: 'Rations (1 day)', weight: 2 },
  { kind: 'gear', id: 'rope', name: 'Hempen Rope (50 ft)', weight: 10 },
  { kind: 'gear', id: 'torch', name: 'Torch', weight: 1 },
  { kind: 'gear', id: 'waterskin', name: 'Waterskin', weight: 5 },
  { kind: 'gear', id: 'holy-symbol', name: 'Holy Symbol', weight: 1 },
  { kind: 'gear', id: 'arcane-focus', name: 'Arcane Focus (crystal)', weight: 1 },
  { kind: 'gear', id: 'druidic-focus', name: 'Druidic Focus', weight: 0 },
  { kind: 'gear', id: 'component-pouch', name: 'Component Pouch', weight: 2 },
  { kind: 'gear', id: 'spellbook', name: 'Spellbook', weight: 3 },
  { kind: 'gear', id: 'lute', name: 'Lute', weight: 2 },
  { kind: 'gear', id: 'thieves-tools', name: "Thieves' Tools", weight: 1 },
  { kind: 'gear', id: 'prayer-book', name: 'Prayer Book', weight: 5 },
  { kind: 'gear', id: 'vestments', name: 'Vestments', weight: 4 },
  { kind: 'gear', id: 'healers-kit', name: "Healer's Kit", weight: 3 },
  { kind: 'gear', id: 'bagpipes', name: 'Bagpipes', weight: 6 },
  { kind: 'gear', id: 'drum', name: 'Drum', weight: 3 },
  { kind: 'gear', id: 'dulcimer', name: 'Dulcimer', weight: 10 },
  { kind: 'gear', id: 'flute', name: 'Flute', weight: 1 },
  { kind: 'gear', id: 'lyre', name: 'Lyre', weight: 2 },
  { kind: 'gear', id: 'horn', name: 'Horn', weight: 2 },
  { kind: 'gear', id: 'pan-flute', name: 'Pan Flute', weight: 2 },
  { kind: 'gear', id: 'shawm', name: 'Shawm', weight: 1 },
  { kind: 'gear', id: 'viol', name: 'Viol', weight: 1 },
  { kind: 'gear', id: 'herbalism-kit', name: 'Herbalism Kit', weight: 3 },
  { kind: 'gear', id: 'calligraphers-supplies', name: "Calligrapher's Supplies", weight: 5 },
  { kind: 'gear', id: 'book', name: 'Book', weight: 5 },
  { kind: 'gear', id: 'parchment', name: 'Parchment (one sheet)', weight: 0 },
  { kind: 'gear', id: 'robe', name: 'Robe', weight: 4 },
  { kind: 'gear', id: 'crowbar', name: 'Crowbar', weight: 5 },
  { kind: 'gear', id: 'pouch', name: 'Pouch', weight: 1 },
  { kind: 'gear', id: 'clothes-travelers', name: "Traveler's Clothes", weight: 4 },
  { kind: 'gear', id: 'quiver', name: 'Quiver', weight: 1 },
  // Equipment packs, kept as one item each.
  { kind: 'gear', id: 'burglars-pack', name: "Burglar's Pack", weight: 44.5, description: 'Backpack, 1,000 ball bearings, 10 ft. string, bell, 5 candles, crowbar, hammer, 10 pitons, hooded lantern, 2 flasks of oil, 5 days rations, tinderbox, waterskin, 50 ft. hempen rope.' },
  { kind: 'gear', id: 'diplomats-pack', name: "Diplomat's Pack", weight: 39, description: 'Chest, 2 map or scroll cases, fine clothes, ink, ink pen, lamp, 2 flasks of oil, 5 sheets of paper, vial of perfume, sealing wax, soap.' },
  { kind: 'gear', id: 'dungeoneers-pack', name: "Dungeoneer's Pack", weight: 61.5, description: 'Backpack, crowbar, hammer, 10 pitons, 10 torches, tinderbox, 10 days rations, waterskin, 50 ft. hempen rope.' },
  { kind: 'gear', id: 'entertainers-pack', name: "Entertainer's Pack", weight: 38, description: 'Backpack, bedroll, 2 costumes, 5 candles, 5 days rations, waterskin, disguise kit.' },
  { kind: 'gear', id: 'explorers-pack', name: "Explorer's Pack", weight: 59, description: 'Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 days rations, waterskin, 50 ft. hempen rope.' },
  { kind: 'gear', id: 'priests-pack', name: "Priest's Pack", weight: 24, description: 'Backpack, blanket, 10 candles, tinderbox, alms box, 2 blocks of incense, censer, vestments, 2 days rations, waterskin.' },
  { kind: 'gear', id: 'scholars-pack', name: "Scholar's Pack", weight: 10, description: 'Backpack, book of lore, ink, ink pen, 10 sheets of parchment, little bag of sand, small knife.' },
  { kind: 'gear', id: 'potion-healing', name: 'Potion of Healing', weight: 0.5, description: 'Regain 2d4 + 2 hit points.' },
]

// Homebrew items registered at runtime (ids namespaced `hb:<packId>:<slug>`).
const homebrew = new Map<string, Item>()

/** Replace the registered homebrew items. SRD ids always win over homebrew. */
export function registerHomebrewItems(items: Item[]): void {
  homebrew.clear()
  for (const item of items) homebrew.set(item.id, item)
}

export const itemById = (id: string): Item | undefined => ITEMS.find(i => i.id === id) ?? homebrew.get(id)

/** The item an inventory entry holds: its embedded item (library or custom) or the SRD one, under the player's name for it. */
export function entryItem(e: InventoryEntry): Item | undefined {
  const item = e.item ?? itemById(e.itemId)
  return item && e.name ? { ...item, name: e.name } : item
}

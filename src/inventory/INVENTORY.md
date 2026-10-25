# Inventory

The sheet's Inventory card: coins, carried weight, every item the character owns, and adding new ones.

## Files Covered

| File | Purpose |
|------|---------|
| `inventory.ts` | Pure helpers: `addItem` (plain items stack), `updateEntry` (one pact weapon at a time), `setQty`, `setEquipped`, `removeEntry`, `setCoins`, `fromLibrary`, `fromMagicItem`, `withBase` |
| `Inventory.tsx` | The card: coin inputs, item rows (equip, quantity, edit), the add panel and the item editor |
| `inventory.css` | Styles, scoped to the sheet's tokens |
| `inventory.test.ts` | Helpers, plus magic bonus, pact weapon and extra damage reaching `derive()` |

## How it works

- Items come from the content library (`src/content`) for the character's edition: equipment and magic items. An item the engine already has (e.g. `greatsword`) is saved by id; anything else is embedded in `entry.item`.
- Custom items (a prosthetic limb, a story trinket) are embedded gear the player names and describes.
- Magic weapons and armor need a base item: adding one opens the editor with a placeholder base and the item's rules text in notes.
- The editor can change anything: kind, weapon damage, type, properties, range, armor AC and DEX cap, magic bonus, extra damage, notes. Saving always embeds `entry.item`, so edits never touch the SRD data.
- Equipped weapons become attacks and equipped armor sets AC through `src/rules` (`entryItem`). Warlocks can mark one weapon as their pact weapon.
- Stat effects: adding a magic item copies its effects from `MAGIC_ITEM_STATS` (`src/rules/data/magicItemEffects.ts`) onto the entry: AC, saves, ability checks, spell attack and DC, speed, ability scores ("becomes 19" or "+2, max 20"), plus weapon and armor `magicBonus` and `extraDamage`. Every item, database or custom, can have its effects edited in the item editor.
- Effects work while the item is equipped. The app has no attunement, so magic items that need it in the rules work as soon as they are worn.
- Coins are `Character.coins` (gp, sp, cp).
- Every change goes through the sheet's `apply()`, so it can be undone and is logged.

# Quick-cast entries

The data and pure logic behind pinned spells (`Character.quickCast`). The old quick-cast bar is gone (2026-10-27): story mode's Spells card shows the pinned spells, and combat mode's attacks table rolls them.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `QuickCastEntry` (attack, spell, resource) and `SlotChoice` |
| `quickcast.ts` | Pure logic: add/remove/move entries, `slotChoices`, `spendSlot`, `spellDamage`, `spellBeams`, `resourceUse`, `spendResource` |
| `presets.ts` | A few SRD 5.1 spell entries, used as test fixtures |
| `quickcast.test.ts` | Tests for the pure logic |

## Behaviour

- Entries are saved on `Character.quickCast` (optional; old saves read as empty) in display order. Old attack and resource entries stay saved but nothing shows them.
- Pinning goes through `toggleSpellPin` / `toQuickCast` in `src/spellbook`, which fill attack or save, damage, upcast step and cantrip scaling from the library.
- The combat page uses `slotChoices`, `spendSlot` and `spellDamage` to cast: cantrips cost nothing and scale at levels 5, 11, 17, except Eldritch Blast, which gains beams instead (`spellBeams`; Scorching Ray gains rays per slot level, Magic Missile darts: 3 plus one per slot level above 1st, each 1d4+1 force with `roll: 'auto'`, no attack roll, from `AUTO_HIT`), each rolled as its own attack with Agonizing Blast (`cantripDamageBonus` in rules) and riders on every hit; leveled spells spend the lowest free slot, and with none left the spell still rolls.

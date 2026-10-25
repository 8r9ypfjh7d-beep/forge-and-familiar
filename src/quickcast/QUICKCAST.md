# Quick-cast bar

A strip at the top of the live sheet with the spells, attacks and resources a player uses every turn. One tap rolls and spends.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `QuickCastEntry` (attack, spell, resource) and `SlotChoice` |
| `quickcast.ts` | Pure logic: add/remove/move entries, `slotChoices`, `spendSlot`, `spellDamage`, `resourceUse`, `spendResource` |
| `presets.ts` | `spellPreset()` turns a rules `Spell` into pin fields; `SPELL_PRESETS` is every SRD spell |
| `QuickCastBar.tsx` | The bar, the slot picker, the result panel, the pin form and `SpellPicker` |
| `quickcast.css` | Styles, scoped inside `.ff-sheet` |
| `quickcast.test.ts` | Tests for the pure logic |

## Behaviour

- Entries are saved on `Character.quickCast` (optional; old saves read as empty) in display order.
- **Attack**: matches `derive().attacks` by name, rolls to hit and damage, doubles dice on a natural 20. Shows "Not equipped" if the weapon is gone.
- **Spell**: cantrips cost nothing and scale at levels 5, 11, 17 when `cantripScaling` is set. Levelled spells use the only valid slot directly, or offer a picker (1st, 2nd, Pact…) when several levels could cast it. `upcast` is added once per level above the base. Spell attacks use `derive().spellcasting.attackBonus`; save spells show the DC.
- **Resource**: spends one use of a class resource or a player tracker (`state.counters`).
- Slot and resource spending goes through the sheet's `apply`, so it appears in the session log and Undo reverts it. Rolls go to the shared dice history via `useDice().record`.

- **Pin form**: `SpellPicker` lists the character's class and subclass spells (`spellsFor`) grouped by level, with name search and a switch to show every class's spells (on by default for non-casters). Picking fills the form; every field stays editable for spells outside the SRD.

## Later

A spell entry could carry the spell id so a compendium can show its text.

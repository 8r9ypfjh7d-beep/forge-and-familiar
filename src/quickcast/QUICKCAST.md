# Quick-cast bar

A strip at the top of the live sheet with the spells, attacks and resources a player uses every turn. One tap rolls and spends.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `QuickCastEntry` (attack, spell, resource) and `SlotChoice` |
| `quickcast.ts` | Pure logic: add/remove/move entries, `slotChoices`, `spendSlot`, `spellDamage`, `resourceUse`, `spendResource` |
| `presets.ts` | A few SRD 5.1 spell entries, used as test fixtures |
| `picker.ts` | `pickableSpells` (the character's own lists, or every spell, with name search) and `byLevel` |
| `SpellPicker.tsx` | The pin form's spell chooser over the content library |
| `QuickCastBar.tsx` | The bar, the slot picker, the result panel and the pin form |
| `quickcast.css` | Styles, scoped inside `.ff-sheet` |
| `quickcast.test.ts`, `picker.test.ts` | Tests for the pure logic |

## Behaviour

- Entries are saved on `Character.quickCast` (optional; old saves read as empty) in display order.
- **Attack**: matches `derive().attacks` by name, rolls to hit and damage with `rollAttackWithDamage` (crit range from `getCritRange`, no damage on a natural 1). Shows "Not equipped" if the weapon is gone.
- **Spell**: cantrips cost nothing and scale at levels 5, 11, 17 when `cantripScaling` is set. Levelled spells use the only valid slot directly, or offer a picker (1st, 2nd, Pact…) when several levels could cast it. `upcast` is added once per level above the base. Spell attacks use `derive().spellcasting.attackBonus`; save spells show the DC. With no slot left the chip still works: it rolls and says no slot was spent. Each result line says what it is (To hit, with the AC it reaches; Damage and its type).
- **Pin form**: `SpellPicker` loads the library spells for the character's rules edition (`spellEdition`) and lists what their classes and subclasses can cast now (`spellAccess`/`canTake` from `src/spellbook`), grouped by level, with a name search and a switch to show every spell. Characters with no spell list see every spell. Picking fills the form through `toQuickCast`; every field stays editable for spells outside the SRD. Shows the source's CC-BY attribution.
- **Resource**: spends one use of a class resource or a player tracker (`state.counters`).
- Slot and resource spending goes through the sheet's `apply`, so it appears in the session log and Undo reverts it. Rolls go to the shared dice history via `useDice().record`.

## Later

When the spell compendium lands, a spell entry can carry a compendium id and fill its fields from there.

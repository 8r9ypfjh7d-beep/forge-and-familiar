# Spellbook

The Spells card on the live sheet. It lists the character's own spells by level, and every spell their class can take right now, pulled from the content library (`src/content`). Each character can use the 2014 rules (SRD 5.1) or the 2024 rules (SRD 5.2) for spell lists and counts.

## Files Covered

| File | Purpose |
|------|---------|
| `index.ts` | Public API |
| `access.ts` | Pure: `spellAccess` (per spellcasting class: highest spell level, cantrips, known or prepared, how many, always-prepared subclass spells), `canTake`, `availableSpells`, `editionOf`, `sourceFor` |
| `spellbook.ts` | Pure: `addSpell`, `removeSpell`, `spellsOf`, `pinnedSpells`, `toggleSpellPin`, `setEdition`, `toQuickCast` (library spell → quick-cast entry), `upcastStep`, `isPinned` |
| `Spellbook.tsx` | The card: summary (save DC, attack, cantrips and spells used of allowed), My spells, Add spells (search, level chips), spell details, source attribution |
| `spellbook.css` | Styles, scoped inside `.ff-sheet` |
| `spellbook.test.ts` | Access for both editions, multiclass, subclass spells, quick-cast mapping |

## Rules

- Numbers come from the edition's class table in the library: slots give the highest spell level, `cantripsKnown` the cantrips, `spellsKnown` (2014 bard, ranger, sorcerer, warlock) or `preparedSpells` (2024) the limit. 2014 prepared casters use ability modifier + class level (half for Paladin), at least 1.
- Warlocks also reach 6th–9th level at 11, 13, 15, 17 (Mystic Arcanum).
- A spell is available when it is on the class list or the subclass list, and of a level the class can cast. Subclass spells the class level has unlocked (Life Domain, Oath of Devotion, the Fiend, Circle of the Land) show as always prepared and don't count against the limit.
- Limits are shown, not enforced: going over turns the counter red.
- Multiclass characters get a chip per spellcasting class, each with its own list.

## Saved data

`Character.spells` (`{ id, classId }[]`) and `Character.spellEdition` (`'2014'` or `'2024'`; missing follows the character's `rulesEdition`). Ids are library slugs, shared by both editions, so switching edition keeps the choices; spells the new edition lacks (Hex is not in SRD 5.1) just don't show.

## Story spells

`SpellsCard` is the sheet's Spells card in both modes (beside the skills). It shows the spell slots (`sheet/components/SpellSlots.tsx`), then the pinned spells: the spell entries of `Character.quickCast`, so pinning in story mode, in the Spells card or on the quick-cast bar shows in both modes. "+ Pin spells" picks from every spell the character's classes can take (their own spells first). Pin buttons toggle (`toggleSpellPin`).

## Quick cast

"Pin" adds the spell to the quick-cast bar with its attack or save, damage or healing, upcast step and cantrip scaling filled in from the library (`toQuickCast`). Changes go through the sheet's `apply`, so they show in the session log and Undo reverts them.

## Licence

The card shows the source's CC-BY attribution under "Source". Keep it.

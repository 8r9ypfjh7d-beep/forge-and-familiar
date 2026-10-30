# Spellbook

Combat mode's Spells tab and story mode's Spells card. The tab shows the spell slots, then lists the character's own spells by level, and every spell their class can take right now, pulled from the content library (`src/content`): the edition's SRD plus the official book spells (`src/content/books`). Spell lists and counts follow the character's rules edition: 2014 (SRD 5.1) or 2024 (SRD 5.2). The edition is changed in Edit, not on the sheet, since it changes the whole character.

## Files Covered

| File | Purpose |
|------|---------|
| `index.ts` | Public API |
| `access.ts` | Pure: `spellAccess` (per spellcasting class: highest spell level, cantrips, known or prepared, how many, always-prepared subclass spells), `canTake`, `availableSpells`, `editionOf`, `sourceFor`, `spellSourcesFor` (SRD + books), `spellIdByName` (book and SRD names of the same spell) |
| `access.ts` | Pure: `spellAccess` (per spellcasting class: highest spell level, cantrips, known or prepared, how many, always-prepared subclass spells; classes the library has no table for, like the Artificer, use the engine's `bookSpellcasting` list as `listed`), `canTake`, `availableSpells`, `editionOf`, `sourceFor` |
| `extra.ts` | Pure: `grantedSpells` (race, lineage and trait-pick spells with the level they arrive, read from the race's `spell` effects via `raceProfile().spells`, so they match what the sheet casts; `raceSpells.test.ts` checks every race in both editions), `extraSources` (High Elf cantrip, spell feats such as Magic Initiate from the 2024 background, a Human's origin feat or an ASI), `canPickExtra`, `extraKey`, `extraList`, `keepValidSpells` |
| `spellbook.ts` | Pure: `addSpell`, `removeSpell`, `spellsOf`, `pinnedSpells`, `toggleSpellPin`, `toQuickCast` (library spell → quick-cast entry), `upcastStep`, `isPinned` |
| `Spellbook.tsx` | `Spellbook` (combat's Spells tab): spell slots, summary (save DC, attack, cantrips and spells used of allowed), My spells, Add spells (search, level chips), spell details, source attribution |
| `spellbook.css` | Liquid Glass styles for the card's insides (the card frame is the sheet's): `.glass-segmented` tabs, `.glass-chip` filters, `SearchField`, inset spell list on thin glass, tinted Add/Pin buttons |
| `cast.ts` | Pure: `castPlan` (rules `planCast` with the character's edition, spellcasting modifier and speed), `defaultSlot` (lowest free slot that fits), `castWarnings` (no slot left, or the concentration spell a cast would end), `castSpell` (spends the slot, starts the running effect, adds temp HP and healing) |
| `Cast.tsx` | `useCast` (one tap: rolls the spell's attack, save DC, damage or healing, 2024 smite damage, temp HP dice, then applies `castSpell` as one undoable step), `CastButton` (Cast, plus ▾ for a higher slot when there is a choice; asks once with Cast anyway when there is no slot or it ends concentration), `SlotPicker` (the ▾, also on Effects switches), `ConfirmCast`, `useCastWarning`, `itemSpellCaster` (race, feat and item spells), `CastResult` (fading result; healing spells offer Heal me; an AC-base spell like Mage Armor cast in body armor asks to take it off, via `wornArmor`, and doesn't fade until answered) |
| `cast.test.ts` | Casting Armor of Agathys, concentration, rests, smites, Aid |
| `spellbook.test.ts` | Access for both editions, multiclass, subclass spells, quick-cast mapping |

## Rules

- Numbers come from the edition's class table in the library: slots give the highest spell level, `cantripsKnown` the cantrips, `spellsKnown` (2014 bard, ranger, sorcerer, warlock) or `preparedSpells` (2024) the limit. 2014 prepared casters use ability modifier + class level (half for Paladin), at least 1.
- Warlocks also reach 6th–9th level at 11, 13, 15, 17 (Mystic Arcanum).
- A spell is available when it is on the class list or the subclass list, and of a level the class can cast. Subclass spells the class level has unlocked (Life Domain, Oath of Devotion, Circle of the Land, any 2024 patron) show as always prepared and don't count against the limit. A 2014 warlock patron's expanded spells (the Fiend) only join the list (`listed`) and are learned as normal spells known.
- Wizards also get `spellbook` (6 at 1st level, +2 per level); the summary counts their spells against it and shows the prepared number beside it.
- Bard Magical Secrets (`secrets`): 2014 bards may take 2 spells from any list at 10, 14 and 18 (College of Lore 2 more at 6), counted as spells known; 2024 bards add the cleric, druid and wizard lists at 10.
- Race spells and spells picked through feats or the High Elf trait show in story mode's pin picker.
- Limits are shown, not enforced: going over turns the counter red.
- Multiclass characters get a chip per spellcasting class, each with its own list.
- Subclass spells are matched by name with `spellIdByName`, which knows the SRD's renames ("Bigby's Hand" is Arcane Hand, 2014 Branding Smite is 2024 Shining Smite).

## Book spells

Spells from the official books show their book code (XGE, TCE…) as a tag. The details show our summary, in Hebrew when the app is in Hebrew, with a line naming the book. Their source note sits under the SRD's.

## Saved data

`Character.spells` (`{ id, classId }[]`) and `Character.spellEdition` (`'2014'` or `'2024'`; missing follows the character's `rulesEdition`). Ids are library slugs, shared by both editions, so switching edition keeps the choices; spells the new edition lacks just don't show.

## Story spells

`SpellsCard` (also in `Spellbook.tsx`) is story mode's Spells card, above the skills. It shows the spell slots (`sheet/components/SpellSlots.tsx`), then the pinned spells: the spell entries of `Character.quickCast`. Combat mode has no Spells card; its Spells tab pins with the same list, and pinned attack or save spells show in the Combat tab's attacks table. "+ Pin spells" picks from every spell the character's classes can take (their own spells first). Pin buttons toggle (`toggleSpellPin`). With nothing pinned the card lists the character's own class spells (chosen, always prepared and feat picks; race spells stay under "From your items") with Cast, so a new character can cast in story mode. Unpin ✕ shows only while "+ Pin spells" is open, and combat's My spells hides forget ✕ behind Edit list, so a mistap next to Cast can't drop a spell.

## Quick cast

"Pin" adds the spell to `Character.quickCast` with its attack or save, damage or healing, upcast step and cantrip scaling filled in from the library (`toQuickCast`). Changes go through the sheet's `apply`, so they show in the session log and Undo reverts them.

## Licence

The card shows the SRD's CC-BY attribution and the book spells' note under "Source". Keep both.

## Casting

Every spell row in My spells (combat's Spells tab) and every pinned spell (story's Spells card) has **Cast**. One tap spends the lowest free slot (pact slots included), rolls whatever the spell rolls, gives its temporary HP (Armor of Agathys: 5 per slot level) or healing, and starts its running effect, which then shows under Effects with concentration and duration (`src/rules/usables.ts`). A new concentration spell ends the old one; Cast first says "This ends Hold Person" with Cast anyway. With no slot left it asks the same way and still casts (warn, don't block). Spells whose dice ride on each hit (Hex, Hunter's Mark, Divine Favor: an effect with `damage`) roll nothing when cast.

The Effects switch of a known spell that isn't running is the same Cast: it shows the slot it will take (a level 5 warlock's Armor of Agathys reads 3rd pact, 15 cold), ▾ picks another, and switching it on spends the slot, rolls, gives the temp HP and starts the effect. Switching a running effect off asks first, then ends it; its On me chip says whether it counts for this character's rolls (off: cast on an ally). Range-Self spells (Armor of Agathys, Shield) carry `self` and have no chip. Instantaneous spells (2024 False Life, Cure Wounds) never become running effects; their temp HP or healing just apply. End of fight (under the switches, when something short is running) ends round and up-to-a-minute effects (`endFight` in sheet/effects.ts); rests end the longer ones. Spells that are running show an Active tag.
Spells listed under From your race, feats and items (an item's spell effect, a race's innate spells) have Cast too, and the Resources card's Use on the same spell is that Cast: no slot, at the level the line names ("as 2nd level"). A limited one ("once per long rest", "3/day") spends its own use, shown as left/max beside it and in the Resources card, and comes back on its rest; one that costs charges spends its item's charges.

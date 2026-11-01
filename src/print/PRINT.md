# Printable sheet

Paper-style character sheet for tables that play without phones. "Print or save as PDF" opens the browser print dialog; choosing "Save as PDF" gives a file. No PDF library: the browser renders it, so text stays selectable, Hebrew shapes correctly and fonts stay sharp.

## Files Covered

| File | Purpose |
|------|---------|
| `sheetData.ts` | `buildPrintSheet(character, { withPlayState }, derived?)`: flattens the character and `derive()` into ids and numbers (no display text). Pure |
| `spells.ts` | `printSpells(character, library)`: each casting class's spells (always-prepared and wizard prepared marks) with its own save DC and attack, spells picked through feats, and race and item spells; `all` lists each library spell once for the rules pages. `hasSpellPage`. Pure |
| `PrintSheet.tsx` | `PrintSheet({ characterId, onBack })` view: toolbar (play state, rules text, print) over `PrintPages`. `PrintPages({ character, withPlayState, withRules })` renders the pages; the share view uses it too |
| `print.css` | Paper styles (dark ink on white in both themes), logical properties for Hebrew, and `@media print` rules that hide the app chrome and break pages |
| `print.test.ts` | Tests for `buildPrintSheet` and `printSpells` |

## Pages

1. Core: name, class, race or species, background, alignment, player, XP; abilities, saves and skills (expertise is a ringed dot); Inspiration box (filled with play state); AC, initiative, speed, HP, hit dice, death saves; attacks plus attack and save spells (`spellAttackRows`); conditions, defenses; feature, trait and feat names; languages and tools.
2. Gear and notes: equipment with weight and worn marks, carried weight, coins, class resources and trackers with their rest, the DM's charms (use circles) and blessings, notes.
3. Spells, only when the character has a casting class, slots, or spells from race, feats or items: spellcasting box per class, slots (pact slots apart), spell tables by level with prepared dots, C/R tags, time, range, duration, components, and blank rows to pencil in new spells.
4. Rules reference (the "rules text" checkbox, on by default): every feature, trait, feat and spell with its text in two columns, running over as many sheets as it needs. The SRD attribution prints at the end.

## Notes

- Opened from the Print button on each character card and in the sheet header (`App.tsx`, view `print`; Back returns to where it was opened).
- All text goes through `useI18n()` (`print.*` keys). In Hebrew, feature text is our Hebrew summary, spell names are Hebrew with the English name under them, and book spells use their Hebrew summary; SRD spell text stays English. Signed numbers and dice are `dir="ltr"`.
- Play state is off by default, so HP, slots, death saves and conditions print empty for pencil play. The checkbox fills them from `character.state`.
- The page title is set to "<name> - character sheet" while the view is open, which browsers use as the default PDF file name.
- Fits US Letter and A4. Spells and rules pages have no fixed height and drop the footer in print, so a page that runs on never leaves a lone footer on an extra sheet.

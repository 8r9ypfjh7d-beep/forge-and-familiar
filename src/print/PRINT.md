# Printable sheet

Two-page, paper-style character sheet. "Print or save as PDF" opens the browser print dialog; choosing "Save as PDF" gives a file. No PDF library: the browser renders it, so the text stays selectable and fonts stay sharp.

## Files Covered

| File | Purpose |
|------|---------|
| `sheetData.ts` | `buildPrintSheet(character, { withPlayState })`: flattens the character and `derive()` into display strings. Pure. |
| `PrintSheet.tsx` | `PrintSheet({ characterId, onBack })` view: toolbar plus page 1 (stats, skills, HP, attacks, features) and page 2 (spellcasting, slots, resources, equipment, coins, notes) |
| `print.css` | Paper styles (black on white in both themes) and `@media print` rules that hide the app chrome and break pages |
| `print.test.ts` | Tests for `buildPrintSheet` |

## Notes

- Opened from the "Print" button on each character card (`App.tsx`, view `print`).
- Play state is off by default, so HP, slots, conditions and exhaustion print as empty boxes for pencil play. The checkbox fills them from `character.state`.
- The page title is set to "<name> - character sheet" while the view is open, which browsers use as the default PDF file name.
- Fits US Letter and A4. Spell lists are blank lines until a spell compendium exists.

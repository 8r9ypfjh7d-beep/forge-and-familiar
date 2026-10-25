# Themes

Per-character visual themes: parchment for the paladin, shadow for the rogue.

## Files Covered

| File | Purpose |
|------|---------|
| `themes.ts` | `THEMES` presets, `themeById`, `suggestedThemeId(classId)`, `themeVars`, `contrast` |
| `useCharacterTheme.ts` | Hook that paints the page in a theme while a screen is mounted |
| `ThemePicker.tsx` | "Theme" button with swatches; the class's suggested theme is listed first |
| `themes.css` | Picker styles, scoped to `.ff-theme-picker` |
| `themes.test.ts` | Ids, class suggestions, and contrast checks for every theme |

## How it works

- Saved as `Character.theme` (an id). Missing or unknown means the app default, which follows light/dark. Import and export carry it with the character.
- A theme is a set of the app tokens from `index.css` (`--bg`, `--panel`, `--ink`, `--accent`...) plus `--temp` for the sheet and the dice tray's `--ff-*` tokens. Screens need no theme-specific CSS as long as they use those tokens.
- The live sheet calls `useCharacterTheme(character.theme)`, which sets the tokens inline on `<html>` and removes them on leaving, so the list, builder and party screens keep the app look. Character cards show the theme accent as a left stripe.
- Picking a theme goes through the sheet's `apply`, so it shows in "This session" and can be undone.
- Every theme must pass the contrast tests: ink ≥ 7:1, muted ≥ 4.5:1, white on accent/good/bad ≥ 4.5:1, accent/good/bad/temp ≥ 3:1 on panels.

## Adding a theme

Add an entry to `THEMES`, optionally map classes to it in `SUGGESTED`, and run the tests.

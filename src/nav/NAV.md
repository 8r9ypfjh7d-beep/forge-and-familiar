# Top bar (src/nav)

The app's navigation. No brand header: the first tab, Characters, is home.

| File | What |
|------|------|
| `items.ts` | Pure: `navItems({ isDm, dmAccount })` splits screens into tabs and the More menu; `navKeyFor(view.kind)` picks the lit tab (character screens light Characters) |
| `AppNav.tsx` | The bar: tabs, More menu, player menu (children from App, language, accessibility). DM tab shows a badge with waiting requests |
| `icons.tsx` | Line icons per tab |
| `nav.css` | Wide: one row at the top. At 640px and below: fixed bottom bar with short labels; lifts the dice button and PWA banner above it |

Adding a screen: add its view kind to `NavKey` and `ITEM` in `items.ts`, put it in `main` (used every session) or `more` (reference, bookkeeping), add an icon path, and the label key in both locales. Removing one: drop it from the same places.

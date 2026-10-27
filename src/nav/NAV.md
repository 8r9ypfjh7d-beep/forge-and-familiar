# Top bar (src/nav)

The app's navigation. No brand header: the first tab, Characters, is home.

| File | What |
|------|------|
| `items.ts` | Pure: `navItems({ isDm, dmAccount, admin })` splits screens into tabs and the More menu; `canOpen(view.kind, ctx)` guards the DM pages (DM screen, Combat) and Admin so App bounces a blocked view home; `navKeyFor(view.kind)` picks the lit tab (character screens light Characters) |
| `AppNav.tsx` | The bar: tabs, More menu, player menu (children from App, language, accessibility). DM tab shows a badge with waiting requests |
| `icons.tsx` | Line icons per tab |
| `nav.css` | Wide: one row at the top. At 640px and below: fixed bottom bar with short labels; lifts the dice button and PWA banner above it |

Adding a screen: add its view kind to `NavKey` and `ITEM` in `items.ts`, put it in `main` (used every session) or `more` (reference, bookkeeping), add an icon path, and the label key in both locales. Removing one: drop it from the same places.

Who sees what: players get Characters, Party, Ask the DM. The DM account gets only DM screen, Combat and Party. The admin account (Ziv) gets a player's tabs plus Admin first under More; the admin page has buttons to open the DM screen and the combat tracker (`canOpen` lets the admin in). Rules and Homebrew sit under More for everyone. Leading a party does not make a player a DM. Roles follow the open profile: the admin opened as a player (switcher or Admin → Open as) sees exactly that player's tabs; switching back to their own profile restores everything.

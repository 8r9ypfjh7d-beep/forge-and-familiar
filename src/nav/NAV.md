# Top bar (src/nav)

The app's navigation. No brand header: the first tab, Characters, is home.

| File | What |
|------|------|
| `items.ts` | Pure: `navItems({ isDm, partyDm, admin })` splits screens into tabs and the More menu; `canOpen(view.kind, ctx)` guards the DM pages (DM screen, Combat) and Admin so App bounces a blocked view home; `navKeyFor(view.kind)` picks the lit tab (character screens light Characters) |
| `AppNav.tsx` | The bar: tabs, More menu, player menu (children from App, language, accessibility). DM tab shows a badge with waiting requests |
| `icons.tsx` | Line icons per tab |
| `nav.css` | Reference example of the Liquid Glass standard (`src/design/DESIGN.md`). Wide: floating glass bar, sticky at the top, frostier as content scrolls under (`--glass-top`). At 640px and below: floating glass tab bar with short labels, frostier while content is below (`--glass-bottom`); lifts the dice button and PWA banner above it. Menus are `.glass-sheet` |

Adding a screen: add its view kind to `NavKey` and `ITEM` in `items.ts`, put it in `main` (used every session) or `more` (reference, bookkeeping), add an icon path, and the label key in both locales. Removing one: drop it from the same places.

Who sees what: the DM role comes from the party in play (picked on entering the app, `src/party/active.ts`), not the account. Players get Characters, Party, Ask the DM. The DM of the party in play gets only DM screen, Combat and Party. The admin account (Ziv) also gets Admin first under More; the admin page has buttons to open the DM screen and the combat tracker (`canOpen` lets the admin in). Rules and Homebrew sit under More for everyone. Roles follow the open profile: the admin opened as a player (switcher or Admin → Open as) sees exactly that player's tabs; switching back to their own profile restores everything.

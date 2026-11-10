# PWA

Makes Forge & Familiar installable and usable offline. No extra dependencies.

## Files Covered

| File | Purpose |
|------|---------|
| `register.ts` | Registers `sw.js` (production only), tracks "update waiting" and the install prompt, asks the worker to `WARM` 3 s after load |
| `chunks.ts` | `recoverFromStaleChunks()`: reloads once (at most once a minute) when a lazy chunk from an older build is gone |
| `PwaPrompt.tsx` | `PwaPrompt`: bottom strip for the offline notice and "new version ready, Reload". `InstallCard`: install offer as a card on Home once the player has a character ("Not now" hides it for good). `InstallMenuItem`: "Install app" row in the player menu. Install is never offered on the sign-in screen (Chromium only) |
| `pwa.css` | Styles scoped to `.ff-pwa` |
| `../../pwa/sw.js` | Service worker template: shell + first-screen chunks on install, the rest on `WARM`, cache-first, SPA navigations get `index.html` |
| `../../pwa/vite-plugin.ts` | After `vite build`, lists `dist/`, splits it into SHELL / CORE / LAZY (`startupFiles()` follows static imports from `index.html`), fills the template, writes `dist/sw.js` |
| `../../pwa/pwa.test.ts` | Precache list and version hash tests |
| `../../public/manifest.webmanifest`, `../../public/icons/` | Manifest and d20 icons (SVG sources, PNGs rendered from them) |

## How it behaves

- Code splitting: every screen except Home, the character list and campaigns is a `React.lazy` chunk (`screen()` in `App.tsx`), and Hebrew is its own chunk (see `src/i18n/I18N.md`). Keep big screens out of barrels that eager code imports, or the split undoes itself (watch for `INEFFECTIVE_DYNAMIC_IMPORT` in the build output).
- Install caches only the shell (`ff-<version>`) and the first screen's chunks (CORE, ~0.5 MB gzip). Once the app has rendered, the page posts `WARM` and the worker fetches every other chunk (LAZY: screens, spells, monsters, Hebrew) four at a time, so every screen works with no signal. A chunk opened before that is cached on first use.
- Hashed chunks live in `ff-assets`, which survives deploys: an update downloads only chunks whose hash changed, and activation prunes chunks no build references.
- A deploy changes the worker's version hash. The new worker waits; the strip offers Reload, which activates it and reloads.
- Character data is already in localStorage, so the sheet, builder and dice work fully offline.
- Dev server (`npm run dev`) has no service worker. Test with `npm run build && npm run preview`.
- iOS has no install prompt: players use Share, then Add to Home Screen.

## Gotchas

- Cache lookups use `ignoreVary`; hosts send `Vary: Origin` and module scripts add an Origin header.
- Files under `public/` are precached too. Keep large media out of `public/` or add it to `SKIP` in the plugin.

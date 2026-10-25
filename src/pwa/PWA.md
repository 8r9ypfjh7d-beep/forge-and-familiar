# PWA

Makes Forge & Familiar installable and usable offline. No extra dependencies.

## Files Covered

| File | Purpose |
|------|---------|
| `register.ts` | Registers `sw.js` (production only), tracks "update waiting" and the install prompt |
| `PwaPrompt.tsx` | Bottom strip: offline notice, "new version ready, Reload", "Install" (Chromium only) |
| `pwa.css` | Styles scoped to `.ff-pwa` |
| `../../pwa/sw.js` | Service worker template: precache app shell, cache-first, SPA navigations get `index.html` |
| `../../pwa/vite-plugin.ts` | After `vite build`, lists `dist/`, fills the template, writes `dist/sw.js` |
| `../../pwa/pwa.test.ts` | Precache list and version hash tests |
| `../../public/manifest.webmanifest`, `../../public/icons/` | Manifest and d20 icons (SVG sources, PNGs rendered from them) |

## How it behaves

- First visit caches every built file. Later visits, online or not, load from cache.
- A deploy changes the worker's version hash. The new worker waits; the strip offers Reload, which activates it and reloads.
- Character data is already in localStorage, so the sheet, builder and dice work fully offline.
- Dev server (`npm run dev`) has no service worker. Test with `npm run build && npm run preview`.
- iOS has no install prompt: players use Share, then Add to Home Screen.

## Gotchas

- Cache lookups use `ignoreVary`; hosts send `Vary: Origin` and module scripts add an Origin header.
- Files under `public/` are precached too. Keep large media out of `public/` or add it to `SKIP` in the plugin.

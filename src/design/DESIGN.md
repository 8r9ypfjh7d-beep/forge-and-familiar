# Design standard: Liquid Glass

The app's visual language, modelled on Apple's Liquid Glass (iOS 26): content first, controls float above it on translucent glass that refracts the colour behind, and the chrome gets more or less opaque depending on what is under it. Every screen follows this file. The app shell (`src/nav`) is the reference implementation; copy its patterns.

## Files Covered

| File | Purpose |
|------|---------|
| `glass.css` | Tokens (type, radius, spacing, motion, glass), the ambient background, glass utility classes, and all solid fallbacks |
| `scrollGlass.ts` | Dynamic opacity: `edgeLevel`, `scrollLevels`, `installScrollGlass` write `--glass-top` / `--glass-bottom` (0..1) on `<html>` |
| `index.ts` | Loads `glass.css` and installs the scroll listener once (imported from `main.tsx`) |
| `design.test.ts` | Opacity maths, fallbacks present; for every CSS file in `src`: logical properties, blur only from tokens, no hex colours outside the palette files, selected segments use `--glass-raised` |

## Principles

1. **Content is the hero.** Glass is for things that float: bars, menus, sheets, the dice window, toasts, overlays. Page content (cards, lists) uses content glass sparingly, never glass on glass on glass.
2. **Hierarchy through depth, not borders.** Lift with blur, a soft shadow and a 1px light edge (`--glass-highlight`), not heavy outlines.
3. **Rounded and concentric.** Inner radius = outer radius minus the padding between them. Controls are capsules.
4. **One prominent action per surface.** Tinted glass (`.glass-btn.prominent`) for it; plain glass for the rest.
5. **Readable first.** Text on glass must keep 4.5:1 against the thickest backdrop it can sit on. If in doubt, use a thicker material.

## Tokens (in `glass.css`)

Keep using the colour tokens from `src/index.css` (`--bg`, `--panel`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-ink`, `--accent-soft`, `--good`, `--bad`, plus `--warn` for amber states such as "later", "maybe", offline and hurt, `--temp` for temporary HP, and `--on-fill` for text on a `--good`/`--bad` fill): high contrast and the DM/party palettes override those. Glass adds:

| Group | Tokens | Use |
|------|--------|-----|
| Type | `--font-text`, `--font-display`, `--font-lore` | SF Pro on Apple devices, system UI elsewhere, Noto for Hebrew. `--font-lore` (New York / Georgia) only for flavour: character names, quotes, handouts |
| Radius | `--r-xs` 8, `--r-sm` 12, `--r-md` 18, `--r-lg` 24, `--r-xl` 30, `--r-pill` | Cards `--r-lg`, inner tiles `--r-md`/`--r-sm`, buttons and chips `--r-pill` |
| Spacing | `--sp-1`..`--sp-8` (4px grid) | Card padding `--sp-4`, gaps `--sp-2`/`--sp-3`, section gaps `--sp-5` |
| Motion | `--ease-glass`, `--ease-spring`, `--dur-fast` .15s, `--dur-med` .28s, `--dur-slow` .45s | Springy press (`scale(.96)`), sheets grow from their button |
| Materials | `--glass-thin`, `--glass-regular`, `--glass-thick` | Thin: hover fills, segmented tracks. Regular: content cards, buttons. Thick: menus, dialogs, anything with lots of text |
| Edges | `--glass-stroke`, `--glass-hairline`, `--glass-highlight` | Stroke: outer 1px light edge. Hairline: separators inside glass. Highlight: inset specular line, add to every glass `box-shadow` |
| Depth | `--glass-shadow`, `--glass-shadow-lift` | Resting vs floating (menus, tab bar on phones, dialogs) |
| Controls | `--glass-inset`, `--glass-control-shadow`, `--glass-raised`, `--glass-tint-highlight` | Sunken track (segmented, bars), resting button, the selected option in a track, the specular line on a tinted fill. `--glass-raised` becomes a 2px accent ring when glass turns solid, so every "thick on thin" selection stays visible in Reduce transparency and high contrast without per-screen rules |
| Blur | `--glass-blur`, `--glass-blur-strong` | Content vs chrome. Never hard-code a `backdrop-filter`; use these so fallbacks work |
| Tint | `--glass-tint` | Accent-tinted glass: the selected "lens" |
| Wash | `--glass-wash-1..3` | The ambient colour behind the app (`body::before`). Don't paint opaque page backgrounds over it |
| Scrim | `--glass-scrim`, `--glass-scrim-blur` | Dim and soft blur behind a modal dialog or overlay (hand-out viewer); the blur turns off with the other fallbacks |
| Lore paper | `--lore-paper-1`, `--lore-paper-2`, `--lore-ink`, `--lore-shade` | Parchment for hand-outs and notes; stays light in dark mode, like a page |
| Opacity | `--glass-top`, `--glass-bottom`, `--glass-edge` | See dynamic opacity |

Type scale: large title 1.75rem/700, title 1.4rem/700, headline 1.1rem/600, body 1rem/400, callout .9rem, footnote .8rem, caption .7rem. Headings use `--font-display` with `letter-spacing: -0.015em`; small-caps eyebrow labels (`.glass-eyebrow`) replace UPPERCASE letter-spaced labels on new work. Numbers in stats use `font-variant-numeric: tabular-nums`.

## Utilities

| Class | What |
|------|------|
| `.glass` (+ `.thin` / `.thick`) | Content glass card |
| `.glass-chrome` (+ `.at-top` / `.at-bottom`) | Floating bar with dynamic opacity. Blur lives on `::before` so menus inside the bar can still blur the page; the bar must be positioned |
| `.glass-sheet` | Menus, popovers, dialogs |
| `.glass-dialog` | Add to a `<dialog>` with `.glass-sheet`: centred size, `--r-xl` corners, scrim, entrance. Used by the accessibility dialog and the DM request / ask-to-edit pop-ups |
| `.glass-btn` (+ `.prominent`, `.small`, `.icon`) | Capsule buttons; prominent = the one tinted action |
| `.glass-lens` | Selected-item highlight (tabs, lists, segmented) |
| `.glass-segmented` | Segmented control; mark the selected button with `aria-pressed`/`aria-checked="true"` or `.on` |
| `.glass-chip` (+ `.on`) | Filter chips |
| `.glass-field` | Text inputs and selects |
| `.glass-list` | Inset grouped list with hairline separators |
| `.glass-title`, `.glass-eyebrow` | Display title, small label |

The shared primitives in `index.css` are on the standard too: `.panel` is content glass (fill, edge and shadow, but no `backdrop-filter`, so fixed pop-ups and menus inside a panel still work), `.btn` is a capsule (`.primary` = prominent, `.ghost` = no fill), `.chip` is a glass chip (`.on` = tint), and inputs, selects and textareas match `.glass-field`. Screens that only use these primitives already look right. Screens with their own classes (the sheet's `.ff-sheet .btn` and `.card`, for example) restyle those with these tokens in their own thread.

## Dynamic opacity

`scrollGlass.ts` sets two numbers on `<html>`, updated once per animation frame:

- `--glass-top`: 0 at the top of the page, 1 once 48px of content has scrolled under the top edge.
- `--glass-bottom`: 0 when the page is scrolled to its end (nothing under a bottom bar), 1 when 48px or more is still below.

`.glass-chrome` mixes from `--glass-thin` (clear) to `--glass-thick` (frosted) by `--glass-edge`; `.at-top`/`.at-bottom` or a component rule (as in `nav.css`) points `--glass-edge` at the right edge. Bars become clearer when nothing is behind them and frostier as content slides under, like iOS scroll-edge appearance. A scroll container other than the page can set its own `--glass-edge` the same way with `edgeLevel()`.

## Accessibility fallbacks (required)

All glass reads tokens, so one block swaps every surface to solid `--panel` with `--line` edges and no blur, keeping the same shapes and layout:

- **Reduce transparency**: the accessibility panel switch (`data-transparency="reduce"`) or the OS `prefers-reduced-transparency`.
- **High contrast** (`data-contrast="high"`): solid, no shadows, tint becomes `--accent-soft`; components add 2px edges where state is shown only by fill.
- **No `backdrop-filter` support**: fills become solid.
- **Reduce motion**: the global rule in `a11y.css` stops transitions; don't add motion that carries meaning on its own.
- **Print**: no wash, no glass.

Never set text colour from the backdrop; text uses `--ink`/`--muted`/`--accent` on a material thick enough for 4.5:1. Touch targets stay at least 44px tall on phones (tab bar items are 54px).

## Layout and RTL

- Logical properties only (`inset-inline-start`, `margin-block`, `padding-inline`). `design.test.ts` checks `glass.css`; do the same in screen CSS.
- Phones (≤640px): floating tab bar 10px from the sides, at most 68px tall, lifted off the home indicator. Page bottom padding 104px. The dice button stays at `76px + safe-area` above the bottom, the PWA banner too. Menus open as sheets 80px above the bottom.
- Wide screens: the bar floats sticky 8px from the top, content width up to 1200px.

## Do / don't

- Do use `--glass-thick` for anything with paragraphs; `--glass-regular` for short labels and numbers.
- Do keep the roll result card's current look (players like it); only move it onto the glass tokens.
- Don't stack more than two glass layers; don't put `backdrop-filter` on an element whose children need their own glass (use the `::before` pattern from `.glass-chrome`).
- Don't hard-code `#fff` or rgba surfaces in screen CSS; add a token here if one is missing. `design.test.ts` fails on hex colours outside `index.css`, `a11y.css`, `glass.css`, `print.css` (paper) and `crit.css` (effects).
- Do mark a selected segment with `box-shadow: var(--glass-raised)` (custom segmented controls too, like `.mode-btn`); don't add per-screen high contrast or Reduce transparency rings for it.

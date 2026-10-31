# Codex (campaign lore)

The campaign's lore book. The DM writes chapters of typed entries in advance (letters, places, people, rumors, maps...) and reveals each piece when the party discovers it. Players read what they have found by chapter or as a "Story so far" timeline. Shown on the campaign page and as the Codex tab of the DM screen. It grew out of Hand-outs; old hand-outs are entries of the same kinds, so nothing was migrated.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `LoreEntry` (alias `Handout`), `LoreChapter`, `EntryType`, `META_FIELDS` per type, `PICTURE_TYPES` |
| `logic.ts` | Pure rules: `canSee`, `visibleHandouts`, unread and receipts, `send`/`unsend` (reveal / take back), `setBlockRevealed`, `closedBlocks`, `chaptersFor`, `teaserCounts`, `moveEntry`, `tonightQueue`/`toggleTonight`, `timeline`, `resolveLink`, `searchEntries`, `newArrivals`, `problems`, `tableLink` |
| `markup.ts` | Pure entry text parser: paragraphs, `#` headings, `-` lists, `>` quotes, `---`, `**bold**`, `*italic*`, `[[Entry title]]` links, `||hidden||` runs and blocks; `readableText` for previews and search |
| `importDoc.ts` | Pure: `splitDocument` turns a pasted document into chapters (`#`) and entries (`##`); `typedTitle` reads "Letter: ..." prefixes (EN + HE) |
| `image.ts` | Downscales uploads to JPEG data URLs (pictures 1280px, maps 2048px) |
| `store.ts` | Async store: entries (`ff.handouts.v1`), chapters (`ff.lore.chapters.v1`), pins (`ff.lore.pins.v1`, per player per device); cloud parties go through `cloud.ts`; `HandoutSpaceError` |
| `cloud.ts` | Supabase rows (`handouts`, `handout_seen`, `lore_chapters`), picture upload to the `lore` bucket, `watchHandouts` |
| `Codex.tsx` | `Codex` section (DM actions, Tonight strip, chapters, cards, composer, viewer, paste-a-document), `HandoutBadge`, `requestOpenEntry` |
| `EntryView.tsx` | How an entry reads by type (parchment letter with seal, ruled journal, centred prophecy, two-column book, poster, rumor bubble, cards for places/people), redacted hidden parts with the DM's reveal toggles, zoomable map |
| `RevealMoment.tsx` | Full-screen "You discovered" card when the DM reveals something while a player is in the app; mounted in App for the campaign in play |
| `useNames.ts` | Player names for the Codex on the DM screen |
| `lore.css` | Styles scoped to `.ff-handouts`/`.ff-lore`, `.ff-handout-viewer`, `.ff-lore-reveal` |
| `lore.test.ts` | Visibility, receipts, markup, hidden parts, chapters, Tonight, timeline, links, search, import tests |

## How it works

- **Only the party's DM writes** (`party.dmId`): create, edit, reveal, take back, reorder, delete. A new DM inherits the Codex. Players read, search and pin.
- **Drafts and reveals.** An unrevealed entry is a draft only the DM sees. Reveal sends it to everyone (`to: 'all'`, later joiners included) or chosen players. "Take back" makes it a draft again and clears read receipts.
- **Hidden parts.** `||text||` inside a line hides a word or name; a `||` block on its own lines hides a paragraph. Players see a redacted bar until the DM taps the eye (or "Reveal this part") in the viewer. Revealed indexes live in `revealed`. Search and previews never include closed parts.
- **Chapters.** Ordered groups. Players see a chapter only when something in it is revealed or teased. A teaser draft shows as "? N more to find"; the DM's device keeps each chapter's `teasers` count, since players can't read drafts.
- **Tonight.** The DM stars drafts for the session; the Tonight strip lists them in order with a Reveal button each. Revealing drops the star.
- **Links.** `[[Title]]` opens that entry only when the reader can see it; otherwise it reads as plain text, so nothing leaks.
- **Reveal moment.** Entries revealed while the player is in the app (`newArrivals`) pop a card; "Open it" goes to the campaign page and opens the entry. Reduce motion shows it still.
- **Paste a document.** Headings become chapters and entries, all as drafts.

## Across devices

For a cloud party (`cloudForParty` in src/party/store.ts) entries and chapters live in Supabase and reach players live. The server applies the same rule as `canSee` (`20261028090000_party_shared.sql`); chapters are readable by members and written by the DM (`20261030220000_lore.sql`). Pictures go to the public `lore` Storage bucket under `<partyId>/` with a random file name; only that party's DM uploads or deletes. If the upload fails (bucket missing, offline) the entry keeps the data URL as before. Local parties keep everything on the device.

## Known tasks

- **Add an entry type:** add it to `EntryType`, `ENTRY_TYPES`, `META_FIELDS` (and `PICTURE_TYPES` if it has a picture), keys `lore.type.<t>` and `lore.example.<t>` in both locales, a `TYPE_WORDS` word in `importDoc.ts`, and a `.lore-body.<t>` look in `lore.css`.
- **Add a meta line:** add it to `MetaField`, the types that use it, and `lore.meta.<f>` in both locales.

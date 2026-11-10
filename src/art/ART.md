# Character art

Portrait, battle map token art and a gallery of up to 24 pictures per character, on the sheet's **Art** card
(story mode: last card of the main column; combat mode: Notes tab). Read-only sheets (the DM, watchers) show the
pictures and the viewer without buttons.

## Files Covered

| File | Purpose |
|------|---------|
| `logic.ts` | Pure: sizes, `tokenArt` (token else portrait), `sharedTokenArt` (links only), gallery add/remove/caption, `droppedArt`, `artPath`, `squareCrop`, `framedSquare`/`dragFraming` (positioning) |
| `image.ts` | `shrinkArt(file, kind, maxSide)`: JPEG data URL; token art is cut to a centred square |
| `cloud.ts` | `storeArt(file, kind, characterId)`: uploads to the `art` bucket or falls back to a data URL; `removeArt(urls)` |
| `Position.tsx` | `PositionDialog`: a new portrait or token is dragged (and zoomed) under a square or round frame and saved as that square; "Keep whole picture" saves it as picked |
| `Gallery.tsx` | `ArtCard` and its picture viewer (caption, use as portrait, use as map token, remove) |
| `art.css` | Card and viewer styles |
| `art.test.ts` | Logic, token art on the board, share links and snapshots |

## Storage

Saved on the character: `portrait`, `token`, `gallery: { id, url, caption? }[]` (see `src/model/MODEL.md`).
With a cloud account and a connection, a picture is shrunk (portrait 640 px, token 256 px, gallery 1600 px) and
uploaded to the public `art` bucket at `<account id>/<character id>/<uuid>.jpg`; the character keeps only the link.
Otherwise it stays a smaller data URL (400 / 160 / 800 px) and the card says so. Migration:
`supabase/migrations/20261102110000_character_art.sql` (owner-only insert, list and delete; reads by public link).
When a change leaves a link unused (not the portrait, token or any gallery picture), its file is removed, best effort.

Undo logs, snapshots and rollbacks never carry or restore art. Share links keep a small portrait or token and only
linked gallery pictures.

## Where art shows

- Sheet: the character card portrait, the Art card.
- DM screen: portraits beside the party's sheets list (`src/dm/DmScreen.tsx`).
- Battle map: `TokenInfo.image` (the DM sees any art, a player sees their own) and `Token.art` (a link the DM's
  `EncounterMap` writes onto party tokens with `withTokenArt`, so every player's map shows it). Monsters and NPCs keep labels.

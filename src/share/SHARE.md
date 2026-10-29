# Read-only share links

"Share" on a character card copies (or, on phones, shares) a link that shows the character's sheet to anyone, with no account and nothing saved on their device.

## Files Covered

| File | Purpose |
|------|---------|
| `link.ts` | `forShare()` (what the link carries), `encodeCharacter()` / `decodeCharacter()`, `shareCodeFrom(hash)`, `shareLink()` |
| `ShareButton.tsx` | The card tool: Web Share on phones, else copy to clipboard, else a prompt with the link |
| `ShareView.tsx` | The page a link opens: glass bar (read-only label, play-state toggle, print, open the app) over the paper sheet from `src/print` (`PrintPages`) |
| `share.css` | Share page layout |
| `share.test.ts` | Round trip, privacy, broken links |

## Notes

- Link: `<site>/#ff-character=<code>`. The code is the character as deflate-raw JSON in base64url (`z…`), or plain JSON (`j…`) where `CompressionStream` is missing. It lives in the hash, so it never reaches the server and needs no backend.
- `main.tsx` renders `ShareView` instead of the app when the hash has a share code, so viewers never see the activation screen.
- The link is a snapshot: later changes need a new link. Owner id and notes are left out; portraits over 40k characters (most uploaded images) are dropped to keep the link pasteable.
- Decoding goes through `checkCharacter()` from `src/portability`, so homebrew races or classes the viewer's device lacks show an error instead of a broken sheet.

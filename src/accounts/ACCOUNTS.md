# Accounts

Personal activation codes for the group, so each friend signs in as themselves and the DM is marked as DM.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Account` (id, name, role `player` or `dm`), `Session` |
| `roster.ts` | `ROSTER`: the group's accounts (no codes or hashes); `isAdmin(id)` for the admin flag |
| `codes.ts` | `normalizeActivationCode` |
| `session.ts` | `activate(code)` (session or `'wrong'`/`'limited'`/`'offline'`), `activateErrorKey`, `getSession()`, `onSessionChanged` (localStorage `ff.account.v1`) |
| `ui.tsx` | `ActivateScreen` (front door on a new device), `CodeForm`, `AccountBadge` (DM badge in the top bar), `CloudLinkNotice` ("Turn on sync" for devices activated before the server) |
| `accounts.css` | Liquid Glass styles (see `src/design/DESIGN.md`): welcome card, code form, "Turn on sync" card, DM badge |
| `accounts.test.ts` | Normalizing, error messages and roster shape |

## How it works

- A new device opens on the activation screen. A valid code creates the friend's profile with their fixed account id (`acct-roy`...) and makes it active, so characters they build are owned by that id.
- "No code? Use this device only" keeps the old local-profile flow. Devices with profiles already never see the screen; the player picker has "Enter activation code…" to add an account there.
- Codes are typed loosely (case, spaces and dashes ignored) and checked only by the server's `claim_account` (rate limited). The site has no codes or hashes, since a hash of a short code can be cracked offline.
- `getSession()?.role === 'dm'` is how other modules tell the DM apart. `isAdmin(getSession()?.id)` marks the admin (Ziv), who gets the admin page (`src/admin/ADMIN.md`).

## Adding a friend

Pick a code like `NAME-XXXX-XXXX` (letters from `CODE_ALPHABET` in `party/code.ts`). Add `{ id: 'acct-name', name, role }` to `ROSTER`, and the same row with a bcrypt `code_hash` to the database `accounts` table in a new migration (`src/cloud/CLOUD.md`). Ids must never change: characters are owned by them.

## Limits

Activating needs a connection once, because the server checks the code and signs the device in to Supabase as that account (`src/cloud/CLOUD.md`); after that the session works offline. The local admin flag only unlocks this device's own data; what the cloud shows is decided by the database. Signing in on a second device starts with an empty list (use Export/Import from `portability`).

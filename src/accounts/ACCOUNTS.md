# Accounts

Personal activation codes for the group, so each friend signs in as themselves and the DM is marked as DM.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Account` (id, name, role `player` or `dm`), `Session` |
| `roster.ts` | `ROSTER`: the group's accounts with SHA-256 hashes of their codes; `isAdmin(id)` for the admin flag |
| `codes.ts` | `normalizeActivationCode`, `hashActivationCode`, `findInRoster` (pure apart from Web Crypto) |
| `session.ts` | `activate(code)`, `getSession()`, `onSessionChanged` (localStorage `ff.account.v1`) |
| `ui.tsx` | `ActivateScreen` (front door on a new device), `CodeForm`, `AccountBadge` (DM badge in the top bar) |
| `accounts.css` | Badge and front-door tweaks |
| `accounts.test.ts` | Normalizing, hashing, roster lookup and roster shape |

## How it works

- A new device opens on the activation screen. A valid code creates the friend's profile with their fixed account id (`acct-roy`...) and makes it active, so characters they build are owned by that id.
- "No code? Use this device only" keeps the old local-profile flow. Devices with profiles already never see the screen; the player picker has "Enter activation code…" to add an account there.
- Codes are typed loosely (case, spaces and dashes ignored). Only hashes are in the code, so the published site doesn't list them.
- `getSession()?.role === 'dm'` is how other modules tell the DM apart. `isAdmin(getSession()?.id)` marks the admin (Ziv), who gets the admin page (`src/admin/ADMIN.md`).

## Adding a friend

Pick a code like `NAME-XXXX-XXXX` (letters from `CODE_ALPHABET` in `party/code.ts`), then hash it:

```
node -e 'console.log(require("crypto").createHash("sha256").update(process.argv[1].toUpperCase().replace(/[\s-]/g,"")).digest("hex"))' NAME-XXXX-XXXX
```

Add `{ id: 'acct-name', name, role, hash }` to `ROSTER`. Ids must never change: characters are owned by them.

## Limits

There is no backend, so codes are checked in the browser and characters stay on the device they were made on. The codes stop casual sign-ups, not a determined visitor. Signing in on a second device starts with an empty list (use Export/Import from `portability`).

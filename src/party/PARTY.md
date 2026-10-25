# Party

Join a party with an invite code and see everyone's character at a glance. First step toward the DM dashboard.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Party`, `PartyMember` (saved shape) |
| `code.ts` | Invite codes and pure membership updates (`addMember`, `removeMember`, `setMemberCharacter`) |
| `store.ts` | Async party store (localStorage today), `onPartiesChanged` |
| `stash.ts` | Shared inventory and gold: pure `applyStash(party, userId, action)`, coin maths, even split |
| `PartyView.tsx` | Party list, create/join forms, read-only party table |
| `PartyStash.tsx` | Stash panel under the party table: coins, items, change log |
| `party.css` | Styles scoped to `.ff-party` |
| `party.test.ts` | Code and membership tests |
| `stash.test.ts` | Stash actions, coin conversion and splitting |

## How it works

- Creator is the DM and joins without a character. Players join with a code and pick which character they bring; anyone can switch or watch only.
- Codes: 6 chars from `CODE_ALPHABET` (no 0/O/1/I/L), shown as `ABC-234`, typed loosely (case, spaces, dash ignored).
- If the DM leaves, the longest-standing member becomes DM; the last member leaving deletes the party.
- The table is read-only: HP bar with temp HP and dying/stable/dead, AC, initiative, speed, passive Perception, spell DC, conditions, exhaustion. Stats come from `derive()`; nothing derived is stored on the party.
- Secret rolls: below the table, players roll a skill, check or save that only the DM sees; the DM gets the log. Lives in `src/dice` (`secret.ts`, `ui/SecretRolls.tsx`).
- Updates live via `onPartiesChanged` and `onCharactersChanged`, including other tabs.

## Shared stash

- `Party.stash` is optional (`getStash()` fills in an empty one), so older saved parties keep working.
- Every member can change it through `updateStash(partyId, userId, action)`; each change is logged as "who did what", newest first, capped at 50.
- Coins use all five SRD coins (pp, gp, ep, sp, cp). Taking more than the stash holds is refused.
- Split hands each member who brings a character an equal share in gp/sp/cp; the copper that doesn't divide evenly stays. Shares are logged, not paid into character sheets: the sheet owns character coins.
- Items picked by SRD name get an `itemId`. The same item stacks in the bag unless either one has a note. A member can carry an item (`heldBy`) or put it back.

## Limits until accounts exist

Storage is per browser, so parties only link profiles on the same device. With a hosted backend, `store.ts` keeps its API and codes resolve server-side; members should only be able to read characters of parties they belong to.

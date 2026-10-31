# Only the DM sees NPC sheets (2026-10-30)

Ziv: "Only the DM can see the character sheet of the npc." Access control for NPCs, end to end.

## Model (agreed with the NPC sheet creator thread)

- An NPC sheet is not a `Character`. It is an `NpcSheet` (src/npc, their thread): a monster stat block plus play state, `ownerId` = the DM's account.
- Because NPCs never enter `characters`, none of the party-sharing rules (`characters_party_read`, `rolls_party_read`, the party table, the roll feed, share links on the character list) can ever reach them. Privacy by construction; the rest is defence in depth.

## Server

- `supabase/migrations/20261030210000_npc_sheets.sql`: `npc_sheets (owner_id, id, data, rev, deleted, updated_at)`, primary key (owner_id, id), RLS owner-or-admin for select/insert/update, no delete grant (tombstones), realtime on. Same shape as `homebrew_packs` without `shares_party`.
- `supabase/tests/rls_test.sql`: DM edits with conditional rev, a player in the DM's own party reads nothing, cannot write or delete, admin reads all, unlinked device reads nothing. All checks pass on a local Postgres 16.

## Device

- `src/nav`: view `{ kind: 'npc', id }`, hash `#/npc/<id>`, `canOpen('npc')` = DM or admin (App bounces blocked views home), `navKeyFor('npc')` = DM screen.
- `src/party/visibility.ts`: `canViewCharacter` (owner, admin, brought to a shared party); `useCharacterAccess` makes App bounce a character screen the open profile may not see (a shared device, a pasted link). Also the rule the "DM sees player sheets" thread should build on (`isDmOf`).

## What players see in combat

- `src/combat/playerView.ts`: `playerView(encounter)` is the only shape that may leave the DM's device for the party. NPC rows: alias instead of name, healthy/bloodied/down instead of HP (unless `revealHp`), no AC/saves/bonuses; `hidden` rows vanish with their effects and turn. New optional `Combatant` fields `alias`, `hidden`, `revealHp`. The tracker UI for these switches and the pushing itself belong to the combat scenarios / battle map threads.

## Not done here

- Tracker row controls (alias, hide, reveal HP) and pushing `PlayerEncounter` to the party: combat scenarios thread.
- The NPC sheet model, screen, remote store and tracker link: NPC sheet creator thread.

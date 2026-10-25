# src/table

Table mode: a full-screen, big-button view of one character for playing at the table with one hand.
Opened from the "Table mode" button on a character card (`view.kind === 'table'` in `App.tsx`).

| File | What it does |
|---|---|
| `TableMode.tsx` | The view: HP and death saves, last roll, initiative and attack/damage buttons, slot and resource tiles, and a keypad with Damage / Heal / Temp and Undo. |
| `tracks.ts` | Pure helpers: `pressKey` (keypad input, capped at 999) and `tracks(c)` (spell slots, pact slots, class resources, custom trackers as tap-to-spend tiles). |
| `useWakeLock.ts` | Screen Wake Lock while the view is open; re-asks when the tab becomes visible again. Shows "Screen stays on" or "Screen may sleep". |

Rules:
- No state of its own. Every change goes through `sheet/engine.ts` via `useLiveCharacter`, so undo, saving and the full sheet stay in sync.
- Rolls go through `dice` (`useDice().record`) so they land in the shared roll history. Tapping an attack rolls to-hit and damage together (`rollAttackWithDamage`), with crit range and doubled dice on a crit; Dmg rolls extra plain damage.
- Turn order and encounter timers belong to `src/combat`; table mode does not track turns.

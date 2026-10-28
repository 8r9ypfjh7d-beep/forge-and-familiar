# Combat tracker

Initiative order, turns and rounds, concentration saves, and spell or condition timers that end on their own.
Pure engine at the top level (no React, dice or storage); React in `ui/`. Opened from the **Combat** tab in the top bar, which only the DM and admin accounts get (see src/nav).

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Encounter`, `Combatant`, `Effect`, `PendingCheck`, `CONDITIONS` |
| `engine.ts` | Every encounter change, pure. Tested in `engine.test.ts` |
| `storage.ts` | Encounters in localStorage (`ff.encounters.v1`), async API, filtered by `ownerId` |
| `ui/useEncounter.ts` | Loads an encounter and its party characters, saves both, undo |
| `ui/rolls.ts` | Initiative and concentration rolls through `src/dice`, recorded in the dice history |
| `ui/CombatTracker.tsx` | Encounter list and the open encounter (`initialOpenId` opens one straight away, used by the DM screen) |
| `ui/CombatantRow.tsx`, `AddCombatants.tsx`, `Effects.tsx`, `PendingChecks.tsx` | Parts of the encounter screen |
| `ui/combat.css` | Liquid Glass styles (src/design/DESIGN.md): `.glass` cards, `.glass-btn` buttons, `.glass-chip` chips; logical properties only |
| `ui/style.test.ts` | Keeps `combat.css` on logical properties and glass tokens |

## Rules

- **Party vs monsters.** A `pc` row links a Character: HP, death saves and conditions stay on the character and change through `src/sheet/engine` (`takeDamage`, `heal`, `rollDeathSave`), so the sheet and the tracker always agree. `npc` rows keep their own HP, AC, CON save and conditions.
- **Order.** Initiative high to low, ties to the higher modifier, then the table can swap tied rows (▲▼). Monsters at 0 HP are skipped; party members at 0 keep their turn for death saves.
- **Timers.** An effect ticks on its source's turn, at the start (default: "1 minute" ends at the start of the caster's 11th turn) or at the end ("until the end of your next turn"; the end of the turn it was cast on does not count). No source: ticks when a new round starts. `remaining: null` lasts until ended. Ending combat ends every effect.
- **Conditions from effects.** An effect's condition shows on its targets. For party members it is written to `character.state.conditions` when the effect starts and removed when it ends (`syncPartyConditions`), so `rules/rollMode` applies it to their rolls. Removing a condition by hand while its effect lasts is allowed.
- **Concentration.** One concentration effect per source; a new one ends the old. Each hit queues a CON save, DC max(10, half the damage). A failed save, 0 HP or an incapacitating condition (incapacitated, paralyzed, petrified, stunned, unconscious) ends it.
- **Text.** UI strings are `combat.*` keys in `src/i18n/locales` (English and Hebrew). Log lines are stored as `{ key, vars }` and translated when shown; plain strings in older saves show as written.
- **Look.** Cards are `.glass` (effects and log `.glass.thick`), one `.glass-btn.prominent` per surface (New encounter, Next turn, Roll save, Add). The active row wears the lens (accent tint, accent edge, accent initiative badge). Damage and heal are tinted glass. High contrast draws 2px edges where state is shown by fill. Phone controls are 44px tall.
- **Undo** restores the encounter and any party characters the step changed.

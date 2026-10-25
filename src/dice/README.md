# src/dice

Virtual dice for Forge & Familiar. Pure TypeScript at the top level, React bindings in `ui/`.
It reads `derive(c)` and `rules/rollMode` and never writes character state. Callers apply results (HP from a hit die, death save counts).

## Notation
`2d6+3`, `d20`, `d%` (d100), `1d8−1` (the engine's unicode minus is fine), `4d6dl1` / `2d20kh1` (keep/drop high/low: kh, kl, dh, dl).
Up to 100 dice and 1000 sides per term.

## Pure API (`import … from '../dice'`)
| Function | Notes |
|---|---|
| `roll(notation, opts)` | Any notation. Throws `DiceNotationError`. |
| `rollD20(bonus, opts)` | d20 + bonus with advantage or disadvantage. Sets `d20.crit` and `d20.fumble`. |
| `rollCheck / rollSave / rollSkill / rollInitiative(stats, …, opts)` | `stats = derive(c)`. |
| `rollAttack(attack, opts)` / `rollDamage(attack, { crit })` | `attack` from `stats.attacks`. A crit doubles the dice. `opts.critRange` (rules `getCritRange`) widens the crit. |
| `rollAttackWithDamage(attack, { critRange, twoHanded, riders, … })` | One tap: to-hit, then damage with the versatile die and riders (rules `getDamageRiders`) added. A crit doubles every die; a natural 1 returns no `damage`. |
| `rollHitDie(die, conMod)` / `rollDeathSave()` | The death save returns `outcome`. |
| `RollHistory`, `localHistoryStorage(key)` | Newest-first store, capped, with subscribe. |
| `sendSecretRoll(partyId, { roll, fromUserId })`, `secretView(list, dmId, viewerId)` | Secret rolls (`secret.ts`): one log per party (`ff.rolls.secret.v1.<partyId>`). The DM gets every result; the roller gets masked "sent" stubs only. Never written to `ff.rolls.v1.*`, so the group feed can't show them. |

`opts`: `{ mode?, character?, ignoreConditions?, label?, rng? }`. Passing `character` tags the roll with who rolled it. It also merges `getRollMode` from that character's conditions and exhaustion with any situational `mode`. Advantage and disadvantage cancel out, per the SRD. Saves the character fails automatically come back with `autoFail: true`.

## React (`import … from '../dice/ui'`)
- `<DiceProvider userId>` wraps the app. Each user gets their own history in localStorage (`ff.rolls.v1.<userId>`), so friends sharing a device keep separate logs.
- `useDice()` returns `{ record, roll, history }`. The sheet does `record(rollSave(stats, 'dex', { character: c }))`.
- `useRollHistory(characterId?)` gives the live list. `<RollView roll>` shows one roll.
- `<SecretRolls party userId character? nameOf>` sits on the party page: a player picks a skill, check or save and rolls it for the DM; the DM sees the results log.
- `<DiceFab open onOpenChange character?>` is the floating dice button App.tsx puts on every screen (there is no dice page). It opens a small window with the `DiceTray`; the `D` shortcut and Escape toggle it. On a character's screen, free rolls are tagged with that character.
- `<DiceTray character? showAll?>` is the full roller: d4 to d100 buttons, a modifier, an Adv/Dis toggle for a lone d20, a notation box and the history.

Every `RollResult` is plain JSON with `roller`, so Campaign Mode can broadcast the rolls to the DM later.

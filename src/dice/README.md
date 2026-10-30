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
| `rollAttackWithDamage(attack, { critRange, twoHanded, riders, … })` | One tap: to-hit, then damage with the versatile die and riders (rules `getDamageRiders`) added. A crit doubles every die; a natural 1 returns no `damage`. Both rolls share `action: { id, name }`, the damage keeps `damageType`, and each damage term is tagged with its `source` (weapon or rider name). |
| `rollParts(parts, opts, type, crit)` | Several named parts as one roll (weapon `2d6+4`, Hex `1d6`): each term gets the part's `source`, so the card can list damage per source. A part's `lowDice` applies Great Weapon Fighting (`lowDiceUp`): `'reroll'` rerolls 1s and 2s once, `'min3'` counts them as 3; the old die stays struck through. |
| `groupByAction(list, rollOf, same?)`, `sameAction(a, b)`, `actionName(group)` | History grouping: rolls sharing `action.id` (an attack and its damage) become one entry, attack first. Older saves without `action` pair an attack with the damage rolled within 2 s under the same name. |
| `rollHitDie(die, conMod)` / `rollDeathSave()` | The death save returns `outcome`. |
| `RollHistory`, `localHistoryStorage(key)` | Newest-first store, capped, with subscribe. |
| `headlineDie(r)`, `isNat20(r)`, `isNat1(r)`, `critKind(r)`, `pickLine(random, count, last)`, `RollFxBus` | Roll effects (`fx.ts`): the die face to animate, natural 20 / natural 1 detection (a lone tray d20 counts), a non-repeating joke picker, and a bus that keeps the to-hit, not the damage, when one tap records both. |
| `sendSecretRoll(partyId, { roll, fromUserId })`, `secretView(list, dmId, viewerId)` | Secret rolls (`secret.ts`): one log per party (`ff.rolls.secret.v1.<partyId>`). The DM gets every result; the roller gets masked "sent" stubs only. Never written to `ff.rolls.v1.*`, so the group feed can't show them. For cloud parties `secretCloud.ts` sends each roll to the `secret_rolls` table, which only the party's DM can read, and keeps the DM's log live. |

`opts`: `{ mode?, character?, ignoreConditions?, label?, rng?, lucky? }`. `lucky` (Halfling Lucky) rerolls a natural 1 on the d20 once and uses the new roll (with advantage or disadvantage the dice are compared again); the label gets "Lucky" and the 1 shows struck through. Character checks, saves, skills and initiative take it from `DerivedStats.lucky`. Passing `character` tags the roll with who rolled it. It also merges `getRollMode` from that character's conditions with any situational `mode`. Advantage and disadvantage cancel out, per the SRD. Saves the character fails automatically come back with `autoFail: true`.

## React (`import … from '../dice/ui'`)
- `<DiceProvider userId>` wraps the app. Each user gets their own history in localStorage (`ff.rolls.v1.<userId>`), so friends sharing a device keep separate logs.
- `useDice()` returns `{ record, roll, history }`. The sheet does `record(rollSave(stats, 'dex', { character: c }))`.
- Every `record`/`roll` also plays `<RollFx>` (rendered by the provider): a die tumbles above the dice button and lands on the natural d20 (or the first die). A natural 20 or natural 1 then takes over the whole screen (`ui/CritFx.tsx`, `ui/crit.css`): the 20 gets a white flash, god rays, shockwaves, lightning, sparks, screen shake and a gold die slamming down; the 1 gets the lights flickering out, the app drained grey, a die that falls, bounces and cracks, rain from a sad cloud and a sagging title. Each shows a random joke (`dice.nat20.line1..8`, `dice.nat1.line1..8`; `NAT20_LINES`/`NAT1_LINES` must match), buzzes phones that allow it, and stays on screen until any tap, ✕ or Escape closes it (no timer). Reduce motion (a11y panel or the OS) skips the tumble and shows a still card with the same words. Secret rolls don't go through `record`, so they never animate.
- `useRollHistory(characterId?)` gives the live list. `<RollView roll>` shows one roll; damage with two or more sources lists one line per source with its subtotal. `<RollGroupView rolls>` shows a `groupByAction` entry: one card with the action's name, a "To hit" line and a "Damage (type)" line. The dice tray history, the party roll feed (grouped per member) and the sheet's Attacks result use it. Secret rolls are single checks, so they stay plain `RollView`s.
- `<FadingResult key onDone className?>` wraps a roll result card on a screen: it fades after `RESULT_SHOW_MS` (8 s), closes on tap, sideways swipe (touch), Enter or Escape, and holds while hovered, pressed or keyboard-focused. Give it a new `key` per roll so a new roll restarts it. The sheet's Attacks card and the combat page use it.
- `<SecretRolls party userId character? nameOf>` sits on the party page: a player picks a skill, check or save and rolls it for the DM; the DM sees the results log.
- `<DiceFab open onOpenChange character? secretTo?>` is the floating dice button App.tsx puts on every screen (there is no dice page). It opens a small window with the `DiceTray`; the `D` shortcut and Escape toggle it. On a character's screen, free rolls are tagged with that character.
- `<DiceTray character? showAll?>` is the full roller: d4 to d100 buttons, a modifier, an Adv/Dis toggle for a lone d20, a notation box and the history. With `secretTo` (App passes it for a player, not the DM, of the party in play) it adds a "Secret: only the DM sees" switch: rolls then go through `shareSecretRoll` and skip this device's history and the roll animation, so the player sees only "sent to the DM".

## Look
`ui/dice.css` follows the Liquid Glass standard (`src/design/DESIGN.md`): the dice button is tinted accent glass, the window is a thick glass sheet that grows out of it, die keys and quiet buttons use a faint ink fill (`--ff-dice-fill`) so they show on light and dark glass, the advantage toggle is a segmented control, and roll cards keep their layout on `--glass-thin`. Colours come from the app tokens (crit/fumble from `--good`/`--bad`); the `--ff-*` hooks still override them. High contrast and Reduce transparency go solid through the glass tokens, with 2px edges in high contrast. The nat 20 / nat 1 overlays keep their own palettes; only their ✕ and hint are glass. `style.test.ts` keeps the CSS on logical properties.

DM rolls stay private by design: the DM brings no character, so their rolls (monster stat blocks, combat tracker, free rolls) are never shared to the party feed or the cloud `rolls` table that members read.

Every `RollResult` is plain JSON with `roller`, so Campaign Mode can broadcast the rolls to the DM later.

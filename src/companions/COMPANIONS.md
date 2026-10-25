# Companions

Mini sheets for familiars, pets, summons and wild shapes, each tied to one character. Opened from the **Companions** button on a character card.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `Companion` (saved), `Creature` stat block, `CompanionKind` |
| `data/creatures.ts` | SRD 5.1 stat blocks: Find Familiar forms, Pact of the Chain forms, beasts up to CR 1 |
| `rules.ts` | Pure rules: which forms each kind offers, wild shape limits and uses, HP changes with overflow |
| `store.ts` | Async store (localStorage key `ff.companions.v1`), `deleteCompanionsFor`, `onCompanionsChanged` |
| `CompanionsView.tsx` | Page for one character: mini sheets plus the Add panel |
| `MiniSheet.tsx` | One companion: HP, AC, speed, abilities, attacks, traits, notes |
| `useCompanionRolls.ts` | Rolls through the shared dice history, tagged with the owner's character id |
| `companions.css` | Styles scoped to `.ff-comp` |
| `companions.test.ts` | Data, wild shape, familiar and HP tests |

## How it works

- Companions are stored apart from `Character`, linked by `characterId`, so the saved character shape is unchanged. Deleting a character deletes its companions.
- A companion stores only choices and play state (creature id, max HP, current and temp HP, notes). Stats come from the creature; a custom creature is stored inline under `custom`.
- **Familiar**: SRD Find Familiar list; a warlock 3+ also gets imp, pseudodragon, quasit and sprite (we can't tell if Pact of the Chain was picked). At 0 HP it vanishes; "Summon again" restores it.
- **Companion**: any SRD beast or a custom creature; stays until removed.
- **Summon**: add up to 8 at once (Conjure Animals), named "Wolf 1", "Wolf 2"...
- **Wild shape** (druid 2+, Circle of the Land rules): CR 1/4 with no fly or swim, CR 1/2 with no fly at 4, CR 1 at 8; lasts half the druid level in hours. Transforming spends the class `wild-shape` resource on the character. INT, WIS and CHA show the druid's own scores. At 0 HP the form is removed and leftover damage goes to the druid through `sheet/engine.takeDamage`.
- Rolls use `rollAttack`, `rollDamage` and `rollD20` with `roller = { characterId: owner, characterName: companion }`, so they appear in the owner's roll history.

## Not yet

Conditions on companions, wild shape duration timer, sharing companions in the party view.

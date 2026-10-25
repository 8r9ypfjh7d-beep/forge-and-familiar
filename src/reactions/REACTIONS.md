# Reactions

Reminds players which reactions they have, when each triggers, and whether they can pay for it. Shown as a card on the live sheet.

## Files Covered

| File | Purpose |
|------|---------|
| `reactions.ts` | Pure: `getReactions(c)`, `reactionBlocker(c)`, `lowestFreeSlot(c, level)` |
| `ReactionReminders.tsx` | Sheet card: ready/used status, Use/Cast buttons, New round |
| `reactions.css` | Styles scoped to `.ff-reactions` (inside `.ff-sheet`) |
| `reactions.test.ts` | Detection, slot and blocker tests |

## How it works

- Opportunity Attack for everyone, using the first equipped melee weapon (else Unarmed Strike).
- Class features by level: Uncanny Dodge (Rogue 5), Deflect Missiles (Monk 3), Slow Fall (Monk 4).
- SRD reaction spells by class list, once the character has a slot of that level: Shield, Feather Fall, Hellish Rebuke, Counterspell. Spells known/prepared are not tracked yet, so they are labelled "if prepared".
- Cast spends the lowest free slot at or above the spell's level (regular or pact) through the sheet's `apply`, so it shows in history and can be undone.
- 0 HP or incapacitated, paralyzed, petrified, stunned, unconscious disables every reaction.
- "Reaction used" is shared with the turn checklist through `useTurn` from `src/turn` (per tab, not saved). New round here or Next turn there clears it.

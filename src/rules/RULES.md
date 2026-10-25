# Rules engine

Pure functions over a `Character`. No React, storage or dice. Import from `src/rules` (index.ts).

## Files Covered

| File | Purpose |
|------|---------|
| `index.ts` | Public API re-exports |
| `types.ts` | Rule definitions: abilities, races, classes, items, conditions |
| `abilities.ts` | Modifiers, standard array, point buy, racial bonuses, final scores |
| `derive.ts` | `derive()` and helpers: HP, hit dice, AC, attacks, saves, skills, slots, resources, speed |
| `factory.ts` | `createCharacter(draft)`, `freshState(maxHp)`, starting kit |
| `rollMode.ts` | Advantage/disadvantage from own conditions and exhaustion |
| `multiclass.ts` | Prerequisites, multiclass proficiencies, caster level breakdown, per-class spell DCs, multiclass warnings |
| `data/*.ts` | SRD 5.1 content |
| `rules.test.ts`, `multiclass.test.ts` | Engine tests |

## Key rules implemented

- HP: max hit die at level 1, fixed average after, + CON per level, Hill Dwarf +1/level. Exhaustion 4 halves max (`maxHp` vs `baseMaxHp`).
- AC: armor + capped DEX, shield +2, Barbarian/Monk unarmored defense (Monk loses it with a shield).
- Attacks: finesse uses better of STR/DEX, ranged uses DEX, Monk martial arts, proficiency from class and race.
- Slots: full/half caster tables (single half caster rounds up from level 2), multiclass caster level, Warlock pact slots.
- Resources: per-class maxima by level; `recharge` resolved for level (e.g. Bardic Inspiration short rest from 5).
- Speed: heavy armor STR requirement, Monk/Barbarian movement, exhaustion 2 and 5.
- Saving throw proficiencies come from the first class only.
- Multiclass (SRD 5.1, `data/multiclass.ts`): ability prerequisites for the new class and every current one; later classes grant only their multiclass armor/weapon proficiencies; Unarmored Defense comes from the first class that has it; Channel Divinity uses don't add up. `derive().warnings` carries unmet prerequisites, level over 20, Extra Attack/Unarmored Defense/Channel Divinity not stacking, separate spell lists and pact slots, and the extra skill Bard/Ranger/Rogue grant (not yet pickable).

## Stable API (used by the sheet and dice)

`derive`, `getMaxHp`, `getEffectiveMaxHp`, `getHitDice`, `getResources`, `getSpellSlots`, `getArmorClass`, `getAttacks`, `getRollMode`, `autoFailsSave`, `createCharacter`, `freshState`, `getCasterLevel`, `getSpellcastingByClass`, `addClassIssues`, `meetsPrereq`. Field names on `DerivedStats` (`saves`, `skills`, `attacks`, `initiative`) are relied on by `src/dice`.

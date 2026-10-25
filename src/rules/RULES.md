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
| `attackRiders.ts` | `getDamageRiders` (Rage, Sneak Attack) and `getCritRange` (Champion) for one-tap attacks |
| `choices.ts` | ASI slots and feats, languages, tools, starting-gear choices (`classKit`) |
| `multiclass.ts` | Prerequisites, multiclass proficiencies, caster level breakdown, per-class spell DCs, multiclass warnings |
| `data/*.ts` | SRD 5.1 content: races, classes, `subclasses.ts` (one per class), `feats.ts` (Grappler), `backgrounds.ts` (Acolyte + custom), `proficiencies.ts` (languages, tools), items |
| `rules.test.ts`, `multiclass.test.ts`, `choices.test.ts` | Engine tests |

## Key rules implemented

- HP: max hit die at level 1, fixed average after, + CON per level, Hill Dwarf +1/level. Exhaustion 4 halves max (`maxHp` vs `baseMaxHp`).
- AC: armor + capped DEX, shield +2, Barbarian/Monk unarmored defense (Monk loses it with a shield), + `magicBonus` of equipped armor and shield.
- Item effects (`itemEffects.ts`): an equipped entry's `effects` apply when it needs no attunement or is attuned (`state.attuned` holds `@<uid>`). Ability effects apply in `getAbilityScores` (after the 20 cap, so a belt can raise STR to 29); bonuses go to AC (`unarmored` only without armor or shield), every save, every skill and initiative (`checks`), spell DC and attack, and speed. `src/explain/math.ts` lists each item as its own line. SRD defaults per magic item are in `data/magicItemEffects.ts`.
- Items: always resolve an inventory entry with `entryItem(e)`: it uses the entry's embedded `item` (library or custom items), else `itemById`, and applies the `name` override.
- Attacks: finesse uses better of STR/DEX, ranged uses DEX, Monk martial arts, proficiency from class and race. Each attack carries `versatile` (two-handed damage) and `properties`. Riders: Rage +2/+3/+4 on STR melee, Sneak Attack ⌈rogue level ÷ 2⌉d6 on finesse or ranged (the player toggles them). Champion crits on 19 (level 3) or 18 (level 15). Magic weapons add `magicBonus` to attack and damage and `extraDamage` rides along. A `pact` weapon is always proficient and, with `spellEdition: '2024'`, uses CHA when it is higher.
- XP: `XP_THRESHOLDS` (SRD) and `xpForNextLevel(level)`.
- Attack rows also carry `itemId`, `reach` (5, or 10 with reach; missing for ranged weapons) and `range` ("20/60").
- Slots: full/half caster tables (single half caster rounds up from level 2), multiclass caster level, Warlock pact slots.
- Resources: per-class maxima by level; `recharge` resolved for level (e.g. Bardic Inspiration short rest from 5).
- Speed: heavy armor STR requirement, Monk/Barbarian movement, exhaustion 2 and 5.
- Saving throw proficiencies come from the first class only.
- Subclasses: features join `features` from `subclassLevel`; Life Domain adds heavy armor; Draconic Bloodline adds 1 HP per sorcerer level and 13 + DEX unarmored AC.
- ASIs and feats (`improvements`) add to ability scores (cap 20). Feat effects apply: ability, skill, HP per level, speed, initiative, AC. `DerivedStats.feats`, `.tools`, `.languages` list them.
- Backgrounds go through `getBackground(c)`, which also builds the PHB custom background.
- Homebrew: `registerHomebrewRaces` (subraces attach to their parent), `registerHomebrewSubclasses`, `registerHomebrewFeats`, like `registerHomebrewItems`. SRD ids always win. Use `allRaces()` for lists; `RACES` is SRD only.
- Multiclass (SRD 5.1, `data/multiclass.ts`): ability prerequisites for the new class and every current one; later classes grant only their multiclass armor/weapon proficiencies; Unarmored Defense comes from the first class that has it; Channel Divinity uses don't add up. `derive().warnings` carries unmet prerequisites, level over 20, Extra Attack/Unarmored Defense/Channel Divinity not stacking, separate spell lists and pact slots, and the extra skill Bard/Ranger/Rogue grant (not yet pickable).

## Stable API (used by the sheet and dice)

`derive`, `getMaxHp`, `getEffectiveMaxHp`, `getHitDice`, `getResources`, `getSpellSlots`, `getArmorClass`, `getAttacks`, `getRollMode`, `autoFailsSave`, `createCharacter`, `freshState`, `getCasterLevel`, `getSpellcastingByClass`, `addClassIssues`, `meetsPrereq`. Field names on `DerivedStats` (`saves`, `skills`, `attacks`, `initiative`) are relied on by `src/dice`.

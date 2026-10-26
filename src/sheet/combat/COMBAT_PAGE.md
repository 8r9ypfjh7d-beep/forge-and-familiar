# Combat page

The sheet's combat mode, laid out like Roll20's character page. Only the layout and content structure are copied, not Roll20's look.

## Files Covered

| File | Purpose |
|------|---------|
| `combat.ts` | Pure: `spellAttackRows` (known library spells and typed-in quick-cast spells that attack or force a save), `withRollFromText` (save/attack from the text when the library has none), `addAction` / `updateAction` / `removeAction` / `actionsOf` (the player's own actions), `resolveDice` (fills STR…CHA, PROF, LEVEL), `actionRoll` (an action's attack bonus or save DC and dice), `isHealing`, `effectToggles` (Rage, Sneak Attack, Hex, Hunter's Mark, Divine Favor), `masteryLimit` |
| `CombatPage.tsx` | `CombatSummary` (portrait and level, class and subclass, race, background, XP, proficiency, Level Up, Initiative roll, the sheet's HP and Rest cards, `AbilitiesPanel` with Mod and Save rolls, `AcSpeed`; story mode reuses `AbilitiesPanel` and `SkillsPanel`), `SkillsPanel`, `CombatTabs`, `Fight` (Combat tab), `FeaturesTraits` |
| `combat.css` | Styles, logical properties for RTL |
| `combat.test.ts` | Helper tests |

## Rules

- Tabs render existing sheet sections (`COMBAT_TABS` in `../mode.ts`); add a card to a tab there, don't duplicate it here.
- Every tap rolls through `useSheetRolls`, so results reach the dice history. A leveled spell in the attacks table spends the lowest free slot through `apply` (undoable) and rolls at that level.
- Every roll result is labeled with what it is for (To hit with the AC it reaches, Damage with its type, the check or save), never shown bare.
- Actions, Bonus Actions, Reactions, Free Actions and Other hold only what the player adds (`Character.customActions`); nothing is listed automatically. An action can carry a roll (an attack roll using an ability + proficiency, or a save DC of 8 + proficiency + modifier, then dice such as `1d8+CHA`) shown as a 🎲 button, and an effect: extra damage, stat changes (the item effects editor: AC, saves, checks, weapon attack and damage, initiative, spell attack and DC, speed, ability scores) or both. It appears as a switch under Effects; the switch is saved on the action (`active`), and while on `src/rules/itemEffects.ts` counts its stat changes like an equipped item's.
- A roll result lists the switched-on effects that went into it (`effectsUsed`): dice riders that were rolled and only the stat changes that touch that roll (weapon: attack, damage, the attack's ability; spell: spell attack or DC; action: its ability).
- Effects are toggles kept in component state, not saved. Spell effects ride on weapon and spell attacks; Rage and Sneak Attack on the weapons they apply to.
- Feature, trait, feat and spell text comes from the content library for the character's edition. The Features tab shows the source's CC-BY attribution: keep it.
- "Level Up" opens the edit flow (`onEdit`).

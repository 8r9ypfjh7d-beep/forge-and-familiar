# Character builder

Six-step wizard that turns choices into a `CharacterDraft`, then `createCharacter()` makes the saved character at full HP with its starting kit equipped.

## Files Covered

| File | Purpose |
|------|---------|
| `Builder.tsx` | Wizard shell, step navigation, `emptyDraft()`; `EditCharacter` loads a saved character into it |
| `edit.ts` | `draftFrom()`, `applyEdit()`, `startingGearChanged()`: editing a saved character |
| `steps.tsx` | Step components: Race (+ Dragonborn ancestry), Class (+ subclass), Abilities (+ ASI or feat), Background & skills (+ custom background, languages, tools), Equipment (SRD kit choices), Details |
| `validate.ts` | `stepIssues()` per step; a step with issues blocks later steps |
| `Summary.tsx` | Live preview panel using `derive()` |
| `MulticlassPicker.tsx` | Optional extra classes on the Class step: prerequisites, proficiencies gained, caster-level math |
| `builder.css` | Builder-only styles, on the Liquid Glass standard (`src/design/DESIGN.md`) |
| `Why.tsx`, `why.css` | "why?" button (topic or any title/text, optional capsule label), `Explain` (the picked option's line) and `ExplainList` (name + line per feature, trait, language, tool) |
| `why.ts` | "why?" topic ids, `explainKey(kind, id)` and `pitchKey()`; topic text is in `i18n/locales/en.ts`, option explanations in `i18n/locales/explain.en.ts` / `explain.he.ts` |
| `validate.test.ts` | Validation tests |
| `kit.ts` | `groupKitItems()`: repeated kit items shown once with a count (Javelin ×10) |
| `kit.test.ts` | Kit item grouping |
| `edit.test.ts` | Editing keeps play state and gear |
| `why.test.ts` | Every step, option and SRD entry (both editions) has an explanation |
| `style.test.ts` | Builder, "why?" and level history CSS use logical properties and glass tokens only |

## Notes

- Look: the step card and summary are `.glass`; tiles inside (race/class choices, stats, kit choices) are thin glass with the lens for the selected one. Buttons are `.glass-btn` (one `.prominent` per surface), picks are `.glass-chip`, the rules switch is `.glass-segmented`. On phones the step bar is one swipeable row that keeps the current step in view. The "why?" bubble is a `.glass-sheet`.

- Rules: the Race step starts with a 2014 / 2024 switch (`rulesEdition`). Switching clears race, background, skills, languages, tools, ASIs, gear picks and class choices; classes keep their levels and drop their subclass. New characters default to 2014.
- 2024: species show traits only; a Human picks an Origin feat. The Abilities step picks the background and its +2/+1 or +1/+1/+1 (`BackgroundBonuses`). The Class step asks for Fighting Style, Divine Order or Primal Order when the level unlocks it (`ClassChoices`). ASI feats above the slot's level are hidden (Epic Boons at 19); feats with a +1 choice ask for the ability. Skilled adds three picks of any skill. Gear choices show their coins; option B is coins only. No custom background in 2024.

- Random: "Random character" above the step bar (new characters only), the dice next to the name and the backstory hook on Details come from `src/random` (see `RANDOM.md`).
- Ability methods: standard array (with "suggest for my class"), point buy (27), manual/rolled (3–20). Unassigned standard scores are 0.
- Changing race or class clears chosen skills, since the allowed picks change.
- Portraits are resized to 320px JPEG data URLs before saving.
- Starting equipment follows the SRD "(a) or (b)" choices (`ClassDef.equipmentChoices`); "any martial weapon" slots get a dropdown and a default.
- Races, subraces, subclasses and feats list SRD content plus every homebrew pack on the device, so content from books the group owns is entered once in Homebrew.
- Background "Custom background" is the PHB rule: any 2 skills, 2 tools or languages in any mix, a named feature. No background items; the class kit and 15 gp still apply.
- Subclass is required once a class reaches `subclassLevel`. Each ASI slot (`asiLevels`) needs two +1s or a feat; no score above 20.
- Language picks come from race, subrace and background (`languagePickCount`); tool picks from race and first class (`toolPickGroups`), in that order in `chosenTools`.
- Changing race clears language, tool and trait picks; changing the first class clears skills, tools, gear picks and ASIs.
- Not in the builder yet: spell selection, Bard (Lore) / Ranger / Rogue extra skill and expertise picks, buying gear with starting gold.
- Multiclass: `classes[0]` is the starting class (saves, skills, gear). Unmet prerequisites only warn (decided 2026-10-29: many tables allow it): once scores are set, the picker marks short classes with ⚠ and shows a translated note, and `derive().warnings` lists them in the summary. All picker text is in en + he (`builder.mc.*`).
- "why?" tips are for new players: one short, jargon-light paragraph each. Every option is explained: card stats (legend capsules), each race trait, subrace/lineage, class (`why.about.<id>` plus the `why.class.<id>` pitch), class and subclass feature up to the chosen level, subclass, Fighting Style/Order, ability, skill, background, language, tool, kit choice and alignment. Features and traits are keyed by name, artisan's tools, gaming sets and instruments share one line per group.
- Add SRD content to `rules/data/` and `why.test.ts` fails until its line is in `explain.en.ts`; `i18n.test.ts` then asks for the Hebrew in `explain.he.ts`. Homebrew has no line and shows "ask your DM".
- Editing: "Edit" on the character card or sheet header reopens the builder prefilled (`view: 'edit'`). Every step is reachable, Save works from any step once all steps pass, and Cancel asks before discarding changes.
- An edit keeps id, XP, notes, coins, inventory and play state. Current HP moves by the change in max HP (0 HP stays 0); slots, hit dice and resources are clamped by the sheet's `normalize()`. If the class kit or background gear changes, a checkbox (on by default) swaps the old starting gear for the new; other items stay.
- Saving an edit takes a "Before edit" level snapshot first, so Levels can roll it back. While editing, the Summary derives from the edited character, so AC uses its real gear.

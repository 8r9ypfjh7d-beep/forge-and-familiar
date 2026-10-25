# Character builder

Six-step wizard that turns choices into a `CharacterDraft`, then `createCharacter()` makes the saved character at full HP with its starting kit equipped.

## Files Covered

| File | Purpose |
|------|---------|
| `Builder.tsx` | Wizard shell, step navigation, `emptyDraft()` |
| `steps.tsx` | Step components: Race, Class, Abilities, Background & skills, Equipment, Details |
| `validate.ts` | `stepIssues()` per step; a step with issues blocks later steps |
| `Summary.tsx` | Live preview panel using `derive()` |
| `MulticlassPicker.tsx` | Optional extra classes on the Class step: prerequisites, proficiencies gained, caster-level math |
| `builder.css` | Builder-only styles |
| `Why.tsx`, `why.css` | "why?" button that opens a plain-language explanation |
| `why.ts` | All "why?" text: per-topic tips plus a pitch for each race and class |
| `validate.test.ts` | Validation tests |
| `why.test.ts` | Every step, race and class has an explanation |

## Notes

- Ability methods: standard array (with "suggest for my class"), point buy (27), manual/rolled (3–20). Unassigned standard scores are 0.
- Changing race or class clears chosen skills, since the allowed picks change.
- Portraits are resized to 320px JPEG data URLs before saving.
- Starting equipment is one fixed SRD option per class; players change gear on the sheet.
- Multiclass: `classes[0]` is the starting class (saves, skills, gear). Unmet prerequisites block the Abilities step once all scores are set; extra classes are greyed out on the Class step when scores are known and fall short.
- "why?" tips are for new players: one short, jargon-light paragraph each. Add a race or class to `rules/data/` and `why.test.ts` will remind you to add its pitch to `why.ts`. The tip text is English only for now (not yet in `i18n/locales`).

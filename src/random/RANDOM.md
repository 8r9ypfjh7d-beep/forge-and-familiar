# Random generators

Roll a whole random character in the builder, or just a name and a backstory hook.

## Files Covered

| File | Purpose |
|------|---------|
| `generate.ts` | `randomDraft(ownerId, edition, rng)`: a valid level 1 draft (SRD only) with every builder step filled; `randomCharacterDraft()` adds spells; `kitItems()`, `hasPicks()`, `randomHookKey()` |
| `spells.ts` | `randomSpells(draft, library, rng)`: full cantrips and known/prepared/spellbook spells per class plus race and feat picks, an attack cantrip first; `loadSpellLibrary(edition)` |
| `names.ts` | `randomName(raceId, rng)`: syllable-built names per race, human style for unknown/homebrew races |
| `RandomBar.tsx` | `RandomCharacter` (top of a new character's builder), `RandomName` (dice next to the name field), `BackstoryHook` (Details step) |
| `random.css` | Styles, on the Liquid Glass standard |
| `random.test.ts` | 400 seeds per edition pass every `stepIssues()` step; styles and masteries fit the kit; casters get their full spell counts; every hook exists in English and Hebrew |

## Notes

- Randomness stays out of `src/rules`; every function takes an `rng` so tests use a seeded one.
- Random character keeps the player name and the chosen rules edition, uses the standard array (class's main abilities first, then CON and DEX) and jumps to Details so the player can review or change any step.
- Gear comes first: a kit option with items (never coins only), "any weapon" slots that go together (one-handed with a shield, sometimes a light pair). The fighting style is one the kit can use (`STYLE_FITS`; cantrip and maneuver styles are never rolled), Weapon Mastery takes the kit's weapons first, and a Fighter with a bow or finesse kit leads with DEX.
- Spells: SRD only. Each class gets its full cantrips (an attack cantrip first) and spells (one that deals damage, one that heals when 3+, then any). The library loads async, so `rollRandom` awaits `randomCharacterDraft`.
- It asks first, in an in-app glass dialog (not `confirm()`), only when the player made real picks (`hasPicks`: the rules edition alone doesn't count) and the draft isn't an untouched earlier roll.
- Hook text is `random.hook.<n>` in the locales (`HOOK_COUNT`). The hook is saved, in the current language, as the new character's story notes. Adding hooks: raise `HOOK_COUNT` and add the key to `en.ts` and `he.ts`.
- Names are our own syllables, not book name lists. Not shown when editing a character.

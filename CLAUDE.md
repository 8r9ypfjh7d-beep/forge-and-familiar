# Forge & Familiar

D&D 5e character manager. React 19 + TypeScript + Vite, Vitest for tests. SRD 5.1 content only.

## General Rules

- Read only the docs and code relevant to the task; follow the tiered docs below.
- Always ask before changing this `CLAUDE.md`.
- When adding or changing a module, update its doc and the Documentation Files list.
- `src/rules/` stays pure TypeScript: no React, no storage, no randomness.
- Saved data is `model/character.ts`; anything computable goes in `rules/`, never stored.
- Commits: one imperative line, ≤50 chars, no body, no trailer.

---

## Architecture

```
index.html              - Vite entry page
src/
    main.tsx            - React root
    App.tsx             - Player profiles, character list, routing between builder and sheet
    index.css           - Global design tokens and shared primitives (.panel, .btn, .chip)
    model/
        character.ts    - Saved Character, CharacterState and UserProfile types
        MODEL.md        - Documents the data model
    rules/              - Pure rules engine shared by every screen
        RULES.md        - Index doc for the engine
        data/           - SRD 5.1 races, classes, backgrounds, items, skills
    builder/            - Guided character creation wizard
        BUILDER.md      - Documents the builder
    sheet/              - Live character sheet (HP, death saves, resources, rests)
    storage/            - Async character/profile store (localStorage today)
    dice/               - Virtual dice roller
plans/                  - Timestamped plan files
```

---

## Documentation Files

| File | Documents | Read when |
|------|-----------|-----------|
| `src/model/MODEL.md` | Character, CharacterState, UserProfile | Adding a saved field or changing storage shape |
| `src/rules/RULES.md` | Rules engine index and public API | Any stat calculation, SRD data, or derived value |
| `src/builder/BUILDER.md` | Builder steps and validation | Changing character creation |

---

## Known Tasks

- **Add SRD content** (race, class, item): edit the matching file in `src/rules/data/`, add a test in `src/rules/rules.test.ts`.
- **Add a derived stat**: compute it in `src/rules/derive.ts`, expose it on `DerivedStats`, test it. The dice thread relies on `saves`, `skills`, `attacks`, `initiative` names staying stable.
- **Add a saved field**: update `src/model/character.ts` and `MODEL.md`; bump `CHARACTER_SCHEMA_VERSION` if old saves need migrating.

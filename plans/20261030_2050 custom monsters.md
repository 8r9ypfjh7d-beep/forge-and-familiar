# Custom monsters (homebrew)

Let the DM (or any player) write their own monsters with every stat-block field, keep them in homebrew packs, share them with the party, and use them wherever SRD monsters are used (DM screen Monsters tab, encounter plans, combat tracker, NPC sheets).

## Schema agreement (with "Plan the NPC sheet creator" and "Plan the full monster list")

- One stat-block type: `Monster` in `src/content/types.ts`. A reference is always `{ source, id }`.
- The monster-list thread adds optional fields to `Monster` (`spellcasting`, `lairActions`, `legendary`, `book`, `nameHe`...). This thread does not edit `types.ts`; `MonsterBlock` carries the same optional fields as an intersection until that PR lands.
- `HomebrewMonster = MonsterBlock = Omit<Monster, 'source' | 'edition'>` with ids `hb:<packId>:<slug>`.
- The homebrew store registers one content pack per active homebrew pack (source `hb:<packId>`, monsters only), so `loadKind('monsters')` and the monster-list thread's `loadMonsters()` return SRD + books + homebrew. Party members' packs are registered too (read-only).
- `src/monsters/` is the shared editor module: `MonsterForm` (every field), pure `model.ts` (blank, CR → XP/proficiency, HP dice, issues, `sanitizeMonsterBlock`). The NPC thread reuses it; it owns `StatBlock` and `src/npc`.

## Steps

1. `src/monsters/model.ts` (pure): `MonsterBlock`, lists (sizes, types, speeds, senses, damage types, conditions, CR steps), `XP_BY_CR`, `proficiencyForCr`, `hitDieForSize`, `averageOf(dice)`, `hitPointsRollFor`, `blankMonster`, `monsterIssues`, `sanitizeMonsterBlock`.
2. `src/monsters/MonsterForm.tsx`: Liquid Glass editor with why? bubbles: identity (name, size(s), type, subtype, alignment), defenses (AC rows, HP with auto dice/average from size + CON, speeds + hover), abilities (scores, auto saves/skills from proficiency with override), senses, languages, CR (XP and PB fill in), damage vulnerabilities/resistances/immunities, condition immunities, traits/actions/bonus actions/reactions/legendary/lair actions (name, text, to hit, damage lines, save, usage: per day / recharge / per rest), legendary actions count + resistance, spellcasting (ability, DC, attack, groups), description.
3. Homebrew wiring: `HomebrewMonster`, `pack.monsters`, `allEntries`, `newPack`, `sanitizePack`/`sanitizeEntry`, `toMonster`, store registers content packs (and unregisters deleted ones), `Homebrew.tsx` "Monsters" tab (blank, save, subtitle, body preview, copy), delete warning. i18n EN + HE.
4. Tests: model (XP, PB, HP math, issues), sanitize round trip through a share code, `toMonster` + `loadKind('monsters')` sees the pack monster, DM `findMonsters` finds it.
5. Docs: `src/monsters/MONSTERS.md`, `HOMEBREW.md`, `CONTENT.md` note, CLAUDE.md architecture line (ask first per rules → listed under "needs the user", not done).
6. PR, tests, rebase on main (after the monster-list PR if it lands first), merge, Live site check.

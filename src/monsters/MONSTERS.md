# Monsters

Shared pieces for every screen that shows or edits a monster stat block: the DM screen's Monsters tab, NPC sheets (src/npc) and custom monsters (src/homebrew). One stat block type everywhere: `Monster` from src/content.

## Files Covered

| File | Purpose |
|------|---------|
| `block.ts` | Pure reads of a block: `monsterMod`, `initBonus`, `conSave`, `passivePerception`, `legendaryCount`, `legendaryResistance`, `spellSlots`, `perDayGroups`, `actionUses`, `limitedActions`; `Block` = `Monster` (src/content carries every optional field) |
| `format.ts` | Text: `crLabel` ("1/8"), `speedText`, `usageText` ("(Recharge 5–6)"), `typeLine`, `sensesText` |
| `StatBlock.tsx` | The stat block card with roll buttons (checks, saves, skills, to hit, damage, HP dice) through `useDice`, labelled "<name>: <what>". Props: `title` (an NPC's name over the creature's), `actions` (heading buttons), `rollAs`, `children` (between the core lines and the abilities), `hideHp`, `uses` + `onUse` (pips on limited actions) |
| `model.ts` | Pure editing helpers: `MonsterBlock` (`Monster` without `source`/`edition`), lists (sizes, types, alignments, speeds, senses, AC types, action groups), `XP_BY_CR`/`xpForCr`, `proficiencyForCr`, `hitDieForSize`, `averageOf`, `hitPointsRollFor`, `proficientSave`/`proficientSkill`, `perceptionFromSkills`, `blankMonster`, `monsterIssues`, `sanitizeMonsterAction`, `sanitizeMonsterBlock`, `toLibraryMonster` |
| `MonsterForm.tsx` | Controlled editor (`value`, `onChange`) for every field: identity, CR (XP and proficiency fill in), abilities, AC rows, hit dice to HP, speeds, saves, skills (proficient/expertise/custom), senses, damage and condition immunities, traits/actions/bonus/reactions/legendary/lair actions (to hit, damage lines, save, usage), legendary counts, spellcasting groups, description. Why? bubbles (`mf.*` keys) |
| `form.css` | Editor styles (`.mf-*`), Liquid Glass, logical properties |
| `model.test.ts` | CR tables, HP math, validation, sanitizer round trip, editor style guard |
| `monsters.css` | Stat block styles on the Liquid Glass standard (`.mon-*`, `.chip-roll`), logical properties only |
| `monsters.test.ts` | Text helpers, block reads, style guards |

## How it works

- Rolls never carry a party character id; the DM is a watcher, so the party feed never shows them.
- Stat block text stays English (`lang="en" dir="ltr"`); labels go through `t()` (`dm.*` keys).
- Names show through `useI18n().monsterName` (Hebrew with the English under it); book monsters show their Hebrew trait/action summaries (`descriptionHe`) in Hebrew, their lore line, gear/habitat/treasure, regional effects, and `monsterSourceNote` under the block (CC-BY line, book title plus the summary note, or the pack name). `legacy` marks an older-edition book monster.
- **Editor.** `MonsterForm` is one editor for homebrew monsters (src/homebrew, Monsters tab) and NPC tweaks. Derived numbers follow their inputs until the author types over them: HP from size, dice count and CON; saves and skills at their proficient value move with abilities and proficiency bonus; passive Perception follows Perception. Spell group presets use the exact English labels `block.ts` reads ("1st level (4 slots)", "1/day each").
- **Sanitizing.** `sanitizeMonsterBlock(raw, id)` rebuilds a block field by field from untrusted JSON; the caller gives the id (packs force `hb:<packId>:<slug>`).
- **Homebrew.** `src/homebrew/store.ts` registers each pack's monsters as a content pack with source `hb:<packId>`, so `loadMonsters` lists them on the DM screen, in plans and in the tracker hand-off.

## Known tasks

- **Show a new block field:** read it in `block.ts` if it needs a rule, render it in `StatBlock.tsx`, add its `dm.*` label to both locales.
- **Add an editable field:** read it in `sanitizeMonsterBlock`, edit it in `MonsterForm`, test the round trip in `model.test.ts`.
- **Reuse the stat block on a page:** import `StatBlock` from `src/monsters`; the page needs `.ff-sheet` on an ancestor for the card styles.

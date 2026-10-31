# Monsters

Shared pieces for every screen that shows or edits a monster stat block: the DM screen's Monsters tab, NPC sheets (src/npc) and custom monsters (src/homebrew). One stat block type everywhere: `Monster` from src/content.

## Files Covered

| File | Purpose |
|------|---------|
| `block.ts` | Pure reads of a block: `monsterMod`, `initBonus`, `conSave`, `passivePerception`, `legendaryCount`, `legendaryResistance`, `spellSlots`, `perDayGroups`, `actionUses`, `limitedActions`; `Block` = `Monster` plus the optional `MonsterExtras` fields (`spellcasting`, `lairActions`, `legendary`, `initiative`, `book`) |
| `format.ts` | Text: `crLabel` ("1/8"), `speedText`, `usageText` ("(Recharge 5–6)"), `typeLine`, `sensesText` |
| `StatBlock.tsx` | The stat block card with roll buttons (checks, saves, skills, to hit, damage, HP dice) through `useDice`, labelled "<name>: <what>". Props: `title` (an NPC's name over the creature's), `actions` (heading buttons), `rollAs`, `children` (between the core lines and the abilities), `hideHp`, `uses` + `onUse` (pips on limited actions) |
| `monsters.css` | Stat block styles on the Liquid Glass standard (`.mon-*`, `.chip-roll`), logical properties only |
| `monsters.test.ts` | Text helpers, block reads, style guards |

## How it works

- Rolls never carry a party character id; the DM is a watcher, so the party feed never shows them.
- Stat block text stays English (`lang="en" dir="ltr"`); labels go through `t()` (`dm.*` keys).
- `MonsterExtras` mirrors the fields the monster data threads add to `Monster`. Once `Monster` carries them, drop the intersection.
- The custom monsters work adds `MonsterForm.tsx` and `model.ts` (`blankMonster`, `monsterIssues`, `sanitizeMonsterBlock`) here: one editor for homebrew monsters and NPC tweaks.

## Known tasks

- **Show a new block field:** read it in `block.ts` if it needs a rule, render it in `StatBlock.tsx`, add its `dm.*` label to both locales.
- **Reuse the stat block on a page:** import `StatBlock` from `src/monsters`; the page needs `.ff-sheet` on an ancestor for the card styles.

# Homebrew editor

Status: done (first version)

- `src/homebrew/`: packs of custom spells, items and feats, editor UI, share by code or file, read-only friend copies.
- Homebrew items registered with the rules engine (`registerHomebrewItems`), so they work in attacks, AC and weight; "Give to" adds them to a character.
- Imports are sanitized and namespaced (`hb:<packId>:<slug>`).

Next: feat effects in the level-up flow (builder thread), spells in a spellbook/quick-cast list, change history (history thread), cloud sync of packs once accounts exist.

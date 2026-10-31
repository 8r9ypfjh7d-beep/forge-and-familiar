# Battle maps

The DM's combat maps: a 5-ft square grid, painted terrain or a picture under the grid, labels, fog and the edge the party enters from. The Maps tab on the DM screen lists them and opens the editor. A running combat (src/combat/live.ts, unit A of the combat-maps plan) copies the map it uses to the party; this module owns the map itself and the pure board maths.

## Files Covered

| File | Purpose |
|------|---------|
| `types.ts` | `BattleMapDef` (grid, sparse `terrain`, `labels`, `picture`, `fog` cell keys, `partyEdge`, `diagonals`), `Terrain`, `MapToken` (structurally the live combat's token), size limits |
| `logic.ts` | Pure: `createMap`/`normalizeMap`, painting (`paintRect`, `toggleDoor`, `setLabel`), fog (`coverCells`/`revealCells` on cell lists, `coverFog`/`revealFog` on a map), `resizeMap`, picture fit (`setPicture`, `fitPicture`, `gridFromPicture`), `footprintOf`, `fits`, `publicTokens`, `distanceFeet`/`tokenDistanceFeet`, `findPath` (Dijkstra), `checkMove`, `autoPlace`, `UNPLACED` |
| `templates.ts` | The four starter maps (`buildTemplate`): tavern, forest clearing, dungeon corridor, open field |
| `names.ts` | `mapName`: a saved map's name to show; template and "Untitled map" names in any language follow the current language |
| `render.ts` | `drawMap(ctx, map, opts)` paints picture, terrain, grid, party edge, path, labels and fog on a canvas; `cellName` ("C4"), `describeCell`, `TERRAIN_GLYPH` |
| `store.ts` | `listMaps`/`getMap`/`saveMap`/`deleteMap`/`syncMaps`/`onMapsChanged`: device cache `ff.maps.v1.<ownerId>` mirrored to Supabase `dm_maps` (one row per map, newest `updatedAt` wins, pending ids in `ff.maps.pending.v1.<ownerId>`) |
| `MapEditor.tsx` | The editor (tools, settings, picture fit, canvas) and `MapThumb` for list rows |
| `MapPicker.tsx` | Select of the DM's maps for an encounter plan (Encounters tab on the DM screen) |
| `MapsTab.tsx` | Maps tab: templates, list, delete confirm, debounced saves |
| `maps.css` | Liquid Glass layout for the tab and editor, logical properties only |
| `maps.test.ts` | Painting, fog, pictures, distances, paths, move checks, auto-placement, normalizing, templates, CSS rules |

## How it works

- **Grid.** 5 to 60 cells a side (`MIN_CELLS`/`MAX_CELLS`), default 24 × 16. Floor is the default and never stored; `terrain` holds only other cells keyed `"x,y"`. Walls and closed doors block; difficult terrain, water and hazards cost double; open doors and stairs are floor with a glyph.
- **Movement maths.** `findPath` runs Dijkstra over cells with 8-way moves, no cutting a wall's corner, other tokens blocking, and the 5-10-5 variant tracked as diagonal parity. `checkMove` names the problem (`outside`, `blocked`, `occupied`, `unreachable`) and flags a move past the budget without refusing it ("warn, don't block"). `autoPlace` lines up tokens at `UNPLACED` along `partyEdge` from the middle outwards, big tokens hanging inwards.
- **Pictures.** Uploaded through `src/lore/image.ts` (`shrinkImage(file, 'map')`, 2048 px long side, JPEG data URL inside the map JSON). `picture.cell` is one square in picture pixels; the grid is always resized to what fits (`gridFromPicture`), so width and height are read-only while a picture is set.
- **Fog.** `map.fog` is the starting cover. During play the fog lives on the combat's board; `coverCells`/`revealCells` work on plain cell-key lists so the tracker reuses them. `publicTokens(map, tokens, fog)` is what players may see: no hidden tokens, none under fog.
- **Editor.** Tools: move around (scrolls on touch), erase, wall, difficult, water, closed/open door, hazard, stairs, label (opens `PromptDialog`), cover and reveal fog. Tap paints one cell, drag paints the rectangle. The canvas is keyboard-usable (arrows move a cursor, Enter paints) and announces the cell under the cursor. Zoom has five steps from 16 to 52 px.
- **Storage.** Maps belong to the DM account (`ownerId`); the admin may read and write any. `syncMaps` merges newest-wins per map, pushes pending saves and deletes, and remembers which ids the server had so a map removed on another device goes away here too. Realtime on `dm_maps` re-syncs through `onMapsChanged`.

## Known tasks

- **Add a terrain kind:** extend `Terrain`/`TERRAINS` in `types.ts`, decide in `blocks`/`isDifficult`, add its fill in `render.ts` `terrainFill` and glyph in `TERRAIN_GLYPH`, a tool chip (`maps.tool.<kind>` in both locales) and a test.
- **Add a template:** add it to `TEMPLATES` and `TEMPLATE_IDS` in `templates.ts` with `maps.tpl.<id>` strings; the templates test checks it is walkable.
- **Change what a player may see:** `publicTokens` in `logic.ts` is the one rule; the live row's public view mirrors it.

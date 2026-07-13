# Among Demons Map Editor

Standalone local editor for `public/api/data/map.json`.

## Workflow

1. Open `tools/map-editor/index.html` locally.
2. Click `Import` and choose `public/api/data/map.json`.
3. Edit roads, blocked terrain (rocks, poison, or lava), shrines, teleports, spawn, or demon spots. Select a demon spot to edit its threat, key demon, and team members.
4. Use `Display` to switch between the game-style preview and the editor schematic.
5. Click `Save Draft` to store a temporary draft in this browser.
6. Click `Export` to download the current map as `map.json`.
7. Replace `public/api/data/map.json` with the exported file when you are ready.

`Save Draft` uses browser local storage only. It does not write to the repo and does not call the website API.

The game preview mirrors the `/world` map styling with procedural terrain, roads, blocked terrain, shrines, portals, spawn, and demon spots. Demon spot portraits load from `public/app/images/demons/map` when this editor is used inside the website repo; otherwise the editor falls back to rarity-colored markers.

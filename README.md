# Among Demons Map Editor

Standalone local editor for `public/api/data/map.json`.

## Workflow

1. Open `tools/map-editor/index.html` locally.
2. Click `Import` and choose `public/api/data/map.json`.
3. Edit roads, blocked terrain, shrines, teleports, spawn, or demon spots.
4. Click `Save Draft` to store a temporary draft in this browser.
5. Click `Export` to download the current map as `map.json`.
6. Replace `public/api/data/map.json` with the exported file when you are ready.

`Save Draft` uses browser local storage only. It does not write to the repo and does not call the website API.

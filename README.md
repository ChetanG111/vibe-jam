# Black Sea Contracts (Editor-First)

This is an editor-first Three.js web game for **vibe-jam**.

- `/` loads an instant placeholder scene (no gameplay/movement yet).
- `/?mode=editor` opens the content editors (missions, UI screens, models) in **dev only**.

## Dev

PowerShell on this machine blocks `npm` scripts, so use `npm.cmd`.

- Install: `npm.cmd install`
- Run dev server: `npm.cmd run dev`

Open:

- Game placeholder: `http://localhost:5173/`
- Editors (dev only): `http://localhost:5173/?mode=editor`

## Build (portable static)

- `npm.cmd run build`

The output in `dist/` is a static site that works on:

- Vercel
- GitHub Pages (subpath-friendly)
- itch.io (zip `dist/`)
- Cloudflare Pages

## Content Packs

Editors store working data in `localStorage` and export JSON packs you can commit to the repo later.

- Missions: `missions.pack.json`
- UI screens: `ui.pack.json`
- Models: `models.pack.json` (procedural primitives)

## Model Assets (glTF/GLB budgets)

To ship Blender-made models, put optimized `.glb`/`.gltf` files under `src/assets/models/`.

Budgets are enforced at build time:

- Max per model file: 250 KB
- Max total shipped model bytes: 2 MB

See `scripts/check-model-budgets.mjs`.

# Black Sea Contracts (Vibe-Jam) — Editor-First Plan (No Movement Yet)

This repo ships a web-based Three.js game with an **editor-first** workflow. The goal is to make adding content (missions, UI screens, models) fast and safe before gameplay/movement is finalized.

## Goals

- Instant-start web game (no login, no blocking loading screen).
- Content creation happens via in-browser editors:
  - Missions: templates + generator preview
  - UI screens: limited component screen builder
  - Models: procedural primitives + optional glTF preview/import
- Host portability:
  - Vercel now (fast preview deploys)
  - Also works on GitHub Pages / itch.io (static zip) / Cloudflare Pages

## Non-Goals (for this phase)

- No player movement or final gameplay loop.
- No multiplayer implementation (keep code ready for later).
- No heavy assets (models/textures/audio kept tiny or procedural).

## Branching + Preview Workflow

Use **GitHub Flow**:

- `main` is always playable (loads instantly, no console errors).
- Branch naming:
  - `feat/editor-shell`
  - `feat/mission-editor`
  - `feat/ui-builder`
  - `feat/model-editor`
  - `fix/...`
- PRs only into `main`, use **squash merge**.

Required PR gates (GitHub Actions):

- Typecheck must pass.
- Build must pass.

Required manual check (Vercel Preview, every PR):

- `/` loads instantly (placeholder scene OK).
- `/?mode=editor` loads instantly and editors function.
- No console errors on first load.

## Hosting Portability Rules

- Single `index.html`, **no client-side routing**.
- Editor mode is toggled by query param: `/?mode=editor`.
- Vite base paths:
  - Dev server: base `/`
  - Production build: base `./` (relative) so `dist/` runs from any subpath.

## Content Packs + Editors

All editor output is **repo-committable JSON**.

### Missions

Format: mission templates + generator parameters.

Editor features:

- List/create/duplicate/edit templates
- Generator preview: generate N missions from a seed
- Export/import JSON + validation + error messages

### UI Screens

Format: screen definitions in JSON built from a limited component palette:

- `container`, `text`, `button`, `bar`, `list`

Editor features:

- Visual builder with preview
- Property inspector (layout, theme tokens, text, bindings)
- Mock-data preview
- Export/import JSON + validation

### Models

Two modes:

1. Primary: procedural primitives JSON
   - Parts: `box`, `cylinder`, `cone`
   - Transform: position/rotation/scale, plus color
   - Runtime generates geometry (tiny downloads, low-poly look)
2. Optional: small glTF/GLB models from Blender
   - Editor provides preview via GLTFLoader
   - Shipped game only includes models placed in `src/assets/models/`

#### Asset Budgets (build-time enforced)

- Max per model file: 250 KB
- Max total shipped model bytes: 2 MB

Build should fail if budgets are exceeded.

## Implementation Steps (each step = one PR)

1. Repo + CI + Vercel previews
2. App shell + `mode=editor` lazy load
3. Content system + validation + import/export UX
4. Mission editor + generator preview
5. UI screen builder (limited palette)
6. Model editor (procedural + glTF preview) + budget check
7. Docs + guardrails + smoke checklist

## Acceptance Checks

- `/?mode=editor` can create and export:
  - Mission pack JSON
  - UI screen JSON
  - Procedural model JSON
- Production `dist/` works from:
  - root path (`/`)
  - a subpath (GitHub Pages-style)
  - local static server


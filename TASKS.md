# Tasks (Living)

This file is the canonical checklist. Update it whenever a meaningful change lands (PR merge, editor feature added, budgets tweaked, CI changed).

## Now

- [x] Scaffold Vite + TS + Three (no movement)
- [x] Add app shell + `/?mode=editor` lazy-load
- [x] Add content types + validation + import/export UX
- [x] Implement mission editor + generator preview
- [x] Implement UI screen builder (limited palette)
- [x] Implement model editor (procedural + glTF preview) + budgets
- [x] Add GitHub Actions (typecheck/build) + PR template
- [x] Add docs: content packs + smoke checklist
- [ ] Smoke check: `/` and `/?mode=editor` in browser

## Next

- [x] Gate editor to dev-only builds (no editor shipped in prod)
- [ ] Networking abstraction stub (no multiplayer yet)
- [ ] Run-length tuning hooks (heat/difficulty placeholders)

## Done

- [x] Write decision-complete plan (`PLAN.md`)
- [x] Build succeeds (`npm.cmd run build`)

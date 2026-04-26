# Game Runtime (WIP)

This folder contains the playable runtime. For now it is limited to:

- Third-person orbit camera around a static submarine model (Q/E)
- No movement, physics, or depth caps yet

The dev build will attempt to load a local OBJ model from `dev-assets/`:

- `dev-assets/Seaview submarine.obj`

Production builds never ship `dev-assets/` and will fall back to a small procedural placeholder.


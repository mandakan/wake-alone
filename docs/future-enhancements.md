# Future enhancements

Ideas worth doing later, with enough context to pick them up cold.

## Tube warp v2 - true fixed-viewport CRT bulge  [SHIPPED 2026-06-08]

**Status:** done. Built into `engine/template.html`; spec at
`docs/superpowers/specs/2026-06-08-tube-warp-v2-design.md`. The whole readable
screen (HUD + story + scanlines) now scrolls inside a fixed, viewport-sized `#crt`
frame, and the barrel `feDisplacementMap` (plus the tier dim) is composed into one
filter on that frame, so the content itself curves as one piece of glass. Still
sanity-gated (flat at high sanity, eases in below ~60) and `FEAT.warp` /
`prefers-reduced-motion` still gate it.

Both v2 traps were resolved and verified live (headless Chromium on the built
`dist/index.html`, 390x740):
- **Clipping soft-lock (v1's bug):** fixed by filtering the fixed frame, not the
  reflowing `#sc`. At terminal sanity both choices stayed fully in-viewport.
- **`filter` breaks `position:sticky`:** did NOT break here -- the filter is on the
  scroll container itself, and the sticky HUD pins to `top:0` correctly after
  scrolling. The "in-flow HUD" fallback was not needed.

Still open / tunable later: profile the scroll re-rasterize on low-end mobile (most
nodes fit one viewport, so the filter applies once); and the bow magnitude is still
the v1 cap (`warpT*warpT*42`) -- it reads as a gentle curve and can be pushed harder
if wanted.

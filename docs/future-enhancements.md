# Future enhancements

Ideas worth doing later, with enough context to pick them up cold.

## Tube warp v2 - true fixed-viewport CRT bulge

**Status:** backlog. **Why it's here:** the shipped tube warp (enhancement 06)
bows the *scanline overlay only* (`#tube`), which is safe but subtle - it never
touches the readable text. A fuller "the whole screen is curved glass" bulge
needs the content itself to warp, and that is the part that's hard to do without
clipping.

**The trap (already hit once):** applying an SVG `feDisplacementMap` directly to
the reflowing story content (`#sc`) in the full-page engine magnified the text
past the reading column (clipped by `overflow-x:hidden`) AND clipped its own
filter region, which *hid the choice buttons and soft-locked the run*. Don't put
a displacement filter on flowing, full-page content.

**The v2 approach:** restructure the runtime so all content scrolls *inside* a
fixed, viewport-sized "tube" element (like the design demo's fixed device), and
apply the barrel displacement to that fixed frame. Because the frame is a fixed
size and scrolls internally, the filter region is stable and nothing reflows out
of it.

Things to solve in v2:
- The sticky HUD: a CSS `filter` creates a containing block, which breaks
  `position:sticky`. Either keep the HUD outside the warped frame, or make the
  warped frame the scroll container and the HUD `sticky` relative to it.
- Scroll: content scrolls inside the tube, not the window. Reconcile with the
  current `window.scrollTo` calls in `goto`/`render`.
- Perf: a displacement filter on a tall, scrolling frame re-rasterizes on scroll.
  Cap the bow, and profile on mobile.
- Readability: ease the bow in only at low sanity (as now) and keep the centre
  - where the player reads - close to flat.

Until then, `FEAT.warp = true` drives the safe overlay-only bow; flip it off in
`engine/template.html` to remove even that.

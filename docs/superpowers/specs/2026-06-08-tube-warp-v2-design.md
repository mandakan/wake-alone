# Tube warp v2 — true fixed-viewport CRT bulge

**Date:** 2026-06-08. **Scope:** `engine/template.html` only (the single static
deterministic engine). **Flag:** reuses the existing `FEAT.warp` (no new flag).

## Goal

Replace the v1 "safe" warp (which bows only the `#tube` scanline overlay, never the
text) with a true CRT bulge where the *readable content itself* curves. Decisions
locked in brainstorming:

- **Whole screen curves** — HUD + story + scanlines all warp as one piece of glass.
- **Sanity-gated** — flat/calm at high sanity; the bow eases in below ~60 and peaks
  at terminal, using the existing `warpT*warpT*42` curve. The curve is a degradation
  tell, not a constant.

## The two traps this must not repeat

1. **Soft-lock by clipping (v1's first attempt):** an `feDisplacementMap` on the
   reflowing full-page content (`#sc`) magnified text past the reading column
   (clipped by `overflow-x:hidden`) and clipped its own filter region, hiding the
   choice buttons. Fixed here by filtering a **fixed, viewport-sized frame** whose
   region is stable; content scrolls *inside* it and can never reflow out of the box.
2. **`filter` breaks `position:sticky`:** a CSS `filter` establishes a containing
   block. In v1 this is why the dim lived on `#sc`, not `#root`. See the empirical
   risk below.

## Architecture

Introduce one permanent fixed scroll frame, `#crt`:

```
<body>  (overflow:hidden — the window no longer scrolls)
  <div id="fx">...</div>                     body-level, flat, z52  (unchanged)
  <svg id="warpdefs">...</svg>               filter defs           (unchanged)
  <div id="crt">                             NEW: position:fixed; inset:0;
                                             overflow-y:auto; the ONE scroll
                                             container; gets the barrel filter
    <div class="tube" id="tube"></div>       scanlines: MOVED inside, now warped
    <div class="wrap screen" id="root"></div>  HUD + story content
  </div>
  <div id="watch">...</div>                  body-level, flat, z55  (unchanged)
```

- **Filter target:** the barrel `feDisplacementMap` (existing `#tubewarp`, sized to
  `innerWidth/innerHeight` via `userSpaceOnUse`) is applied to `#crt`, not `#sc`.
  Because `#crt` is fixed at viewport size, its filter region is stable and
  displacement only shifts painted pixels *within* the frame.
- **Dim composes into the same filter:** the tier dim (`brightness/saturate`) moves
  off `#sc` and is concatenated with the warp into one `filter` string on `#crt`
  (`brightness(.84) saturate(.9) url(#tubewarp)`) — one rasterize, whole screen.
- **Scanlines join the glass:** `.tube` (still `position:fixed; inset:0`) moves
  inside `#crt`. When the warp filter is active, `#crt` is the containing block, so
  the scanlines pin to the frame *and* warp with it. When the filter is off (high
  sanity), `.tube` pins to the viewport (same box, `#crt` is `inset:0`) and is
  unwarped — correct in both states.
- **Stays flat, on top:** `#fx` (tier bleed/roll/heart/wash), `body::after`
  (vignette, z51), and `#watch` remain body-level overlays above `#crt` — radial
  glows and centered intrusive text read best undistorted.

## Scroll reconciliation

The window no longer scrolls; `#crt` does. A single helper replaces all five
`window.scrollTo(...)` sites:

```js
function scrollTop(smooth){
  if(crtEl) crtEl.scrollTo({top:0, behavior: smooth ? "smooth" : "auto"});
  else window.scrollTo(0,0);
}
```

Sites: `startEpisode` (instant), `goto` (smooth), `renderEnding` x2 (smooth),
`renderMadness` x2 (smooth), `titleScreen` (instant). The resize handler keeps
re-running the screen filter so the warp region tracks viewport size.

## Function changes

- `applyTubeWarp` -> `applyScreenFilter`: operates on `#crt`, builds `dim + warp`
  into one filter string; clears to `""` on non-play screens. Replaces both the old
  `#sc` dim path and the old `#tube` warp path. Called from the same places
  (`applyContentFilter` is folded into it; `renderEnding`/`renderMadness`/
  `titleScreen`/resize call it).
- `ensureTubeWarp`: unchanged (still sizes to viewport; `#crt` is viewport-sized).

## Safety properties

- Barrel map is zero-displacement at center (reading column stays flat) and bows
  edges *inward* — it shifts pixels within the fixed frame rather than enlarging
  layout, so choices in the lower-middle stay on-screen. `.wrap` keeps its generous
  `padding-bottom:120px` so the last choice never sits at the extreme bow.
- `REDUCED` (prefers-reduced-motion) still kills the warp entirely.
- Bow stays capped at the existing magnitude.

## The one empirical risk — sticky HUD

`#crt` carries a `filter` and is the HUD's scroll ancestor. Sticky is computed
relative to the scrolling box, so `position:sticky; top:0` *should* hold even though
the filter makes `#crt` a containing block — but this is browser-dependent.

**Verify live on staging.** If the HUD fails to stick inside the filtered frame,
**fall back to in-flow HUD** (drop `position:sticky`). Because every node scrolls to
top on entry, the HUD is visible at the start of each node regardless; it would only
scroll away on long nodes. The chosen "HUD curves too" intent is satisfied either way.

## Perf

Filtering a scroll container re-rasterizes on scroll, but most nodes fit one viewport
(filter applied once). Only long nodes pay the scroll cost; the bow is capped. Profile
on mobile on staging; if janky, gate the heavier filter to non-touch pointers.

## Out of scope

No new `FEAT` flag, no new episode content, no validator changes. `FEAT.warp = false`
disables the whole thing.

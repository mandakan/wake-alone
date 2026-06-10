# Hash-based navigation for skein

## Problem

The skein runtime (`engine/template.html`) is a pure single-page app with no
browser-history integration: no `pushState`, no `popstate`/`hashchange` routing
for episodes. `titleScreen()`, `startEpisode()`, `goto()`, and `choose()` mutate
the DOM directly. Consequently the browser Back button leaves the page entirely
(navigating to whatever preceded `index.html`) instead of returning the player to
the salvage menu. There is also no in-run exit: a "Return to salvage menu" button
exists only on ending/madness screens, so mid-run a player is stuck.

## Goal

Three behaviors, satisfied by one mechanism:

1. **Back returns to the menu.** Browser Back from anywhere inside a story lands on
   the salvage menu, not the previous external URL.
2. **In-story exit control.** An always-visible "abort to salvage menu" link during
   play.
3. **Shareable per-episode URLs.** Each episode has its own URL hash (`#derelict`)
   that deep-links into it.

Out of scope: per-node back/undo, mid-run resume, any saved game state.

## Approach: hash as the single source of truth for "which screen"

The URL hash encodes which *screen* is showing, never which *node*:

- empty hash -> salvage menu
- `#<episode-id>` -> that episode (started fresh from its `start` node)
- `#lab` (allowed hosts only) -> lab mode (existing behavior, preserved)

Story nodes within a run never change history. So Back from any node pops the hash
back to empty and renders the menu -- exactly the requirement -- with no per-node
machinery. Hash routing also works on `file://` (the user opens `dist/index.html`
directly) and is consistent with the `#lab` hash the engine already uses.

Rejected alternative: History API (`pushState`/`popstate`). More granular but
awkward on `file://`, and per-node history was explicitly out of scope.

## Design

### Single router

Introduce `route()`, the only place that decides what to render from the URL. It
reads `location.hash` (lowercased, `#` stripped) and dispatches:

- `lab` and `labAllowed()` -> `lab()` (unchanged)
- a token matching an **unlocked, playable** episode (`!ep.locked && ep.nodes`)
  -> `startEpisode(ep)`
- anything else (empty, unknown, locked, or `lab` on a prod host) -> `titleScreen()`

`route()` runs once on initial load and on every `hashchange`. It tracks the
currently shown episode id (or `null` for the menu/lab) and **only (re)starts an
episode when the target differs** from what is already on screen, so ordinary
in-run renders never trigger a restart, and a `hashchange` that resolves to the
same episode is a no-op.

This replaces both the existing boot line
(`if(labHash() && labAllowed()) lab(); else titleScreen();`) and the existing
lab-only `hashchange` listener. There is exactly one `hashchange` listener after
this change.

### Starting an episode

Episode cards change from `onclick="startEpisode(EPISODES[i])"` to setting the hash,
e.g. `onclick="location.hash='derelict'"` (using `ep.id`). The resulting
`hashchange` drives `route()` -> `startEpisode()`. Making menu->episode a real
history entry is what yields Back-to-menu for free. `startEpisode()` itself is
unchanged (it still resets sanity/inventory and goes to `ep.start`); it is simply
no longer called directly from the card.

### Returning to the menu

One helper, `returnToMenu()`, sets the hash to empty so `route()` renders the
title screen. It replaces the direct `titleScreen()` calls in the four existing
"Return to salvage menu" buttons (escape ending, dead ending, ending fallback,
madness) and backs the new in-story exit link. Browser Back produces the same
result with no extra code, because the menu is the prior history entry.

Setting an empty hash: assign `location.hash = ''`. This routes to the menu and is
robust whether the player arrived via the menu or via a direct deep link.

### In-story exit control

A low-emphasis link, wording matched to house style
(`> abort to salvage menu`), rendered on every play screen. Placement: the
`footer()` string, which already renders on every screen (menu, play, endings) --
least layout disruption, always reachable. On the menu screen the link is
suppressed (no episode to abort), so `footer()` takes a flag or checks `episode`
state to decide whether to include it.

### Fresh start on deep link / reload (confirmed)

Deep-linking or reloading into `#derelict` starts the episode from `ep.start` with
default sanity/inventory. There is no per-node persistence; a shared link means
"play this episode," not "resume this run." This is the existing `startEpisode()`
behavior and requires no save state.

## Edge cases

- **Locked episode hash** (`#<locked-id>`) -> falls through to `titleScreen()`.
- **Unknown hash** -> `titleScreen()`.
- **`#lab` on a prod host** -> `labAllowed()` is false -> `titleScreen()`.
- **`#lab` on an allowed host** -> `lab()`, exactly as today.
- **Reload mid-run** -> hash is `#<id>` -> fresh start of that episode (accepted).
- **Hash navigation scroll**: `#<id>` has no matching element id, so the browser
  performs no scroll jump; the engine continues to drive `#crt` scrolling via
  `scrollTop()`.

## Files touched

- `engine/template.html` only (engine, not story content). Add `route()` and
  `returnToMenu()`; rewrite the boot line and the `hashchange` listener; change
  episode-card `onclick`; thread the exit link through `footer()`; repoint the four
  menu-return buttons at `returnToMenu()`.

## Validation

- `npm run build` to regenerate `dist/index.html` (build inlines the template).
- `npm test` still passes (solver-only; unaffected, but confirm no regression).
- Manual playtest in `dist/index.html`:
  - card -> URL shows `#<id>`; Back -> menu; Forward -> re-enters episode (fresh).
  - in-story exit link -> menu; URL clears.
  - reload while in an episode -> restarts that episode.
  - direct `#derelict` load -> starts derelict; Back leaves the site (no menu
    behind it) -- acceptable for a deep link.
  - `#lab` on localhost still opens lab; `#lab` semantics unchanged.

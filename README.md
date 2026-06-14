# WAKE ALONE

[![CI](https://github.com/mandakan/wake-alone/actions/workflows/ci.yml/badge.svg)](https://github.com/mandakan/wake-alone/actions/workflows/ci.yml)
[![Release](https://github.com/mandakan/wake-alone/actions/workflows/release-please.yml/badge.svg)](https://github.com/mandakan/wake-alone/actions/workflows/release-please.yml)
[![Deploy staging](https://github.com/mandakan/wake-alone/actions/workflows/deploy-staging.yml/badge.svg)](https://github.com/mandakan/wake-alone/actions/workflows/deploy-staging.yml)
[![Play](https://img.shields.io/badge/play-wake.urdr.dev-ffb000)](https://wake.urdr.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An ever-expanding anthology of *wake-up-alone-in-deep-space* horror choose-your-own-adventures.
Episodes are written as JSON; a single static HTML engine - **skein** - plays them. It is
deterministic: the AI writes the stories at authoring time, and nothing is generated during play.
Every branch, item, and ending is pre-written.

**Play it now at [wake.urdr.dev](https://wake.urdr.dev).**

## Screenshots

<p align="center">
  <img src="docs/screenshots/menu.png" alt="The WAKE ALONE salvage menu: amber-on-black terminal, episodes listed as numbered EP entries" width="440">
</p>

<table>
<tr>
<td width="50%"><img src="docs/screenshots/play.png" alt="A story node with the HUD showing neural integrity and inventory"></td>
<td width="50%"><img src="docs/screenshots/degraded.png" alt="The same engine at low sanity: red meter, chromatic glitch, heavy vignette"></td>
</tr>
<tr>
<td align="center"><em>In play: the HUD tracks neural integrity and inventory; med-gel buys it back.</em></td>
<td align="center"><em>Sanity degrades the screen itself - glitch, vignette, and the prose goes wrong.</em></td>
</tr>
</table>

## The premise

You wake alone in a deep-space setting - a derelict, a station, a long-haul freighter - with no
memory of how you got there and something already wrong. The horror is *attention*: the sense of
being watched, of a wrongness that waits. Dread over gore. You read, you choose, your **neural
integrity** drains as the place works on you, and you try to assemble an escape before it hits zero
and your mind goes with it.

Episodes so far:

| # | Episode | Hook |
|---|---------|------|
| 01 | **DERELICT** | Mining vessel *Kestrel-9*. You don't remember going under. |
| 02 | **VIGIL** | Listening station VIGIL. The crew didn't leave. They're just not here. |
| 03 | **TENANT** | Bulk freighter *Amaranth*. The crew left their dinner warm. |
| 04 | **BECALMED** | Generation ship *Long Patience*. Reactor cold. No one left but you. |
| 05 | **SIGNAL LOST** *(adventure)* | Relay station *Tycho-4*. One distress call, thirty-one years undelivered. |
| 06 | **WARD** | Recovery berth, freighter *Anodyne*. The voice says you are healing. The frost disagrees. |
| 07 | **GRAFT** | Auto-surgery, clinic-ship *Halcyon*. You signed for one repair. It is still working. |
| 08 | **FATHOM** | An object that returns no bearing. You were sent to measure it. |
| 09 | **FAULT** | Survey frigate *Auster*. Seven crew accounted for. The ship has never told you no. |
| 10 | **MIRROR WATCH** | Cargo hauler *Lumen*. Three months out. You are not alone. |

*SIGNAL LOST* (EP 05) is a multi-chapter **adventure**: its first chapter plays straight from the
menu, and each later chapter stays encrypted until you finish the one before it, carrying a little
state forward. Below the episodes sit three permanent **archive anomalies** - unnumbered, corrupted
entries whose text quietly churns. They are not playable; they mark the anthology as still growing,
more signal waiting to be recovered.

## How it fits together

**skein** is the engine (genre-agnostic; it plays any episode JSON). **WAKE ALONE** is the anthology
built on it. They live in one repo for now; extract `engine/` + `tools/` into a standalone `skein`
repo only if a second anthology ever needs the engine.

- **`episodes/*.json`** - the content. One file per episode (a chaptered adventure is several, grouped in `manifest.json`). Schema and creative bible in `CLAUDE.md`.
- **`tools/validate.mjs`** - the guardrail. A sanity-aware solver proves at least one *survivable*
  path reaches an escape, and it catches dangling pointers, orphans, dead ends, soft-locks (a
  required item/flag never obtainable), and misspelled gate keys. Exits non-zero on any error.
- **`tools/adventure.mjs`** - the cross-chapter contract for multi-chapter adventures: unlock conditions, the bounded flag carryover, and solver-backed continuity checks across chapters.
- **`tools/prose-lint.mjs`** - flags the mechanical tells of generated slop (non-ASCII punctuation,
  essay register, robotic cadence) so episodes read like prose, not output.
- **`tools/build.mjs`** - validates, then inlines episodes into `engine/template.html` -> `dist/`.
- **`engine/`** - the runtime. Amber-phosphor CRT/terminal aesthetic; it opens on a boot screen
  ("press any key to wake") that doubles as the gesture unlocking audio, then sanity degrades the
  screen as you play (glitch, vignette, the prose itself going wrong). Ships with `skein-audio.js` -
  a procedural, sanity-coupled soundtrack synthesised live with Tone.js, no audio files - and the
  inventory label map.
- **`vendor/tone.min.js`** - pinned Tone.js, inlined into `dist/` at build so the bundle stays one file.

## Quickstart (Node 18+, no dependencies)

```bash
npm run new -- --id orrery --title "Orrery"       # scaffold a valid episode
npm run validate                                  # check every episode
npm run build                                     # -> dist/index.html (standalone)
open dist/index.html                              # play
```

`dist/index.html` is fully self-contained (episodes inlined, fonts via CDN) - host it as a static
file anywhere, or open it directly.

## Handing authoring to Claude Code

This repo is set up so Claude Code can write new episodes in a closed loop:

1. Put the repo on your box and `git init` it.
2. `CLAUDE.md` (repo root) is read automatically as project memory - it holds the schema, the
   creative bible, and the rule *"not done until `npm run validate` exits 0"*.
3. Three invocable skills under `.claude/skills/` cover the loop: `ideate-episode` (brainstorm and
   judge a premise), `author-episode` (write the JSON against the schema and creative bible), and
   `review-episode` (an adversarial craft re-read of a finished episode). An episode can also commit
   to a generation contract via an optional `spec` block (size / punishment / escape / traces) that
   the validator then enforces.
4. Because the validator is a plain command, Claude Code runs it itself and iterates
   (generate -> validate -> fix -> build) without you in the loop.

The craft rules learned from playtest feedback live in `docs/craft-lessons.md`; the prose mode is
documented in `docs/gestalt.md`. Optional: wire `npm run validate` into a Claude Code hook so it
runs automatically after edits.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the episode workflow, the
[Conventional Commits](https://www.conventionalcommits.org) convention that drives
releases, and how staging/production deploys work.

---

[![Buy Me A Coffee](https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&slug=thias&button_colour=ffb000&font_colour=000000&font_family=Cookie&outline_colour=000000)](https://buymeacoffee.com/thias)

# WAKE ALONE

[![Release](https://github.com/mandakan/wake-alone/actions/workflows/release-please.yml/badge.svg)](https://github.com/mandakan/wake-alone/actions/workflows/release-please.yml)
[![Deploy staging](https://github.com/mandakan/wake-alone/actions/workflows/deploy-staging.yml/badge.svg)](https://github.com/mandakan/wake-alone/actions/workflows/deploy-staging.yml)
[![Play](https://img.shields.io/badge/play-wake.urdr.dev-7c3aed)](https://wake.urdr.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An ever-expanding anthology of *wake-up-alone-in-deep-space* horror choose-your-own-adventures.
Episodes are written as JSON; a single static HTML engine — **skein** — plays them. Deterministic:
the AI writes the stories at authoring time, nothing is generated during play.

**skein** is the engine (genre-agnostic, plays any episode JSON). **WAKE ALONE** is the anthology
built on it. They live in one repo for now; extract `engine/` + `tools/` into a standalone `skein`
repo only if a second anthology ever needs the engine.

## Quickstart (Node 18+, no dependencies)

```bash
npm run new -- --id tycho --title "Signal Lost"   # scaffold a valid episode
npm run validate                                  # check every episode
npm run build                                     # -> dist/index.html (standalone)
open dist/index.html                              # play
```

`dist/index.html` is fully self-contained (episodes inlined, fonts via CDN) — host it as a static
file anywhere, or open it directly.

## How it fits together

- **`episodes/*.json`** — the content. One file per adventure. Schema in `CLAUDE.md`.
- **`tools/validate.mjs`** — the guardrail. Catches dangling node pointers, orphans, dead ends,
  unreachable endings, soft-locks (required item/flag never obtainable), and misspelled gate keys.
  Exits non-zero on any error.
- **`tools/build.mjs`** — validates, then inlines episodes into `engine/template.html` -> `dist/`.
- **`engine/`** — the runtime (CRT/terminal aesthetic; sanity degrades the screen) and the
  inventory label map.

## Handing authoring to Claude Code

This repo is set up so Claude Code can write new episodes in a closed loop:

1. Put the repo on your box and `git init` it.
2. `CLAUDE.md` (repo root) is read automatically as project memory — it holds the schema, the
   creative bible, and the rule *"not done until `npm run validate` exits 0"*.
3. `.claude/skills/author-episode/SKILL.md` is the invocable procedure for "write a new episode".
4. Because the validator is a plain command, Claude Code runs it itself and iterates
   (generate -> validate -> fix -> build) without you in the loop.

Optional: wire `npm run validate` into a Claude Code hook so it runs automatically after edits.

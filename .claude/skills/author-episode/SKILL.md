---
name: author-episode
description: Write a new WAKE ALONE horror CYOA episode end to end. Use when asked to create, draft, or add a "wake up alone in space" adventure/episode to this repo. Produces a validated episodes/<id>.json and a passing build.
---

# Authoring a WAKE ALONE episode

Goal: produce one new `episodes/<id>.json` that passes `npm run validate` with zero errors and
builds cleanly, following the creative bible in `CLAUDE.md`.

## Parameters (the dials)

Ask the user (or infer from the request) the generation dials. They map to concrete thresholds
the validator enforces, defined in `tools/spec.mjs`:

- **size**: `short` (6-9 nodes, ~3-8 min), `standard` (10-16, ~7-16 min), `long` (16-24, ~15-30 min).
  If the user gives a target play-time, pick the size whose minute range contains it.
- **punishment**: `gentle` / `standard` / `cruel`. Controls the ratio of nasty endings to escapes
  and how brutal the sanity economy is. `cruel` also expects the run to be losable to madness
  (a path where sanity actually reaches 0).
- **escape**: `required` (default) / `forbidden`. If the user asks for a story with **no happy
  ending** / no way out, set `forbidden` (scaffold with `--no-escape`): every path ends in
  death or madness, and the validator allows it. Any `escape` ending then becomes an error.

These are written into the episode as a top-level `"spec"`. With a spec, node count and death
ratio become **hard errors** if missed; play-time is advisory. `build.mjs` strips `spec` from
the shipped bundle.

## Procedure

1. **Read the references first.** Read `CLAUDE.md` (creative bible + sanity economy) and
   `episodes/derelict.json` (the canonical, validated example). Match its structure and tone.

2. **Scaffold with the dials:**
   `npm run new -- --id <slug> --title "<TITLE>" --byline "<line>" --size <size> --punishment <level>`
   This emits a valid skeleton already scaled to the spec (right node count, enough dead endings,
   a gated escape). Replace the placeholder prose and structure with the real episode; keep it
   solvable. Add any new inventory item ids to `engine/item-names.json`.

3. **Plan the spine.** Decide the setting, the central wrongness, the two things from different
   branches that gate the escape (item + flag is the standard pattern), where the 1-2 `medgel`
   restores live, and the nasty endings (>= the punishment floor). Reason about the optimal escape
   path: forced sanity loss minus restores must leave the player above 0 — hard-won, not impossible.

4. **Validate in a loop until it exits 0:**
   `node tools/validate.mjs episodes/<id>.json --json`
   Read both the errors and the `report`. Fix and re-run until clean:
   - `unwinnable` -> the solver proved no survivable path reaches an escape. Lower forced sanity
     loss, add a restore, or relax a `sanityMin` gate. (The validator now PROVES solvability — do
     not hand-wave the sanity budget.)
   - `spec(...): N nodes outside ...` -> add or merge nodes to hit the size band.
   - `spec(...): death ratio / dead endings ...` -> add nasty endings to meet the punishment floor.
   - `soft-lock` -> a required item/flag is never granted. `non-existent node` -> a `to` typo.
     `unknown requires/effects key` -> a misspelled gate that silently does nothing.
   - advisory `warn`s (play-time outside the size range, cruel-but-no-madness, dead item/flag,
     dead choice) — address them unless you have a deliberate reason not to.

5. **Build and report:** run `npm run build`, then tell the user the report metrics — node count,
   reachable endings, death ratio, estimated play-time, and the best escape's surviving sanity —
   so they can judge difficulty against the dials they asked for.

## Hard constraints

- Deterministic only — never add a runtime LLM call.
- Never edit `tools/validate.mjs` or `tools/spec.mjs` to make an episode pass — fix the episode.
- All story content lives in `episodes/<id>.json`, never in the engine or `dist/`.

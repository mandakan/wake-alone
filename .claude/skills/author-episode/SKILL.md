---
name: author-episode
description: Write a new WAKE ALONE horror CYOA episode end to end. Use when asked to create, draft, or add a "wake up alone in space" adventure/episode to this repo. Produces a validated episodes/<id>.json and a passing build.
---

# Authoring a WAKE ALONE episode

Goal: produce one new `episodes/<id>.json` that passes `npm run validate` with zero errors and
builds cleanly, following the creative bible in `CLAUDE.md`.

## Procedure

1. **Read the references first.** Read `CLAUDE.md` (creative bible + sanity economy) and
   `episodes/derelict.json` (the canonical, validated example). Match its structure and tone.

2. **Plan before writing.** Decide: the setting, the central wrongness, the two things that gate
   the escape ending, where the 1–2 `medgel` restores live, and the forced sanity cost of the
   intended good path. Sketch the node graph (hub + branches + gated exit) before emitting JSON.

3. **Scaffold:** `npm run new -- --id <slug> --title "<TITLE>" --byline "<line>"`, then replace
   the skeleton nodes with the real episode. Add any new inventory item ids to
   `engine/item-names.json`.

4. **Self-check the budget.** Walk the optimal escape path and add up onEnter + choice sanity
   deltas minus medgel restores. If it can drop to 0 before the escape ending, rebalance — the
   validator will NOT catch an unwinnable-by-sanity episode.

5. **Validate and fix:** run `npm run validate`. Resolve every ERROR. Re-read each ERROR literally —
   "non-existent node" means a `to` typo; "soft-lock" means a required item/flag is never granted;
   "unknown requires key" means a misspelled gate that silently does nothing.

6. **Build and report:** run `npm run build`, then tell the user the node count, the reachable
   endings, and the sanity cost of the good path so they can judge difficulty.

## Hard constraints

- Deterministic only — never add a runtime LLM call.
- Never edit `tools/validate.mjs` to make an episode pass.
- All story content lives in `episodes/<id>.json`, never in the engine or `dist/`.

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

## The protagonist (who you are - drives hint calibration)

Ask the user (or decide) who the protagonist is, and record it as a top-level `"character"` block:

```json
"character": { "role": "ship's maintenance engineer", "expertise": ["power systems", "hull", "life support", "hand tools"], "backstory": "..." }
```

This is the single most important input for **how hints and descriptions are written** (lesson L4 in
`docs/craft-lessons.md`):
- **In-domain** (anything in `expertise` - their "backyard"): they know it. Name tools and systems;
  when a key tool/step is missing for an action they would obviously know, hint it specifically (the
  `locked` text may name what is missing).
- **Out-of-domain**: gestalt only - shape, weight, dread - never function, never operating hints,
  never what part is missing. The character's ignorance is part of the horror.
- `backstory` shapes voice and what they notice/fear/assume, but should surface **indirectly** - do
  not dump it into the prose. It often never appears verbatim.

Like `spec`, the `character` block is validated for shape, reported by `validate`, and stripped at
build (it never ships). If the user gives no protagonist, pick a plausible role for the setting and
state your assumption.

## Procedure

1. **Read the references first.** Read `CLAUDE.md` (creative bible + sanity economy),
   `docs/craft-lessons.md` (the feedback ledger - every rule learned from user/playtester feedback;
   honor all of them), `docs/gestalt.md` (the default prose mode - evoke with charged fragments, let
   the reader complete the picture; describe less), `docs/inspiration.md` (the public-domain source
   bible - craft rules and
   motifs; inspiration only, never verbatim, never named IP), `docs/style-cards.md` (distilled prose
   technique per source), and `episodes/derelict.json` (the canonical, validated example). The
   `corpus/` folder holds a few complete PD reference texts - study them for cadence and structure,
   but never copy phrasing (see `corpus/SOURCES.md`). Match the house tone.

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
   - prose `ERROR`s -> non-ASCII punctuation or a doubled `--` (use a single hyphen `-` for dashes;
     straight quotes; `...`) or essay-register slop (`delve`, `leverage`, `seamless`, ...). Rewrite
     in the sparse second-person voice.
     `npm run lint episodes/<id>.json` runs the prose checks alone.
   - advisory `warn`s (play-time outside the size range, cruel-but-no-madness, dead item/flag,
     dead choice, horror cliches, robotic cadence, first-person slips, never-shown sanityText,
     state-incoherent "your <item>") — address them unless you have a deliberate reason not to.

   Write to avoid slop in the first place: vary sentence length, cut filler and cliche, stay in
   second person, and prefer concrete specific detail over generic atmosphere. After a draft, a
   `clean-prose` pass over each text field catches what the linter can't.

5. **Final read against the ledger.** Re-read the episode against `docs/craft-lessons.md` - every
   lesson must hold (especially: legible endings whose cause and mechanic are explicit; single-hyphen
   dashes; gated choices written as one positive-gate choice with a `to` and a `locked` hint). Fix
   anything that does not.

6. **Build:** run `npm run build`. Note the report metrics - node count, reachable endings, death
   ratio, estimated play-time, and the best escape's surviving sanity.

7. **Craft review (auto), then report.** Run the **`review-episode`** skill in auto mode on the
   freshly built episode - it is the single source of truth for the lenses (ending legibility,
   gestalt + hint calibration, slop beyond the linter, tension + coherence), the findings format,
   and the triage rules; do not restate them here. It reports only; it never edits the episode.
   Read the merged findings and re-enter the step-4 validate-fix loop until every `block` and
   `craft-warn` finding is resolved or you can explicitly justify why it stands (the same posture
   you take toward validator `warn`s). Then give the user the final report: the step-6 metrics plus
   a short summary of what the review raised and how each item was resolved. If a finding carries a
   `proposedLesson`, surface it for the user to approve - never auto-append it to the ledger.

## When the user gives feedback on a story

Capture it so it cannot recur. Add a numbered lesson to `docs/craft-lessons.md` (what was said, the
rule, how it is enforced). If it can be checked by code, add a `prose-lint`/`validate` rule plus a
self-test; if it is a durable preference, also save it to agent memory. Then apply the fix.

## Hard constraints

- Deterministic only — never add a runtime LLM call.
- Never edit `tools/validate.mjs` or `tools/spec.mjs` to make an episode pass — fix the episode.
- All story content lives in `episodes/<id>.json`, never in the engine or `dist/`.

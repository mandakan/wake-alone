# Chaptered adventures (reverse-chronology ready) — design

Date: 2026-06-11
Issue: #3 (Chaptered, reverse-chronology adventures with cross-chapter carryover)
Scope: phases 1+2 of the issue — mechanics, carryover, validation. Authoring the first
real adventure (and its craft lesson) is a separate follow-up.

## Goal

Let the manifest group ordered chapters into an "adventure": each chapter is an ordinary
episode JSON, later chapters stay encrypted on the menu until the previous chapter is
completed, and a bounded set of flags plus the previous ending's identity carries forward.
Everything stays a single static file: progress lives in `localStorage`, no backend, no
runtime AI. Reverse chronology is an authoring convention, not an engine concept — the
engine just plays chapters in declared order.

## Data model (manifest.json)

A new manifest entry shape, alongside the existing playable / locked / anomaly shapes:

```jsonc
{
  "adventure": "tycho",                    // adventure id (slug)
  "title": "SIGNAL LOST",
  "byline": "Relay station Tycho-4. The distress call is in your own voice.",
  "chapters": [
    { "file": "tycho-last.json",
      "exports": ["heard_the_voice"] },    // flags offered downstream (cap: 4)
    { "file": "tycho-first.json",
      "unlock": "any",                     // see unlock forms below
      "imports": ["heard_the_voice", "prior_escape"] }
  ]
}
```

- Each `file` is a normal episode in `episodes/` that must validate standalone.
- The whole cross-chapter contract (order, unlock, exports, imports) lives here, in one
  place. Episode JSONs gain no new fields.
- An adventure needs at least 2 chapters. Chapter 1 takes no `unlock`/`imports`.
- Adventures are non-anomaly entries: they must precede the anomaly placeholders, same as
  every other entry (existing manifest-order rule).

### Unlock forms (per chapter, evaluated against the previous chapter's recorded completion)

- `"any"` (default when omitted): any recorded ending — escape, dead, or madness. Deaths
  still reveal story; progress never hard-blocks.
- `{ "ending": "<nodeId>" }`: the previous run ended at this specific ending node.
- `{ "type": "escape" | "dead" | "madness" }`: the previous run's ending type matches.
- `{ "flag": "<flag>" }`: the previous run exported this flag (must appear in the previous
  chapter's `exports`).

### Carryover

- `exports`: up to 4 flag names per chapter (hard cap). At the moment a run reaches an
  ending, the engine records which of the declared exports are set in `state.flags`.
- Ending identity is recorded automatically (type + ending node id) and surfaced to the
  next chapter as reserved flags: `prior_escape` / `prior_dead` / `prior_madness`, plus
  `prior_end_<endingNodeId>`. Reserved names cost nothing against the export cap.
- `imports`: the flags the next chapter reads. Must be a subset of the previous chapter's
  `exports` plus the reserved `prior_*` names. Imported flags are preset in `state.flags`
  when the chapter starts (only those actually recorded as set).
- Baseline-solvability rule: imports may only gate optional "you understand this now"
  beats. Every chapter must reach a survivable escape with zero imports (unless its own
  `spec.escape` is `forbidden`). A player whose previous run exported nothing must never
  be soft-locked.

## Engine runtime

### Persistence

New `localStorage` key `skein_progress_v1`:

```jsonc
{ "<adventureId>": {
    "<chapterEpisodeId>": { "type": "escape", "node": "out", "flags": ["heard_the_voice"] }
} }
```

Written from the ending funnel (`renderEnding` and `renderMadness`, next to the existing
`recordScar`) whenever the finished episode is an adventure chapter. Only the most recent
completion per chapter is kept (same policy as scars). Scars themselves keep working
unchanged — chapters are ordinary episodes with ids.

### Menu and routing

- The adventure renders as one numbered card on the main menu (one `epNo` slot), styled
  like a playable card plus a progress line (e.g. `1/2 SEGMENTS RECOVERED`). Clicking it
  routes to a chapter-select screen.
- Hash routing extends the current scheme: `#<adventureId>` shows the chapter screen;
  chapters route by their episode id (`#<chapterId>`) like any episode, but guarded — an
  unmet unlock falls back to the chapter screen.
- The chapter screen lists chapters in declared order. Unlocked chapters render as
  playable cards; locked ones reuse the existing `.epcard.locked` encrypted styling
  (title bracketed, `// ENCRYPTED`, inert). Completed chapters show their scar line.
- Finishing a chapter returns to the chapter screen, not the main menu — the newly
  decrypted next chapter is the payoff moment.
- The chapter screen carries a `PURGE RECORD` affordance: two-step confirm, clears that
  adventure's progress only (and nothing else in `localStorage`).

### Run start

`startEpisode` for a chapter with `imports` seeds `state.flags` from the stored record of
the previous chapter (declared imports that were recorded as set, plus the reserved
`prior_*` flags derived from the stored ending). Everything downstream — `requires.flag`,
`sanityText`, the watcher — works untouched.

## Build (tools/build.mjs)

Adventure entries are expanded at build time: each chapter file is read, validated (with
its declared imports passed through so flag-obtainability checks accept them), stripped of
`spec`/`character` like any episode, and inlined as

```js
{ adventure: true, id, title, byline,
  chapters: [ { unlock, exports, imports, ...fullEpisode } ] }
```

inside the existing `EPISODES` array. Manifest ordering passes through untouched. Episode
ids must be unique across the whole bundle — top-level and chapters — since routing is by
id (hard error at build/validate).

## Validation (new tools/adventure.mjs + hooks in tools/validate.mjs)

Follows the `spec.mjs` pattern: a module that resolves and checks the declaration, called
from the whole-manifest pass in `validate.mjs` (single-file runs skip it, like the
existing manifest-order check). Hard `ERROR`s:

- malformed adventure entry: missing/duplicate adventure id, fewer than 2 chapters,
  missing chapter file, unknown unlock form, `unlock`/`imports` on chapter 1;
- export cap exceeded (more than 4 per chapter);
- an import not covered by the previous chapter's `exports` + reserved `prior_*` names;
- `prior_end_<nodeId>` naming a node that is not a reachable ending of the previous
  chapter; `{ "ending": ... }` unlock naming a non-ending or unreachable node;
- `{ "type": "escape" }` unlock after a chapter whose `spec.escape` is `forbidden`;
- an exported flag the previous chapter can never have set at any reachable ending
  (solver-backed); episode id collisions;
- chapter not solvable with imports off (the baseline-solvability rule — this is the
  universal survivable-escape rule, re-checked under the carryover contract).

Advisory `warn`s:

- a declared export no import ever reads (dead export);
- a declared import no `requires`/`sanityText` gate ever reads (dead import);
- an import that opens nothing the solver can see (dead carry-gate).

Mechanics needed in `validate.mjs`:

- export `solve` and extend it to accept seed flags (`solve(ep, useGel, seedFlags = [])`)
  and to report the union of flags observed at each reachable ending (`endingFlags`), so
  exportability and unlock reachability are solver-backed;
- `validateEpisode` accepts declared imports and treats them as obtainable, so a chapter
  validates standalone without "flag never set" false positives. Each chapter is solved
  twice: imports off (baseline solvability) and imports on (coherence + dead-import
  detection).

Narrative continuity anchors (a log written in chapter 2 and read in chapter 1, an item's
placement) stay judgment-tier, handled by the `review-episode` skill — not mechanically
checked in this phase.

## Testing

- New `tools/adventure.test.mjs` wired into `npm test`, following the inline-fixture
  `check()`/`hasErr()`/`hasWarn()` pattern: a clean 2-chapter adventure, each hard error
  above, each warn, the seeded-solver behavior, and the export-cap boundary.
- Existing `validate.test.mjs` gains cases for the `solve` signature extension and the
  imports-aware `validateEpisode`.
- Engine behavior is playtested with a temporary 2-chapter test adventure built into
  `dist/index.html` and driven with the Playwright browser tools: locked chapter renders
  encrypted, completing chapter 1 unlocks chapter 2, imported flag gates a beat, ending
  identity flags arrive, `PURGE RECORD` resets, progress survives a reload. The temporary
  adventure is removed before merge and the build re-verified.

## Documentation

- `CLAUDE.md`: the adventure manifest shape, unlock forms, carryover rules, and the
  baseline-solvability rule join the schema section.
- `README.md`: a short note in "How it fits together".

## Out of scope (follow-up, issue phase 3)

- Authoring the first real reverse-chronology adventure (2-3 chapters) through the
  ideate/author/review skill loop, and replacing the `tycho` locked placeholder with it.
- The reverse-chronology craft lesson (next free number: L18) and any `author-episode`
  skill updates.
- Scaffolding support in `tools/new.mjs` for adventures.
- Cross-device progress sharing (out: `localStorage` is per-browser by design).

## Files

- `episodes/manifest.json` — new adventure entry shape (test fixture only in this phase)
- `engine/template.html` — chapter screen, unlock gating, progress store, flag seeding,
  purge affordance
- `tools/build.mjs` — adventure expansion + id-uniqueness
- `tools/adventure.mjs` — new: contract resolution + cross-chapter checks
- `tools/validate.mjs` — `solve` export/extension, imports-aware `validateEpisode`,
  whole-manifest adventure pass
- `tools/adventure.test.mjs` — new; `tools/validate.test.mjs` — extended
- `CLAUDE.md`, `README.md` — docs

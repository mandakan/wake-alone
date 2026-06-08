# WAKE ALONE — project guide for Claude Code

This repo is an anthology of **deterministic** choose-your-own-adventure horror episodes.
A human (or you) authors each episode as a JSON file; a single static HTML engine — **skein** —
plays it. (The engine is *skein*; the anthology built on it is *WAKE ALONE*. Same repo for now.)
There is **no live AI at runtime** — every branch, item, and ending is pre-written.

## The one rule that matters

**An episode is not done until `npm run validate` exits 0.**
After creating or editing any episode, run it and fix every `ERROR` before moving on.
`warn` lines are advisory; `ERROR` lines are hard failures. Never hand back an episode
with validation errors, and never edit the validator to make an episode pass.

## Repo map

```
episodes/
  manifest.json     ordering + locked placeholders (the menu)
  *.json            one file per episode (the content you write)
engine/
  template.html     the runtime; do not put story content here
  item-names.json   inventory id -> display label (add new items here)
tools/
  validate.mjs      node tools/validate.mjs  (the guardrail)
  build.mjs         node tools/build.mjs     (validates, then inlines -> dist/index.html)
  new.mjs           node tools/new.mjs --id x --title "..."  (valid skeleton)
dist/index.html     build output: standalone, open directly in a browser
```

## Workflow to add an episode

1. `npm run new -- --id <slug> --title "<TITLE>" --byline "<one line>"`
   (optionally `--size short|standard|long --punishment gentle|standard|cruel` to scaffold against
   a generation spec — see Generation dials below; or copy `episodes/derelict.json` as a reference).
2. Author the nodes (schema below).
3. For every new inventory item id, add a label to `engine/item-names.json`.
4. `npm run validate` — fix all ERRORs.
5. `npm run build` — produces `dist/index.html`.
6. Open `dist/index.html` to playtest. Confirm at least one path reaches an escape ending
   and that sanity along the intended "good" path stays survivable (see Sanity economy).

## Schema (authoritative reference is the bottom of `engine/template.html`)

```jsonc
{
  "id": "slug", "title": "TITLE", "byline": "one line shown on the menu",
  "spec": { "size": "standard", "punishment": "standard" }, // optional; see Generation dials. Stripped at build.
  "start": "nodeId", "startSanity": 100, "startInventory": [],
  "nodes": {
    "nodeId": {
      "title": "HUD location label",          // optional
      "text": "<p>narrative html</p>",
      "sanityText": { "40": "<p>shown when sanity <= 40 (lowest match wins)</p>" }, // optional
      "onEnter": { "sanity": -10, "add": ["x"], "remove": ["y"], "flags": { "k": true } }, // applied once
      "choices": [
        { "text": "...", "to": "nodeId",
          "requires": { "item": "", "notItem": "", "flag": "", "notFlag": "", "sanityMin": 0, "sanityMax": 100 },
          "effects": { "sanity": -10, "add": [], "remove": [], "flags": {} },
          "locked": "disabled text shown when requirements unmet (omit to hide the choice instead)" }
      ],
      "ending": { "type": "escape|dead|madness", "stamp": "// TEXT", "text": "<p>...</p>" } // terminal node
    }
  }
}
```

What the validator enforces (so design around it): every `to` resolves; no orphan/unreachable
nodes; every non-ending node has a real exit; at least one ending is reachable; any item/flag
named in `requires` must be obtainable somewhere; `requires`/`effects` keys must be spelled
correctly.

It also runs a **sanity-aware solver** that mirrors the engine runtime (onEnter fires once,
sanity clamps 0–100, sanity ≤ 0 at a non-ending point is instant madness, med-gel is a free
+25 action usable at any node). The solver enforces, as hard `ERROR`s:
- **Solvability:** at least one *survivable* path must actually reach an `escape` ending — not
  just be reachable on the map. An episode that is winnable-on-paper but forces madness on every
  route fails. (`npm run validate` reports the best escape's surviving sanity and step count.)

And as advisory `warn`s: too few reachable `dead` endings (a horror episode should offer a
few — see Endings below), dead choices (a `requires` that never opens), and dead items/flags
(obtained or set but never read by any gate).

The solver is itself covered by `npm test` (fixture episodes with known verdicts). Don't weaken
it to pass an episode; fix the episode.

## Creative bible (keep episodes consistent)

- **Premise:** the protagonist wakes alone in a deep-space setting (derelict, station, lab,
  long-haul freighter, generation ship). Each episode is a new setting; they don't share state.
- **Voice:** second person, present-leaning, sparse. Dread over gore. The horror is *attention* —
  the sense of being watched, of a wrongness that waits. Avoid splatter and avoid jump-scare prose.
- **Length:** ~10–16 nodes. One hub the player returns to, 3–4 explorable branches, a gated exit.
- **Endings:** at least one `escape` (survival, hard-won) and a *few* `dead` endings — the
  validator warns below two nasty deaths. `madness` is automatic when sanity hits 0 — you don't
  author it.
- **Sanity economy (start 100):** minor unease −5 to −10; a real scare −12 to −18; a major reveal
  or the central horror −20 to −35. Provide 1–2 `medgel` items (+25 each, consumed) on the map.
  Reason explicitly about the optimal path: total forced sanity loss minus available restores must
  leave the player above 0 at the escape ending, or the episode is unwinnable.
- **Gating:** the escape ending should require at least two things assembled from different branches
  (an item + a flag is the standard pattern, as in `derelict`: `keycard` + `power`).

## Generation dials (optional `spec`)

An episode may declare `"spec": { "size", "punishment" }` to commit to a generation contract that
the validator then enforces. The dials and their thresholds live in `tools/spec.mjs`:

- **size** — `short` (6–9 nodes), `standard` (10–16), `long` (16–24). Node count is a hard floor;
  play-time (derived from word count + the solver's optimal path) is advisory per size.
- **punishment** — `gentle` / `standard` / `cruel`. Sets the death-ratio floor (reachable `dead`
  endings ÷ all reachable endings) and the minimum count of nasty endings; `cruel` also expects
  madness to be reachable. Death ratio and dead-ending count are hard floors.

With a `spec`, missing a hard floor is an `ERROR`. Without one, only the universal rules apply
(solvable, ≥2 nasty endings advised). The `author-episode` skill drives these dials end to end.

## Don't

- Don't add story content to `engine/template.html` or `dist/`.
- Don't introduce a runtime LLM call — this engine is deterministic by design.
- Don't weaken `tools/validate.mjs` to pass an episode.

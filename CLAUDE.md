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
  skein-audio.js    procedural sanity-coupled ambience (no audio assets; Tone.js)
vendor/
  tone.min.js       pinned Tone.js (see vendor/README.md); inlined at build
tools/
  validate.mjs      node tools/validate.mjs  (the guardrail)
  adventure.mjs     cross-chapter contract for chaptered adventures (unlock + carryover)
  build.mjs         node tools/build.mjs     (validates, then inlines -> dist/index.html)
  new.mjs           node tools/new.mjs --id x --title "..."  (valid skeleton)
  audio-bench.html  open directly: tune skein-audio constants by ear
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
  "spec": { "size": "standard", "punishment": "standard", "escape": "required" }, // optional; see Generation dials. Stripped at build.
  "character": { "role": "...", "expertise": ["..."], "backstory": "..." }, // optional; drives hint calibration (see below). Stripped at build.
  "watching": ["UPPERCASE MACHINE LINE.", "..."], // optional; intrusive lines the engine flashes at CRITICAL/TERMINAL sanity. Shipped (not stripped). In-voice, ASCII only.
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
- **No stat-tax self-loops (L11):** a choice that costs sanity must not loop back to its own
  node — route the cost through a one-shot payoff node that shows what it bought.

And as advisory `warn`s: too few reachable `dead` endings (a horror episode should offer a
few — see Endings below), dead choices (a `requires` that never opens), dead items/flags
(obtained or set but never read by any gate), a near-costless escape (L14: the optimal
escape route should force ~20+ sanity loss, med-gel ignored — the climax must have teeth),
and a re-enterable start node (L13: anything routing back to `start` replays its wake-up
prose on every return — make the start a one-shot intro feeding a state-neutral hub).

The solver is itself covered by `npm test` (fixture episodes with known verdicts). Don't weaken
it to pass an episode; fix the episode.

It also runs a **prose linter** (`tools/prose-lint.mjs`) over every text field to keep episodes
from reading like generated slop. Hard `ERROR`s: non-ASCII punctuation (em-dash, curly quotes,
ellipsis - the top LLM tells) and doubled dashes (stories use a single hyphen `-`; house style is
ASCII, calibrated to `derelict`), and essay/marketing register (`delve`, `leverage`, `seamless`, ...). Advisory `warn`s: horror cliches, robotic cadence
(uniform sentence length, repeated openers, "X, Y, and Z" triads, copy-pasted phrases, an
over-used "the way X" simile scaffold — L15), first-person slips outside quoted speech, plus three
solver-backed coherence checks -- a `sanityText` variant that can never display, prose that
says "your <item>" where the player can't hold it, and a stale pickup room (L13: a node whose
`text`/`sanityText` still names an item its own choice adds, when the player can re-enter already
carrying it — describe the fixture in the room text; let the self-hiding take-choice name the item).

## Creative bible (keep episodes consistent)

> For inspiration sources -- public-domain works to draw the haunted-ship feeling from, with
> per-source craft takeaways and a strict no-verbatim/no-named-IP rule -- see `docs/inspiration.md`.


- **Premise:** the protagonist wakes alone in a deep-space setting (derelict, station, lab,
  long-haul freighter, generation ship). Each episode is a new setting; they don't share state.
- **Voice:** second person, present-leaning, sparse. Dread over gore. The horror is *attention* —
  the sense of being watched, of a wrongness that waits. Avoid splatter and avoid jump-scare prose.
- **Gestalt by default:** evoke, do not catalogue. Give a few charged, specific fragments (a glove
  palm-up, a face wearing only *attention*) and let the reader assemble the whole - it is scarier
  and more theirs. Name the *effect*, not the thing; one controlling image, not three; sensation
  over specification. This is the default mode for every room, body, and presence - not vagueness
  (be specific) but omission from knowledge. See `docs/gestalt.md`.
- **Length:** ~10–16 nodes. One hub the player returns to, 3–4 explorable branches, a gated exit.
- **Endings:** by default at least one `escape` (survival, hard-won) and a *few* `dead` endings —
  the validator warns below two nasty deaths. `madness` is automatic when sanity hits 0 — you don't
  author it. A deliberate no-way-out episode can drop the escape entirely via
  `spec.escape = "forbidden"` (see Generation dials).
- **Sanity economy (start 100):** minor unease −5 to −10; a real scare −12 to −18; a major reveal
  or the central horror −20 to −35. Provide 1–2 `medgel` items (+25 each, consumed) on the map.
  Reason explicitly about the optimal path: total forced sanity loss minus available restores must
  leave the player above 0 at the escape ending, or the episode is unwinnable.
- **Gating:** the escape ending should require at least two things assembled from different branches
  (an item + a flag is the standard pattern, as in `derelict`: `keycard` + `power`).
- **Hint calibration (role-relative):** write hints and object descriptions against the protagonist's
  `character.expertise`. In-domain ("their backyard"): name tools/systems and hint a missing tool for
  an action they'd obviously know. Out-of-domain: gestalt only - shape and dread, never function or
  operating hints. The character's ignorance is part of the horror. See lesson L4 in
  `docs/craft-lessons.md`. The optional `character` block is the input; its `backstory` surfaces only
  indirectly.

## Generation dials (optional `spec`)

An episode may declare `"spec": { "size", "punishment" }` to commit to a generation contract that
the validator then enforces. The dials and their thresholds live in `tools/spec.mjs`:

- **size** — `short` (6–9 nodes), `standard` (10–16), `long` (16–24). Node count is a hard floor;
  the ceiling is an advisory warn (never cut real content to fit a number — if the story keeps
  growing, declare the next size up). Play-time (derived from word count + the solver's optimal
  path) is advisory per size.
- **punishment** — `gentle` / `standard` / `cruel`. Sets the death-ratio floor (reachable `dead`
  endings ÷ all reachable endings) and the minimum count of nasty endings; `cruel` also expects
  madness to be reachable. Death ratio and dead-ending count are hard floors.
- **escape** — `required` (default) / `forbidden`. `required` means a survivable escape must
  exist (the universal rule). `forbidden` is a no-way-out story: any `escape` ending is an
  `ERROR`, but it must still be completable (some death/madness ending stays reachable). Scaffold
  one with `--no-escape` (or `--escape forbidden`).
- **traces** — optional: `absent` / `restrained` / `forward`. How hard the death-evidence bites
  (lesson L17's register ladder). `absent` is a deliberate Mary Celeste no-evidence episode;
  `restrained` states what happened (counter-facts, no forward motion); `forward` leaves the
  systems still mid-task (a request pending, a setting offered to the player). Every rung must
  pass the read-aloud test: innocent surface, horrific inference - effects, never wounds. The
  enum is a hard `ERROR` if misspelled; conformance to the rung is judgment (author + reviewer).
- **sanityRegister** — optional: `wrong` (default) / `psychotic`. Which grammar the `sanityText`
  degrade runs on (lesson L18's band ladder). `wrong` is the Gilman mode every episode already
  uses: the same space re-read as off, then wrong. `psychotic` re-reads it as *meant* — reference
  (fires high: arranged, addressed, at you), record (mid: thoughts taken down, a half-beat late),
  command (low: an obeyed voice in the character's own register). The narrator stays lucid the
  whole way down — only the premise is corrupt; word salad fails the register. Opt-in only. The
  enum is a hard `ERROR` if misspelled; the guardrails are judgment (L18's four checks, run by
  the `author-episode` final read).

With a `spec`, missing a hard floor is an `ERROR`. Without one, only the universal rules apply
(solvable with at least one survivable escape, ≥2 nasty endings advised). The `author-episode`
skill drives these dials end to end.

## Adventures (chaptered episodes)

The manifest may group ordered chapters into an adventure (issue #3; spec in
`docs/superpowers/specs/2026-06-11-chaptered-adventures-design.md`):

```jsonc
{ "adventure": "arc", "title": "...", "byline": "...",
  "chapters": [
    { "file": "arc-one.json", "exports": ["saw_it"] },             // cap: 4 flags
    { "file": "arc-two.json", "unlock": "any", "imports": ["saw_it", "prior_escape"] }
  ] }
```

Each chapter is an ordinary episode that must validate standalone. Later chapters
stay encrypted on the menu until the previous chapter's recorded completion
satisfies their `unlock` ("any" | `{"ending": id}` | `{"type": t}` | `{"flag": f}`).
On completion (madness included) the engine records the ending's identity and which
declared `exports` the run set (`skein_progress_v1` in localStorage); the next
chapter's `imports` are preset as flags, plus the reserved `prior_escape` /
`prior_dead` / `prior_madness` / `prior_end_<nodeId>`. The hard rule: **imports may
only gate optional beats** -- every chapter must still reach a survivable escape
with zero imports (`tools/adventure.mjs` + the solver enforce the whole contract;
chapter ids share one namespace with episode and adventure ids). Reverse
chronology is the house authoring convention for adventures, not an engine rule.

## Don't

- Don't add story content to `engine/template.html` or `dist/`.
- Don't introduce a runtime LLM call — this engine is deterministic by design.
- Don't weaken `tools/validate.mjs` to pass an episode.

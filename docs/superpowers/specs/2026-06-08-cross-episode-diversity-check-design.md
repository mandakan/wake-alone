# Cross-episode diversity check - design

Date: 2026-06-08
Status: approved, pre-implementation

## Problem

The WAKE ALONE anthology shares a deliberately narrow premise ("wake alone in deep
space"), so episodes drift toward sameness - most of all in their openings, which all
hit the wake / cold / alone / watched beat. There is also literal line reuse: WARD
intentionally echoes DERELICT's "Not pain. Not fear. Only attention." Some of this is a
feature (the house "attention" theme is an intentional anthology thread); some is lazy
convergence. Nothing currently measures it.

The existing `prose-lint.mjs` catches copy-pasted phrases *within* one episode. We want
the same idea lifted to the *corpus* level: flag episodes that are too similar to each
other, with the opening treated as the priority.

## Goals / non-goals

- Catch (a) distinctive phrases reused across episodes and (b) near-identical openings.
- Stay **zero-dependency, deterministic, CI-friendly** - a sibling of `prose-lint.mjs`.
- **Advisory only**: warnings, never errors. It must never gate the build.
- **Tunable**: every threshold in one config module.
- **Disable-able**: one `enabled` switch removes it everywhere, including CI.
- Distinguish intentional motifs from lazy repetition via a curated allowlist.

Non-goals: semantic / embedding similarity (rejected - needs a model/API, breaks the
zero-dep deterministic ethos). Catching fully-reworded shared gestalt is explicitly out
of scope for this lexical version.

## Components

### 1. `tools/diversity.mjs` (new, zero-dep)

Exports `checkDiversity(episodes, config, allowlist) -> { warnings: string[] }`.
Returns **warnings only** - there is no error channel. Pure function over already-parsed
episode objects; no filesystem access inside the core (the CLI/loader does I/O).

Also a CLI: `node tools/diversity.mjs [episodes/foo.json ...]`. With no args it loads
every non-locked episode from `episodes/manifest.json`. Standalone output is a human
report: the pairwise opening-similarity matrix plus the list of flagged shared phrases.

"Narrative prose" of an episode = the same fields `prose-lint.nodeFields` treats as
narrative: `node.text`, each `node.sanityText[*]`, and `node.ending.text`. Choice
`text`/`locked` are navigation UI and are **excluded** (a hub legitimately repeats "Back
to the room" etc.). Tokenization matches prose-lint: strip HTML tags, lowercase, words =
`/[A-Za-z'-]+/g`.

### 2. Signal 1 - shared distinctive phrases (all narrative prose)

- For each episode, build the **set** of N-gram shingles (default N=4) over its
  concatenated narrative tokens. A set (not a multiset) because intra-episode repetition
  is already prose-lint's job; here we only care whether a phrase crosses episodes.
- Document frequency `df(shingle)` = number of episodes whose set contains it.
- **Suppression** (a shingle is ignored when):
  - all its tokens are in the built-in STOPWORDS set (common English + premise words like
    wake/woke/cold/dark/alone/ship/cryo/airlock), or
  - any allowlist phrase is a substring of the shingle's joined string.
- **Flag** every non-suppressed shingle with `df >= phraseMinEpisodes` (default 2):
  `warn diversity: phrase "not pain not fear" shared by derelict, ward`.

### 3. Signal 2 - opening similarity (strict)

- **Opening extraction** (deterministic): start at `episode.start`; repeatedly append the
  current node's stripped narrative `text`, then follow `choices[0].to`; stop when an
  ending node is reached, a node repeats, or accumulated words `>= openingWords`
  (default 120). Endings have no choices, non-ending nodes always have a `choices[0].to`
  (the validator guarantees both), so the walk always terminates.
- **Vectorize** the openings with TF-IDF over the opening corpus: `tf` = token count in
  the opening, `idf = log(N / df_token)`. idf naturally down-weights premise words because
  they appear in every opening (high df -> ~0 idf), so no manual premise stoplist is needed
  for this signal.
- **Cosine** similarity for every episode pair. Flag pairs `>= openingWarnAt`
  (default 0.55, to be calibrated against the current corpus):
  `warn diversity: openings "ward" ~ "derelict" similar (cosine 0.71)`.

### 4. `tools/diversity-config.mjs` (new) - tuning + kill switch

```js
export const DIVERSITY = {
  enabled: true,        // master switch - false removes it everywhere, incl. CI
  shingleN: 4,          // Signal 1 phrase length
  phraseMinEpisodes: 2, // Signal 1: flag a distinctive shingle shared by >= this many
  openingWords: 120,    // Signal 2: how much counts as "the opening"
  openingWarnAt: 0.55,  // Signal 2: cosine threshold (calibrate against corpus)
};
```

Mirrors `spec.mjs`: one place for every dial, imported by both the tool and any tests.

### 5. `tools/diversity-allow.txt` (new) - intentional motifs

Plain text, one phrase per line, `#` starts a comment, blank lines ignored. Lowercased
and trimmed on load. Seed contents:

```
# Intentional anthology motifs - allowed to recur across episodes.
attention        # the house "horror is attention" theme
wake alone
woke alone
```

`not pain not fear` is deliberately NOT listed, so it keeps flagging until a human decides
homage-or-reword.

### 6. Integration into `validate.mjs` (one guarded call)

In the full-corpus path only (invoked with no file args, i.e. validating the whole
manifest), after the per-episode results are built:

```js
import { DIVERSITY } from "./diversity-config.mjs";
import { checkDiversity, loadAllowlist } from "./diversity.mjs";
// ... corpus mode, after per-episode validation:
if (DIVERSITY.enabled && episodes.length >= 2) {
  const { warnings } = checkDiversity(episodes, DIVERSITY, loadAllowlist());
  // emit as a corpus-level advisory section (not attributed to one episode)
}
```

Single-file `validate episodes/x.json` skips it (the check needs the whole set). Because
validate's exit code is driven only by ERRORs, these advisory warnings show up in CI logs
on every PR/push but never fail the build. `enabled:false` skips the call entirely.

`package.json`: add `"diversity": "node tools/diversity.mjs"`.

### 7. Self-tests - `tools/diversity.test.mjs`, wired into `npm test`

Synthetic in-memory episode objects (no fixtures on disk needed):
- two near-identical openings -> expect an opening warning;
- a shared phrase that IS allowlisted -> expect no phrase warning;
- a shared phrase that is NOT allowlisted -> expect a phrase warning;
- wholly distinct episodes -> expect zero warnings;
- `enabled` semantics / threshold edges as needed.

### 8. Ledger + memory

This feature is the enforcement of a new craft lesson. Add **L5** to
`docs/craft-lessons.md`: "Episodes must be lexically distinct from one another, openings
most of all; intentional shared motifs live in an allowlist. Enforced by
`tools/diversity.mjs` (advisory) + the allowlist." Save the durable preference to agent
memory.

## Calibration

`openingWarnAt` ships at 0.55 as a starting guess. During implementation, run the
standalone report over the current 5 episodes and adjust so ward<->derelict flags iff
they are genuinely close while the other pairs stay quiet. Record the chosen value and the
observed matrix in the implementation notes. All dials remain user-tunable afterward.

## Out of scope / future

- Semantic similarity (embeddings) to catch reworded gestalt - a possible later opt-in
  local pass, not built now.
- Promoting any of this from advisory to a hard gate - explicitly deferred until the
  signal proves useful and well-tuned.

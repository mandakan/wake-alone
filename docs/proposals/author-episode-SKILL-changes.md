# Proposed changes to .claude/skills/author-episode/SKILL.md

Intent: split design from prose, replace the bulk-rules context with exemplars + the
distilled checklist, and make the prose render a distinct pass. Presented as edits per
section; apply as a normal PR.

## 1. Step 1 (read the references) - REPLACE

Current step 1 front-loads CLAUDE.md + 4 docs + the full ledger + an episode + corpus.
Replace with staged reading:

> 1. **Read for this phase only.**
>    - Design phase: `CLAUDE.md` (bible + sanity economy), `docs/inspiration.md`
>      (motif wells), and the `design` block spec (`docs/episode-design-block.md`).
>    - Prose phase: `docs/generation-checklist.md` (the distilled rules),
>      `docs/gold-lines.md` (the register - load verbatim), `docs/gestalt.md`, and this
>      episode's own `design` + `character` blocks.
>    - The full `docs/craft-lessons.md` and `docs/style-cards.md` are the REVIEW
>      rubric; do not load them while drafting. `corpus/` is human study material;
>      never load it into a generation context (see `corpus/SOURCES.md`).

## 2. NEW step 2.5 - Design the horror (before scaffolding prose)

> 2.5. **Write the `design` block first** (schema in `docs/episode-design-block.md`):
>    the wrongness in plain prose, what it wants, its 2-5 behavioral rules, what is
>    permanently withheld, the dominant emotion, the spine beat, and one distinct
>    concrete anchor per planned ending. Present it to the user for approval BEFORE
>    writing any node prose - it is cheap to iterate here and expensive after. Every
>    sanity loss and death planned in step 3 must trace to a `rules[]` entry; every
>    ending names its anchor.

## 3. Step 3 (plan the spine) - ADD one line

> Derive the spine from the `design` block: scares are consequences of `rules`, the
> escalation peaks at `spine_beat`, endings land their declared anchors.

## 4. NEW step 3.5 - Facts pass, then prose pass

> 3.5. **Draft each node twice.** First pass, facts only: for every node, 2-4 plain
>    sentences of what is concretely here, what happens, what the player learns, and
>    what is deliberately withheld (no atmosphere, no voice). Second pass, prose: with
>    `docs/gold-lines.md` and the checklist in context, render each fact sheet into
>    house-voice prose. The instruction for the render is: "You know exactly what the
>    wrongness is and how it behaves; write so the reader could almost reconstruct the
>    rules from the consequences, while never stating anything in `withheld`. Match the
>    register of the gold lines." Plotting and prose conflated in one pass do both worse.

## 5. Step 5 (final read) - REPLACE the ledger re-read

> 5. **Final read against `docs/generation-checklist.md`** (one page; every line must
>    hold), including the body-state pass (L10) and the standalone-`sanityText` pass
>    (L7). The full ledger is enforced by the review step, not re-read here.

## 6. Step 7 (craft review) - ADD design-conformance to the handoff

> Pass the episode's `design` block to `review-episode` as rubric input. The review
> additionally checks: no node leaks a `withheld` item; each ending lands its declared
> anchor and only its own; the `spine_beat` node reads as the actual peak; no scare
> contradicts `rules`.

## 7. Feedback section - ADD gold-lines curation

> When the user praises a passage, or a review lens marks one exemplary, propose adding
> it to `docs/gold-lines.md` (and pruning a weaker one - the file stays ~20 passages).
> Never auto-edit; the user curates.

## Companion changes outside the skill

- `tools/spec.mjs` / `validate.mjs`: shape-validate `design` per the spec doc (warn-only
  for existing episodes until backfilled; `anchor_per_ending` covering all ending ids is
  a hard error for episodes that declare a `design`). `build.mjs` strips it; extend the
  strip self-test.
- `review-episode/SKILL.md`: add the design-conformance checks above as a lens or fold
  into Lens 2; add `design` to "Inputs to load first".
- Backfill `design` blocks for the seven shipped episodes (the FATHOM retrofit in the
  spec doc is one done); this doubles as the test that the schema fits reality.
- Sequencing note (L6 interaction): run the diversity check on the FACTS-pass draft
  where possible, or at minimum before final prose polish - so rewording-to-break-echoes
  happens before, not after, the legibility-bearing prose is settled.

# Generation checklist - the ledger distilled to one page

Load THIS at write time, plus `docs/gold-lines.md` and the episode's `design` block.
The full `docs/craft-lessons.md` is the REVIEW rubric; it stays out of the generation
context so ten verbose lessons stop competing for attention. (L6 documented the failure
mode: fixing one constraint quietly breaks another. Fewer, sharper rules in context.)

Each line carries its ledger ref; consult the full lesson only when a review finding
cites it.

## Voice
- Second person, present-leaning, sparse. Dread over gore. ASCII punctuation, single
  hyphen for dashes, never `--`. (L1, house voice)
- Vary sentence length; no reflexive "X, Y, and Z" triads; no essay register.

## Prose mode (gestalt - the default everywhere)
- A few charged, SPECIFIC fragments; the reader assembles the whole. Specific is the
  whole game - vagueness is not gestalt, it is a hollow place.
- One controlling image per beat, never three. (L2)
- Name the effect, not the thing. Reaction over object. Charge the ordinary.
- Atmospheric/degraded prose must still parse on first read. If a reader must decode a
  sentence, rewrite it. (L6)

## Grounding (before any mood is allowed to work)
- Every dread beat has one concrete picturable thing under it. No anchor = fog. (L8)
- Opening 1-2 nodes: who you are, what you are trying to do here, in plain words.
  Backstory stays indirect; the immediate objective goes on the page. (L8)

## Knowledge calibration
- You (the author) know exactly what the wrongness is - it is in the `design` block.
  The reader never gets `withheld` items; they get consequences of `rules`. (design)
- In-domain (character expertise): name tools, systems, what is missing. Out-of-domain:
  shape, weight, dread only - never function, never hints. (L4)

## Endings and reveals
- Cause first, legible in plain terms - a playtester must never ask "wait, what
  happened?" Then the dread. (L2)
- Land on the ending's declared anchor (design.anchor_per_ending): one concrete image,
  a sentence or two of accretion, one short flat stroke, STOP. Deliver the turn, never
  the itemized consequences. Fog and lecture are both failures; the target is between.
  (L8, L9)

## State coherence
- Every `sanityText` variant is a complete standalone description: re-introduce what it
  names, never "again / still / since you last looked" unless provably a revisit. (L7)
- Node text renders on EVERY visit: a pickup room describes the fixture (rack, hook,
  cradle, shelf), and only the take-choice's self-hiding label names the item; never
  assert a mutable fact (item on its shelf, wire intact, panel text) that a player
  action can falsify before a revisit. Start node is a one-shot intro nothing routes
  back to, feeding a state-neutral hub. (L13; `validate` warns on the greppable cases)
- Body-state pass: list every physical constraint the episode puts on the protagonist,
  then sweep all prose and choice text for any reference the constraint forbids. (L10)
- Gated choices: ONE choice, positive `requires`, real `to`, `locked` hint. Never an
  inverted no-`to` choice. (L3)

## Distinctness
- This episode's opening and distinctive phrasing must not echo any other episode -
  premise vocabulary is shared, lines are not. Never reuse a gold-lines passage. (L5)
- After ANY reword done to satisfy a constraint, re-read the new sentence cold for
  sense. (L6)

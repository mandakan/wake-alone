# The `design` block - know the horror before you write it

## Problem this solves

`docs/gestalt.md` already carries the iceberg warning: "a writer who omits things because
he does not know them only makes hollow places." The authoring procedure plans the
*mechanics* (gates, items, sanity budget) but never forces the author to know the
*horror* - what the wrongness is, what it wants, what its rules are. Generic-gestalt
output is what hollow places look like: suggestive fragments with nothing under the
water. The fix is structural: the seven-eighths below the surface gets written down
first, and prose is rendered FROM it.

## Schema

A top-level `"design"` block, sibling to `spec` and `character`. Like them: validated
for shape, reported by `validate`, stripped by `build` (never ships).

```json
"design": {
  "wrongness": "One paragraph, plain prose, no atmosphere: what the thing/situation actually IS. The full explanation the reader never gets.",
  "wants": "What it wants from the protagonist, in one sentence. (derelict: you awake when it feeds. vigil: your attention. graft: to finish the list. fathom: to see if you notice.)",
  "rules": [
    "2-5 behavioral rules the wrongness obeys, stated like physics.",
    "Every scare, sanity hit, and death must be a consequence of a rule here.",
    "(vigil: it locates by being looked at; stillness and lowered eyes are invisible to it.)"
  ],
  "withheld": [
    "What is NEVER stated on the page, anywhere, at any sanity level.",
    "This is the seven-eighths. The review pass checks no node leaks it."
  ],
  "emotion": "The dominant register, ONE of: watched | violated | unmoored | tempted | grieved | insignificant. Secondary allowed, but one leads. Every node either builds it or deliberately relieves it.",
  "spine_beat": "The single scariest beat in the episode and which node carries it. The fear curve is designed around this peak - nodes before it escalate toward it, nothing after it tries to top it with volume.",
  "anchor_per_ending": {
    "end_id": "The one concrete picturable thing that ending lands on (L8/L9). Each ending a DIFFERENT anchor onto the same truth. Writing them here, before prose, prevents both fog (no anchor) and convergence (same image twice)."
  }
}
```

## Procedure changes (where it slots into `author-episode`)

- New **step 2.5, before scaffolding prose**: write the full `design` block. The user
  approves or adjusts it before any node text exists. This is cheap to iterate (a
  paragraph and some lists) compared to re-prosing a finished episode.
- **Step 3 (spine)** now derives from `design`: every forced sanity loss cites which
  `rules[]` entry causes it; every dead ending names its `anchor_per_ending` entry.
- **Prose render** happens against `design` + `character` + `docs/gold-lines.md` in
  context. The instruction inverts from "be eerie" to: "You know exactly what the
  wrongness is (`wrongness`), what it wants (`wants`), and how it behaves (`rules`).
  Write each node so a reader could almost reconstruct the rules from the consequences -
  while never stating anything in `withheld`."
- **review-episode** gets the block as rubric input: a fifth lens (or folded into the
  gestalt lens) checks (a) no node leaks a `withheld` item, (b) every ending lands its
  declared anchor and no other ending's, (c) the `spine_beat` node actually reads as the
  peak, (d) the prose is consistent with the `rules` - a scare that contradicts them is
  incoherence the reader will feel even without knowing why.

## Validation (shape only - judgment stays with the skills)

`tools/spec.mjs` / `validate.mjs` additions, all cheap:
- `design` present (warn if absent for new episodes; existing episodes grandfathered
  until backfilled).
- All keys present and non-empty; `rules` 2-5 items; `emotion` from the enum.
- Every key in `anchor_per_ending` is an existing ending node id, and every ending node
  id appears (hard error - an ending with no declared anchor is exactly the fog bug).
- `build.mjs` strips it, same as `spec`/`character`. Add to the strip self-test.

## Retrofit example (FATHOM, reconstructed from the shipped episode)

```json
"design": {
  "wrongness": "There is no ship and never was. The protagonist is a kept mind inside something that constructs exactly as much environment as the current thought requires - a corridor when walking, hands when a wheel needs turning. The surveying career, the twenty years, the arrival record are furnishings. The thing at the centre is the protagonist's own body, kept and tended; everything else is the enclosure exercising it.",
  "wants": "To see whether the mind notices - it watches every measurement to learn if the construction holds.",
  "rules": [
    "Space is generated on demand; anything measured twice with discipline returns two answers.",
    "The body exists only as much as the immediate action requires; reaching past the construction's edge finds nothing.",
    "Records and proofs are furnished one layer deep; looking past the first layer (the line above your name) finds blank.",
    "Approaching the centre is permitted - it is the one true place - and seeing it is the end of the exercise."
  ],
  "withheld": [
    "Any naming of the keeper or its nature or purpose.",
    "Any statement that the protagonist is/was human, dead, dreaming, or uploaded - the cradle is shown, never glossed.",
    "The word 'simulation' or any synonym, at any sanity level."
  ],
  "emotion": "unmoored",
  "spine_beat": "center - the cradle. Everything escalates toward it; the endings after it deliver turns, not louder images.",
  "anchor_per_ending": {
    "end_bearing": "a star with no parallax",
    "end_egress": "reaching through the hatch with nothing to reach with",
    "end_records": "the blank line above your own name",
    "end_center": "the small kept breathing thing in the cradle",
    "end_abandon": "the scope set down / the survey left open"
  }
}
```

Note what the retrofit makes visible: every shipped FATHOM ending that LANDED maps to one
anchor here, and the one that originally failed review ("the descent ending ... only
concepts and nothing to picture", L8) is the one that would have had no entry. The block
catches that failure at design time, before a word of prose.

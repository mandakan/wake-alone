# Stacking (non-deduping) inventory — design

Date: 2026-08-20

## Goal

Make inventory a multiset: picking up an item you already hold adds a second copy
instead of silently discarding it. Removes the one place the mechanics lie to the
player.

## Motivation

The playtest continuity judge (PR #16) caught a real bug in `derelict`: the med-bay
cabinet prose says "You pocket it" about a second med-gel, but `applyEffects` guards
adds with `includes()`, so a copy of an item already held evaporates. The solver
mirrors the dedup faithfully, so nothing deterministic can flag it - the prose just
lies whenever pickup order means you take a second gel while holding the first.

Dedup is not a designed scarcity mechanic. The restore ceiling is already
gel-count x 25 (use the first gel before taking the second and you get both);
dedup only punishes pickup order, invisibly. Audit result: `medgel` is the only
item ever added at more than one site (8 of 15 episodes), so the blast radius of
stacking is exactly the med-gel economy.

## Semantics

| Surface           | Before                              | After                                      |
| ----------------- | ----------------------------------- | ------------------------------------------ |
| `add: [x]`        | no-op if `x` held                   | always appends a copy                      |
| `remove: [x]`     | removes ALL copies (only 1 possible)| removes ONE copy per listed id             |
| `requires.item`   | holds it                            | holds at least one (unchanged in practice) |
| `requires.notItem`| doesn't hold it                     | holds none (unchanged in practice)         |
| med-gel button    | shown while held; `remove` clears it| shown while any held; consumes one         |
| HUD `INV //`      | one label per id                    | grouped, `label x2` when count > 1         |
| `startInventory`  | duplicates collapse                 | duplicates count                           |

No existing gate or effect changes behavior for current content: stacks could not
exist before, so remove-all and remove-one were indistinguishable.

## Implementation

- **Engine** (`engine/template.html`): drop the `includes` guard in `applyEffects`;
  `remove` splices one index per id; `hudHTML` groups inventory labels with counts
  in first-acquired order. `meets`/`useGel` untouched (`includes` still means
  "at least one").
- **Solver** (`tools/validate.mjs` `solve()`): `st.inv` becomes a `Map<id, count>`
  with zero-count entries deleted, so every existing `.has()` check keeps its
  meaning. Touched: `applyEff` (inc/dec), `keyOf` (serialize `id:count`), initial
  state (count `startInventory` duplicates), `nodeItems` recording (iterate keys).
  Everything downstream (`endingRuns`, prose-lint ctx, L14 re-solve) is unchanged.
- **Content**: none. `derelict`'s cabinet prose becomes true as written.

## Consequences accepted

- Best-escape sanity may rise where an optimal route previously wasted a gel
  (`npm run validate` reports it; regenerated `traces/` show it). L14 is
  unaffected - it measures with med-gel disabled. L22's budget ceiling may newly
  warn on budget episodes; that would be a true signal.
- Trace `INV:` lines list copies verbatim (`medgel, medgel`) - ground truth, not
  grouped.

## Verification

- Fixtures pinning the new semantics: stacked gels both usable (+50 across a run),
  `remove` consumes one copy of two.
- `npm run playtest`: hard-fails on any engine/solver divergence, and regenerated
  golden traces make the gameplay impact reviewable in the PR diff.
- Continuity judge re-run (subagents) on the episodes whose traces changed; the
  derelict finding must be gone.

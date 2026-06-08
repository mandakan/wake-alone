# Synced room-copy corruption on watch flash

/ Design 2026-06-08. Engine FX polish for low-sanity watcher overlays.

## Goal

When a watch line flashes at critical/terminal sanity, also corrupt the current
room copy in sync, then snap it back when the line clears. The watcher writes
itself into your perception, not just onto a banner over it.

## Behavior

- Synced to the watch flash. Corrupt on show, restore on clear (~0.85s critical,
  ~1.15s terminal). One intrusion, then clean again.
- Escalates in kind by tier:
  - critical: lookalike character noise on the prose (reuse `LOOKALIKE`), light density.
  - terminal: that noise plus a few whole words swapped for the watcher's vocabulary.

## Word source

Derived from the episode's existing `watching` array - one data source, two
presentations (overlay flashes whole lines; inline swaps single words). Tokenize
the pool, strip punctuation, drop a small stopword set, keep the rest. Fall back
to `DEFAULT_WATCH` when an episode has no `watching`. No new authoring.

## Mechanism (text-node safe)

- `corruptProse(tier)`: snapshot the live `.prose` element's clean `innerHTML`,
  then walk descendant text nodes only (never tag nodes). Apply char-noise to all;
  at terminal, swap up to ~3 eligible words (length >= 4) for pool tokens.
- `restoreProse()`: if a snapshot exists and the element is still in the DOM,
  restore the clean `innerHTML`; drop the snapshot.
- `flashWatch()` calls `corruptProse(tier)` on show; its revert timeout calls
  `restoreProse()` alongside clearing `watchEl`.
- `clearWatch()` also calls `restoreProse()`, so navigation / med-gel / endings
  always leave clean text.

## Guards

- Gated under `FEAT.watching`; skipped when `REDUCED` (same path as the overlay).
- Prose always restored to authored copy between flashes - no soft-lock, no
  permanently degraded text.

## Scope

All changes in `engine/template.html`. No schema, validator, or episode changes.
`npm run build` re-inlines; playtest `dist/index.html` at low sanity to tune density.

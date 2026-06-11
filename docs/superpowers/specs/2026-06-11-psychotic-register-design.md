# Psychotic sanity register -- design

## Summary

Integrate three prepared drop-ins: four "interior collapse" style cards (Schreber, Beers,
Perceval, Merivale), their SOURCES rows, and lesson L18 with its `sanityRegister` spec dial.
The dial gives `sanityText` a second register: `wrong` (the existing Gilman degrade, default)
or `psychotic` (referential / recorded / obeyed, escalating across the existing sanity bands).
The enum is mechanical (spec.mjs, validated, self-tested); the guardrails are judgment
(craft-lessons L18 + an author-episode final-read pass). This mirrors how L17 split `traces`
into a spec capability plus a craft lesson.

The register-specimens sheet (three rungs on derelict's corridor node) is a demonstration
only. It is NOT committed anywhere in the repo, and nothing from it enters gold-lines.

## Placement decisions

- **Style cards -> `docs/style-cards.md`.** Insert a new section directly after the Gilman
  card (the drop-in's own framing: "these four extend the Gilman card"), under a `---`
  separator and a section intro, then the four cards in drop-in order (Schreber, Beers,
  Perceval, Merivale). The Schreber trap paragraph is preserved verbatim: German PD only,
  NO public-domain English translation exists (Macalpine & Hunter 1955 is under copyright),
  mechanics-only, never prose. House doc style kept: ASCII, `--` dashes (docs use `--`;
  only episode prose is single-hyphen).
- **SOURCES rows -> `corpus/SOURCES.md`.** Append the four works as bullets under the
  existing "Referenced but deliberately NOT bundled" heading, matching the
  Maupassant/Hodgson bullet format (author, title, year, PD status, what it's for, where to
  get it). Full texts are NOT bundled into `corpus/` -- Beers/Perceval/Merivale are long,
  Schreber is German and translation-locked.
- **L18 -> split like L17:**
  - The dial is a spec capability: `sanityRegister` in `tools/spec.mjs`, documented in
    `CLAUDE.md` under "Generation dials" (where `traces` is documented) and in the
    author-episode skill's Parameters section.
  - The guardrails (band ladder + the five rules) become **L18 in `docs/craft-lessons.md`**,
    appended after L17 in the ledger format (Feedback/Rule/Enforced-by). The provenance
    line stays honest: "Design intent (2026-06, register pass; not a playtest finding)" --
    every other lesson is feedback-driven, this one is forward design intent, and the
    lesson says so.

## Code

### `tools/spec.mjs`

- New enum next to `TRACE_MODES`: `export const SANITY_REGISTERS = ["wrong", "psychotic"]`
  with a comment block in the same voice as the `traces` one (what each value means, who
  enforces what: enum mechanical here, rung conformance judgment).
- `resolveSpec`: carry `sanityRegister: spec.sanityRegister ?? null`, include it in the
  all-null early return check, and error on unknown values exactly like `traces`
  (`unknown sanityRegister "x" (use wrong/psychotic)`). Absent means `wrong` -- the
  default is implicit, matching how `traces` has no default constant.
- `describeBrief`: add a bit when the dial is declared, e.g.
  `sanityRegister=psychotic (sanityText register, L18 - judgment-checked)`.

### `tools/build.mjs`

No change. `build.mjs` strips the entire `spec` object (`delete ep.spec`), so
`sanityRegister` is stripped at build automatically -- confirmed, same behavior as `traces`.

### `tools/validate.mjs`

Finding: `traces` is enum-validated through `resolveSpec` (a bad value surfaces as a
`spec: unknown traces ...` ERROR), but it is NOT included in `report.spec` (line ~364) or
the human metrics line (line ~536) -- only size/punishment/escape are.

Decision: add BOTH `traces` and `sanityRegister` to `report.spec` and the metrics line, so
a declared dial is visible in validator output ("reports the field"). This is a small
parity fix; if you prefer strict match-traces-as-is (validated but silent), say so and I
will drop this part.

### `tools/validate.test.mjs`

There is no dedicated `traces` self-test today; the closest is the generic unknown-dial
test (`size: "epic"`). Add, mirroring that pattern:

- unknown register is an ERROR: `spec: { sanityRegister: "lucid" }` ->
  `hasErr(r, 'unknown sanityRegister')`
- valid value passes: a minimal solvable episode with
  `spec: { sanityRegister: "psychotic" }` validates with no spec error.

Optionally the same pair for `traces` (closing the existing gap) -- included unless you
object, it is four lines.

### `.claude/skills/author-episode/SKILL.md`

- Parameters section: add a `sanityRegister` bullet after `traces` (enum, default `wrong`,
  one-line description of the two registers, pointer to L18).
- Step 5 (final read): when `sanityRegister` is `psychotic`, run the register pass per
  `sanityText` variant -- (a) lucid wrong belief that parses on a cold read (L6); (b) one
  concrete anchor (L8); (c) a single delusional move, never the whole system (L9+L15);
  (d) standalone and state-true (L7+L13).
- `review-episode` is NOT edited: L18's "Enforced by" leans on the reviewer's existing
  gestalt and legibility lenses, which already cover this without new wiring.

## Boundaries (locked)

- `docs/gold-lines.md` untouched. Psychotic lines enter gold-lines only from a shipped
  episode, curated later -- never from the specimen sheet.
- The specimens file is not committed as repo content. It contains no JSON (it is prose
  rungs on derelict/corridor), so there is nothing to reuse as a lint/validate fixture --
  discarded.
- No episode files change. The field is optional and absent everywhere, defaulting to
  `wrong`; all existing episodes must still pass `node tools/validate.mjs` and prose-lint
  unchanged.
- No engine/runtime change: the dial is authoring metadata, stripped at build like the
  rest of `spec`.

## Verification before commit

- `node tools/validate.mjs` (whole manifest) -- zero ERRORs, episodes unchanged.
- `node tools/validate.test.mjs` (or `npm test`) -- all checks pass including the new ones.
- Prose-lint clean (runs inside validate; `npm run lint` if a doc-only confirmation is
  wanted -- note the linter governs episode prose, not docs).
- Show the full diff + green check output before committing.

## Commits (conventional, for release-please)

1. `feat(spec): add sanityRegister dial (wrong/psychotic) with validation and self-test`
   -- spec.mjs, validate.mjs reporting, validate.test.mjs.
2. `docs(craft): add interior-collapse style cards, sources, and L18 psychotic register`
   -- style-cards.md, SOURCES.md, craft-lessons.md L18, CLAUDE.md dial docs,
   author-episode SKILL.md wiring.

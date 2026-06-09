# Adversarial craft-review step - design

**Date:** 2026-06-09
**Status:** approved design, pre-implementation

## Problem

Episode quality is enforced two ways today. The validator (`tools/validate.mjs` +
`tools/prose-lint.mjs` + the solver) is the deterministic gate: structure, solvability,
and mechanical slop. The craft-lessons ledger (`docs/craft-lessons.md`) holds the
judgment-tier rules that cannot be coded - L2 ending legibility, L4 hint calibration,
gestalt mode, voice. Those rules are checked only by a human reading the draft.

That human read is the one manual link in an otherwise automated quality loop. This
adds a fresh-eyes craft reviewer that fills the same slot: it reads the finished
episode cold and reports where it violates the judgment-tier lessons.

It does not replace the validator and does not duplicate any mechanical check. It is
the craft reviewer, not a second structural one.

## Non-goals

- Not an assembly line. A single author still drafts the whole episode; coherence of a
  short single-voice story depends on one mind holding it.
- Not a hard gate. The validator stays the only exit-0 / CI gate. Craft findings are
  advisory-but-must-be-triaged, never a silent build block.
- Reviewers never write to the episode. No second hand rewriting prose it did not draft.
- No runtime LLM. This is an authoring-time tool only; the engine stays deterministic.

## Shape

A single author bracketed only on the back end by an adversarial review pass. (A
divergent ideation panel on the front end was considered and deferred - it targets
"episodes feel same-y," which is not a felt problem today.)

### 1. The lens panel

A few sub-agents run in parallel. Each is handed the episode JSON cold (no drafting
rationale), plus `CLAUDE.md` and `docs/craft-lessons.md`, and given one job. Starting
lenses:

- **Ending legibility (L2)** - is every ending's cause and core mechanic explicit
  before any flourish? One controlling image, not three competing ones? Would a
  playtester ask "wait, what happened"?
- **Gestalt + hint calibration (L4)** - evoke-not-catalogue held? Hints role-relative
  to `character.expertise` (in-domain names tools/systems; out-of-domain stays shape
  and dread, never function)?
- **Slop beyond the linter** - cadence, cliche, voice drift (second person, sparse),
  the patterns prose-lint only warns on or misses entirely.
- **Tension feel** - the solver already proves the good path survives; this lens judges
  whether it reads hard-won rather than trivially safe or secretly grim, plus branch and
  hub coherence (branches agree with each other and with the hub state).

Four lenses to start; the list is extensible. Reviewers run as parallel sub-agents
dispatched by the orchestrating agent (the running skill), not via a new code path.

### 2. Findings format

Each reviewer returns a list of findings. One finding:

```jsonc
{
  "severity": "block | craft-warn | nit",
  "lesson": "L2",            // craft-lesson ref, or null
  "location": "nodeId or nodeId#choiceIndex",
  "problem": "what is wrong, in plain terms",
  "fix": "concrete suggested change",
  "proposedLesson": null      // optional drafted rule text when it smells recurring
}
```

The orchestrator merges all lenses' findings and dedupes by (location, lesson, problem).

### 3. Authority - report only

Reviewers write nothing to the episode.

- **Auto mode** (inside author-episode): the author agent reads the merged report and
  re-enters its existing validate-fix loop until every `block` and `craft-warn` finding
  is addressed or explicitly justified - the same posture the skill already takes toward
  validator `warn`s. The final report to the user summarizes what was raised and how it
  was resolved.
- **Standalone mode** (`/review-episode <id>`): the merged report is presented to the
  user inline and a copy is written to `~/.claude-tmp/` as scratch. The user decides what
  to act on. Nothing is committed to the repo by the review itself.

### 4. Ledger routing

A finding may carry `proposedLesson` when the reviewer judges it a recurring pattern
worth a durable rule. That surfaces to the user with drafted text. Adding it to
`docs/craft-lessons.md` - and writing any new `prose-lint`/`validate` rule plus self-test
- stays a human decision. Lessons are never auto-appended.

### 5. Entry points

- **New skill `review-episode`** (`.claude/skills/review-episode/SKILL.md`), invoked as
  `/review-episode <id>`. Re-reviews any existing episode, including the six already
  shipped. This skill is the single source of truth for the panel, lenses, findings
  format, and triage rules.
- **author-episode step 6.5.** After `npm run build`, author-episode invokes the same
  review logic (auto mode), triages, then produces its final report. It references the
  `review-episode` skill rather than restating the lenses, so there is one definition.

## Components and boundaries

| Unit | Does | Depends on |
|------|------|------------|
| `review-episode` skill | Defines lenses, findings schema, dispatch + merge + triage rules; runs standalone | `CLAUDE.md`, `docs/craft-lessons.md`, episode JSON |
| Lens sub-agent (x4) | Reviews one episode through one lens, returns findings | the episode JSON, bible, ledger |
| author-episode step 6.5 | Calls review-episode logic in auto mode after build | `review-episode` skill |

No new code in `tools/`. Craft review is judgment-tier (tier 2 in the ledger's
enforcement model), so it lives as skill prose, not a mechanical check. If a reviewer
keeps flagging the same coded-checkable pattern, that becomes a future `prose-lint` rule
through the normal human-approved ledger route - not part of this work.

## Testing / validation

- The deterministic suite (`npm run validate`, `npm test`) is unchanged and still the
  gate; this work adds nothing it must pass.
- Smoke test: run `/review-episode derelict` (the canonical episode) and confirm the
  panel returns a coherent merged report with no false "this violates L2" against a known-good
  episode. Then run it against an episode with a deliberately muddied ending and confirm
  the L2 lens flags it. These are manual smoke checks, not automated tests - the reviewer
  output is judgment, not a fixture-able verdict.

## Risks

- **False positives against good episodes.** Mitigated by handing each lens the ledger as
  its rubric and by report-only authority - a wrong finding costs a human "no," not a bad edit.
- **Lens overlap / noise.** Mitigated by dedupe and by scoping each lens to one job.
- **Scope creep into structural review.** Explicitly out: lenses are told the validator
  owns structure and to not re-report what it already catches.

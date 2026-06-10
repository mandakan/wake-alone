---
name: review-episode
description: Adversarial craft review of a WAKE ALONE episode. Use when asked to review, critique, or craft-check an episode, to re-read a shipped episode for craft quality, or when invoked as /review-episode <id>. Reads a finished episode cold and reports judgment-tier craft-lesson violations (ending legibility, gestalt, voice, tension). Complements npm run validate; does not replace it.
---

# Reviewing a WAKE ALONE episode (craft pass)

Goal: read a finished episode with fresh eyes and report where it violates the
**judgment-tier** craft rules - the ones a human used to catch by reading. This is the
craft reviewer. It is not the structural one.

## What this owns, and what it must not touch

The deterministic stack already owns structure and mechanical slop, and it is the only
exit-0 / CI gate:

- `tools/validate.mjs` + the solver: reachability, orphans, solvability, sanity budget,
  gating, misspelled keys.
- `tools/prose-lint.mjs`: non-ASCII punctuation, doubled `--`, essay/marketing register,
  cliche/cadence warnings, first-person slips, never-shown `sanityText`, "your <item>"
  state incoherence.

**Do not re-report anything in that list.** If a finding is something the validator or
linter already catches, it is out of scope - say so and drop it. This pass is for what
code cannot judge: whether an ending lands, whether the gestalt holds, whether the voice
stays in register, whether the good path reads hard-won.

**Reviewers report only. Never edit the episode.** A second hand rewriting prose it did
not draft is exactly the coherence risk this design avoids.

## Inputs to load first

Read these before dispatching any lens (they are the rubric):

- the target episode: `episodes/<id>.json`
- `CLAUDE.md` - the creative bible, voice, sanity economy, gestalt-by-default
- `docs/craft-lessons.md` - the numbered feedback ledger (L1, L2, L3, L4, ...); every
  lesson is a rule the episode must hold
- `docs/gestalt.md` - the default prose mode (evoke, do not catalogue)

## The four lenses

Dispatch all four as **parallel sub-agents in a single message** (Agent tool, one block,
multiple calls), each with **`model: "sonnet"`**. Each sub-agent gets: the full episode
JSON, `CLAUDE.md`, `docs/craft-lessons.md`, the lens prompt below, and the findings schema.
Each returns a findings array (JSON) and nothing else. Tell each lens explicitly: "the
validator already owns structure and mechanical slop - do not report anything it catches;
report only what your lens judges."

**Why sonnet:** each lens applies a written rubric to a fixed text, and the merged findings
are triaged by the stronger main-loop model, which owns final judgment - a missed nit costs
little, a false positive dies in triage. This is where the flow's token cost concentrates
(four agents, each reloading ~50KB of rubric + episode), so do not silently upgrade them.
**Escalation valve:** if during triage one lens's output reads shallow or generic for the
episode at hand (e.g. zero findings on a first draft), re-run that single lens once with no
`model` override (it then inherits the strong main-loop model). Never upgrade all four.

### Lens 1 - Ending legibility (L2)

> You are reviewing one WAKE ALONE episode for **ending legibility**. For every `ending`
> node: is the cause of the ending and the core mechanic it pays off explicit, in plain
> terms, *before* any metaphor or flourish? Would a playtester ask "wait, what just
> happened"? Is there one controlling image, or three competing ones? Name the mechanic
> each death pays off (e.g. for an attention-based horror: "a distress call is just a way
> of telling it where you are") - if the prose leaves it implied, that is a finding. Also
> check that escape endings read as earned, not arbitrary. Cite the node id. Use lesson
> ref "L2".

### Lens 2 - Gestalt + hint calibration (L4)

> You are reviewing one WAKE ALONE episode for **gestalt mode and hint calibration**.
> Gestalt: does the prose evoke with a few charged, specific fragments and let the reader
> assemble the whole, or does it catalogue (over-specify, name three things where one
> controlling image would do)? Name the effect, not the thing. Hint calibration is
> **role-relative** to `character.expertise`: in-domain (their backyard) the protagonist
> knows it - naming tools/systems and hinting a missing tool is correct; out-of-domain
> the prose must stay shape, weight, dread - never function, never operating hints, never
> "what part is missing." A description that explains how an out-of-domain object works is
> a finding. Cite the node id. Use lesson ref "L4".
>
> Also check the **death-evidence register (L17)**: every trace of how the crew died must
> name an effect, never a wound, and pass the read-aloud test - innocent surface, horrific
> inference. If the episode declares `spec.traces`, judge conformance to the rung: `absent`
> means zero evidence on purpose (any trace is a finding); `restrained` means counter-facts
> with no forward motion; `forward` allows systems still mid-task. Flag any trace that tips
> into shown injury, and flag a `forward` register applied everywhere (a tic, L15). Use
> lesson ref "L17" for these.

### Lens 3 - Slop beyond the linter

> You are reviewing one WAKE ALONE episode for **prose slop the linter cannot catch**.
> The linter already flags non-ASCII punctuation, doubled dashes, essay register, and the
> obvious tells - do not report those. Judge what it cannot: voice drift (must stay second
> person, present-leaning, sparse - dread over gore, no splatter, no jump-scare prose),
> dead metaphors and horror cliche, robotic cadence (uniform sentence length, repeated
> sentence openers, reflexive "X, Y, and Z" triads), and filler that adds words but not
> image. Quote the offending sentence and cite the node id. Use lesson ref null unless a
> specific numbered lesson applies.

### Lens 4 - Tension feel + coherence

> You are reviewing one WAKE ALONE episode for **how the tension reads and whether the
> branches cohere**. The solver already proves a survivable escape exists - do not
> recompute the sanity math. Judge feel: does the intended good path read *hard-won*, or
> is it trivially safe (no real cost) or secretly grim (so punishing it reads as
> unwinnable)? Do the explorable branches agree with each other and with the hub - no
> branch contradicting a fact another branch or the hub establishes, no item/flag picked
> up in one branch that the prose elsewhere forgets the player could have? Cite node ids
> for any contradiction. Run a **body-state check (L10)**: if the episode constrains the
> protagonist's body (a severed/coupled/bound limb, a lost faculty, a body altered "in
> stages"), does every node's prose and choice text honour it - no "hands"/"both"/named
> limb or two-handed action the established state forbids? Use lesson ref null unless a
> numbered lesson applies.

## Findings schema

Each lens returns an array of:

```jsonc
{
  "severity": "block | craft-warn | nit",
  "lesson": "L2",            // craft-lesson ref, or null
  "location": "nodeId",      // or "nodeId#choiceIndex"
  "problem": "what is wrong, in plain terms",
  "fix": "concrete suggested change",
  "proposedLesson": null      // optional: drafted rule text if this smells recurring
}
```

Severity meaning:
- `block` - a clear craft-lesson violation a reader would notice (e.g. an illegible
  ending). In auto mode it must be fixed or explicitly justified before reporting done.
- `craft-warn` - a real weakness worth fixing; triage like a validator `warn`.
- `nit` - minor; optional.

**None of these are a CI gate.** The validator is the only thing that blocks the build.
These findings are advisory-but-must-be-triaged.

## Merge and triage

1. Collect all four lenses' arrays.
2. Dedupe by (`location`, `lesson`, `problem`) - lenses overlap; keep one copy, highest
   severity wins.
3. Sort: `block` first, then `craft-warn`, then `nit`.
4. Present as a single report.

## Modes

**Standalone** (`/review-episode <id>`):
- Present the merged report inline to the user.
- Write a copy to `~/.claude-tmp/review-<id>.md` (scratch, per the user's CLAUDE.md). Do
  not commit anything to the repo - the durable artifact is any craft-lesson the user
  later chooses to add.
- The user decides what to act on. Do not edit the episode.

**Auto** (called by author-episode after build):
- The author agent reads the merged report and re-enters its existing validate-fix loop,
  resolving every `block` and `craft-warn` finding or explicitly justifying why it stands
  - the same posture the skill takes toward validator `warn`s.
- The author's final report to the user summarizes what the review raised and how each
  item was resolved.

## Ledger routing

When a finding carries a `proposedLesson`, the reviewer judged it a recurring pattern
worth a durable rule. Surface it to the user with the drafted text and ask whether to add
it. Adding it to `docs/craft-lessons.md` - and writing any new `prose-lint`/`validate`
rule plus a self-test - is a **human decision**. Never auto-append a lesson, and never
weaken a validator/linter rule.

## Hard constraints

- Report only. Reviewers never edit `episodes/<id>.json`.
- Never re-report what `validate`/`prose-lint` already catch.
- Never auto-append to `docs/craft-lessons.md`.
- No runtime LLM - this is an authoring-time tool; the engine stays deterministic.

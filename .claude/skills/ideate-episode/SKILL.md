---
name: ideate-episode
description: Use when the user wants ideas, premises, or concepts for a new WAKE ALONE episode, asks what the next episode should be, brings their own premise to test or refine, wants to brainstorm a setting or horror before any writing happens, or invokes /ideate-episode [seed or idea]. Runs before author-episode; produces a judged episode brief, not prose or JSON.
---

# Ideating a WAKE ALONE episode

Goal: turn "we need a new episode" into one **episode brief** strong enough that
`author-episode` can take it as its spine (its step 3) without re-deciding the premise.
This skill writes nothing under `episodes/` - its output is the brief, presented to the user.

## Model economy

Divergence is cheap, convergence is expensive. Pitch generation runs on **sonnet
sub-agents**; judging, grafting, and developing the brief stay on the **main loop**
(strong model). Read only the distilled docs on the main loop - never `corpus/`.

## Modes

- **Generate** - no premise yet (bare `/ideate-episode`, or a loose seed like "something
  with EVA suits"): run steps 1-4 in order.
- **Test-and-refine** - the user brings their own idea, however thin: run step 1, then
  skip the fan-out. Dispatch one sonnet sub-agent to expand the idea into the pitch
  template (same contract as step 2 - every field filled; where the idea is silent the
  agent proposes, marked `[proposed]`). Score the filled pitch with the step-3 rubric and
  present the scorecard. Then enter the refine loop.

## The refine loop (both modes end here)

Ideation ends when the user says it does, not when a brief exists. After every
presentation - ranked pitches or a scorecard - **stop and take direction**; never proceed
to the brief unprompted. The user may:

- pick a pitch, or merge elements across pitches ("this one's setting, that one's mechanic")
- amend any template field
- counter with their own idea (treat as test-and-refine input)
- ask for another fan-out round with a sharpened seed (fresh sonnet agents; tell them what
  was already pitched so they steer away from it)

Each round, on the main loop: apply the change, re-score against the rubric (one line per
criterion), and present what improved and what it cost - a fix to one criterion often
breaks another (a fresher mechanic may lose the expertise split). If a change collides
with occupied territory at the mechanic level or makes the economy unworkable, say so
plainly instead of polishing it. When the user approves, develop the brief (step 4).

## Step 1 - map the occupied territory

Freshness is judged at the **mechanic** level, not the setting level. Two episodes on
different ships with the same rule ("it finds you when you signal") are the same episode.

Build a one-line-per-episode table: `id | setting | central wrongness | the mechanic as a
rule | protagonist domain`. Derive it by dispatching one sonnet sub-agent to read every
`episodes/*.json` (skip manifest) and return the table - the mechanic usually shows
plainest in the endings and the `watching` lines. Keep the table in hand for steps 2-3.

Also read `CLAUDE.md` (creative bible), `docs/gestalt.md`, and `docs/inspiration.md`
(motif pool) on the main loop.

## Step 2 - fan out pitches (sonnet, one block)

Dispatch three sonnet sub-agents in a single message, each with a different angle so the
pitches do not converge:

- **mechanic-first**: invent the rule of the horror, then derive the setting it demands
- **role-first**: pick a concrete expertise, then build a horror that sits just outside it
  (the in/out-of-domain split of L4 is the design)
- **image-first**: start from one charged image (a glove palm-up, a door that is warm),
  build outward, never explain the image

Each agent gets: the occupied-territory table, the relevant bible rules (premise, voice,
gestalt, sanity economy, gating), any user seed, and the pitch template below. Each
returns **two pitches** in the template and nothing else.

### Pitch template (the contract - every field, no prose around it)

```
TITLE / logline (<= 25 words)
SETTING: one line + why it is not occupied territory (name the nearest existing episode and the difference)
MECHANIC: the central wrongness stated as a rule the player can learn
  (model: "a distress call is just a way of telling it where you are")
PROTAGONIST: role + expertise[] + which side of the horror is their backyard and which is dread
ESCAPE GATE: the two things from different branches (item + flag), and the hub they hang off
COST: what the optimal path forces the player to give up (the L14 teeth - sanity shape, or worse)
NASTY ENDINGS: three, one line each, each naming the mechanic it pays off (L2 legibility)
NEVER SHOWN: 2-3 things that stay gestalt - known by effect, never named or explained
DIALS: size / punishment / escape, with one clause of justification
```

A pitch missing a field is incomplete - tell the agents to fill every field or drop the
pitch.

## Step 3 - judge and graft (main loop)

Score all six pitches against this rubric, one short line per criterion:

1. **Freshness** - mechanic-level distance from the occupied territory
2. **Mechanic legibility** - can three deaths pay it off in plain terms? (L2)
3. **Hint-calibration potential** - does the expertise split give both a backyard and a
   blind side? (L4)
4. **Gestalt potential** - does the horror survive never being shown? (a horror that needs
   explaining fails)
5. **Economy viability** - can the cost be real (L14) and the run still survivable?
6. **Dial fit** - does the premise actually need its claimed size/punishment?

Rank. Graft compatible strengths from runners-up onto the winner (an image from one pitch
can serve another's mechanic). Discard incompatible grafts - one controlling wrongness per
episode. Present the top three ranked with scores and your recommendation, then enter the
refine loop.

## Step 4 - develop the brief (only after the user approves)

Expand the approved pitch into a one-page brief: the filled template plus a node-budget
sketch (hub, 3-4 branches, where the gate halves live, where the 1-2 medgels sit, the
ending list with the mechanic each pays off). Hand the brief to `author-episode` - it
replaces that skill's premise decisions, not its validate loop.

## Hard constraints

- Report only: no files under `episodes/`, no prose drafting - drafting is
  `author-episode`'s job on the strong model.
- Never reuse named IP; motifs from `docs/inspiration.md` are inspiration, never verbatim.
- Never skip step 1 - a pitch judged without the occupied-territory table will repeat the
  corpus.

---
name: judge-traces
description: LLM continuity read over the committed playthrough transcripts in traces/, run by the session itself or by subagents - no API key or npm credential needed. Use whenever the user wants a continuity or consistency check of episodes or their playthroughs, says "judge the traces", "run the judge", "continuity check", asks whether rooms read correctly after state changes, wants the LLM layer of the playtest harness without ANTHROPIC_API_KEY, or invokes /judge-traces [episode-id ...]. Also offer it right after an episode was authored or edited and its traces regenerated. It is the in-session equivalent of `npm run playtest -- --judge`.
---

# Judging playthrough traces (continuity read)

Goal: find prose that contradicts ground-truth play state - a stale room description
after the player changed the room, an item still "on the shelf" after it was taken,
wake-up narration on a second visit, an ending that does not follow from its cause.
This is the class of bug that only reading can catch; the deterministic stack cannot
judge it, and the transcripts exist precisely to make it judgeable.

The input is `traces/<id>.txt`: real playthroughs of the built engine (headless browser,
actual clicks), one file per episode. Every step carries ground truth - `SANITY`, `INV`,
`FLAGS`, `(revisit)` markers - followed by the exact prose the player saw. That framing
matters: you are never guessing what the game state was; the transcript states it.

**Findings are advisory (warn tier) and this skill never edits episodes.** Like
`review-episode`, it reports; fixing is the author's move. It also never gates anything:
`npm run validate` stays the only exit-0 authority.

## 1. Freshness first

A judgment of a stale transcript is worthless. Before judging an episode, check that its
trace is at least as new as its source:

```
[ episodes/<id>.json -nt traces/<id>.txt ] && echo STALE
```

If stale or missing, regenerate first: `npm run playtest -- episodes/<id>.json`
(needs Playwright; chapters get their unlock seeding handled by the tool). If playtest
cannot run in this environment, say so and judge the committed trace anyway, flagging
that it may lag the episode.

## 2. Scope

- `/judge-traces <id> [<id> ...]` - judge those episodes.
- No arguments - judge the episodes whose `episodes/*.json` or `traces/*.txt` differ from
  the default branch (`git diff --name-only origin/main...HEAD` plus uncommitted changes).
  If nothing differs, say so and ask whether to sweep everything.
- `--all` - every file in `traces/`.

## 3. How to judge

Read `tools/judge-rubric.md` once. It is the single source of truth for what counts as a
finding and what must not be reported, shared verbatim with `npm run playtest -- --judge` -
never restate, extend, or fork it here; if the rubric needs to change, change that file
(the API judge's cache invalidates automatically).

Then, per episode, one judging pass over the full transcript:

- **Several episodes:** spawn one subagent per episode, all in parallel, on a cheap/fast
  model (e.g. haiku) - this mirrors the API judge's cost profile and keeps the sweep quick.
  Prompt template:

  > Read <repo>/tools/judge-rubric.md and follow it exactly - it defines your task, what
  > not to report, and your output format. Then read <repo>/traces/<id>.txt (the complete
  > input) and judge it. Return ONLY the JSON array the rubric specifies, nothing else.

- **One or two episodes, or the user asked for a deeper/more careful read:** judge inline
  with the session model instead - read the rubric and the trace yourself and apply it.
  If the user names a preference (session model, subagents, a specific model), honor it.

## 4. Verify before reporting

LLM judges over-flag; a warn stream people learn to ignore is worse than none. Re-check
every finding against the trace (and the episode JSON if needed) and drop it when:

- the quote does not actually appear at that step, or was paraphrased into a contradiction;
- the "contradiction" is deliberate low-sanity wrongness (the step's SANITY is <= 40 and
  the prose is perception, not world-state);
- the step is not actually a revisit, for category-3 findings;
- the deterministic stack already owns it: validate/solver findings (reachability, gating,
  sanity budget) and prose-lint findings (stale pickup naming, "your <item>" incoherence,
  never-shown sanityText, punctuation/register) are out of scope here - drop and say so.

Only findings that survive this pass get reported.

## 5. Report

Mirror the playtest output register, one warn line per surviving finding, then a per-episode
verdict:

```
warn [judge] <episode> / <trace heading> step <n>, node "<node>": <issue>  << "<quote>"

<episode>: clean | N finding(s)
```

Close with a one-paragraph summary across episodes. If the user wants a finding fixed,
that is a follow-up edit to the episode JSON (then rerun `npm run validate` and
`npm run playtest`) - not part of this skill's pass.

# Craft lessons - the feedback ledger

Every piece of feedback from the user or playtesters about how stories read, how endings land, how
effects and arcs are built gets recorded here as a durable rule, so the same low-quality output is
not produced again. This is the standing record; the `author-episode` skill reads it before writing
and checks each episode against it before finishing.

How a lesson is enforced, strongest to weakest:

1. **Mechanical -> a check.** If the rule can be verified by code, it becomes a `tools/prose-lint.mjs`
   or `tools/validate.mjs` rule with a self-test in `tools/validate.test.mjs`. It then blocks the
   build and CI, so it cannot regress.
2. **Craft / subjective -> a rule here.** If it needs judgment, it lives in this file and in the
   skill, and is checked by reading.
3. **Cross-session preference -> agent memory.** Durable user preferences are also saved to memory
   so future sessions start already knowing them.

When new feedback arrives: add a numbered lesson below (what was said, the rule, how it's enforced),
wire the enforcement, and if it is a user preference, save it to memory too.

---

## L1 - Stories use a single hyphen for dashes, never `--`

**Feedback:** "There are a lot of double dashes ... it looks worse. Keep to single dashes in all
stories, current and generated."
**Rule:** In episode prose, use a single hyphen `-` for any dash (spaced: `a thing - like this`).
Never an em/en dash (the LLM tells) and never a doubled `--` (the failed-substitute that reads
worse).
**Enforced by:** `prose-lint` errors on non-ASCII dashes and on any `--` (self-tested). All existing
episodes were converted.

## L2 - Endings must be legible: the causal chain has to be explicit

**Feedback:** on VIGIL's broadcast ending - "I don't really get this ending." The prose stacked
metaphors ("a hand thrust up out of deep water", "the loudest looking there is") and buried the
actual logic.
**Rule:** An ending (and any major beat) must let the reader understand *why it happened* and *how
it ties to the episode's core mechanic*, in plain terms, before any flourish. Lead with the cause,
then the dread. One controlling image, not three competing ones. If a playtester would ask "wait,
what just happened?", rewrite. Specifically: name the mechanic the death pays off (for VIGIL,
attention - "a distress call is just a way of telling it where you are"), do not leave it implied.
**Enforced by:** this rule + the skill's final-read check. Not mechanically checkable.

## L3 - Locked/gated choices: positive gate + real `to` + `locked` hint. Never an inverted no-`to` choice.

**Feedback:** "Ending derelict by 'insert the keycard and launch' does nothing" + a runtime crash
(`goto(undefined)`). Cause: a choice meant to show a locked reason was written with an *inverted*
gate (`notItem`/`notFlag`) and **no `to`**. When the gate was satisfied, the engine rendered it as a
clickable button that pointed nowhere and crashed on click. The same latent bug was then found in
VIGIL and TENANT.
**Rule:** Model a gated action as ONE choice: the positive `requires` (the things you need) + a real
`to` + a `locked` string that explains what is missing. The engine shows it clickable when the gate
is met and as the locked hint otherwise. Do NOT create extra choices with inverted gates and no
destination to fake per-reason messages - the single `locked` line carries the reason, and the node
text can name the requirements.
**Enforced by:** `validate` errors when any choice is clickable in a reachable state but has no valid
`to` (self-tested); the engine also guards `goto` against a missing node as defense-in-depth.

## L4 - Hint level is role-relative: in-domain hints, out-of-domain gestalt only

**Feedback:** "Being a maintenance engineer does not mean you know all the details of how to operate
a medical surgery robot, so no hints and detailed description of functionality (maybe gestalt of the
items). On the other hand if a key tool is missing to complete an action that is 'in your backyard'
it should perhaps be hinted." The protagonist needs a backstory as input, even if it only surfaces
indirectly.
**Rule:** Calibrate every hint and every object description against the protagonist's expertise
(declared in the episode's `character` block: `{ role, expertise, backstory }`).
- **In-domain** (the character's `expertise` - their "backyard"): they know this. Name the tool, the
  system, the procedure. When a key tool or step is missing to complete an action they would
  obviously know how to do, hint it - the locked-choice hint may say specifically what is missing
  ("the bypass needs a hydrospanner you do not have"). Confidence is diegetic and correct.
- **Out-of-domain** (outside their expertise): describe by **gestalt only** - shape, weight,
  impression, dread - never function, never how to operate it, never what part is missing. (Gestalt
  is the default everywhere - see `docs/gestalt.md`; out-of-domain pushes it to the maximum.) The
  character's ignorance is part of the horror: a surgical robot reads as "a many-armed thing folded
  over the table, patient", not "the actuator needs a calibration key". Do not hand the player
  knowledge the character would not have.
- The `backstory` shapes voice and judgment (what they notice, fear, assume) but should surface
  mostly **indirectly** - do not dump it into the prose.
**Enforced by:** the `character` block is validated for shape and reported by `validate` (and stripped
at build); the calibration itself is judgment - checked by the skill while writing and on final read,
and by the reviewer against the stated profile.

## L5 - Episodes must be distinct from one another, openings most of all

**Feedback:** "We need to watch out so the stories are not too similar and most importantly do not
start in the same way with the exact same gestalt or descriptions." The narrow "wake alone in deep
space" premise pushes every episode toward the same wake/cold/alone/watched beat; that baseline is
fine, near-identical phrasing is not. Some recurrence is intentional (the house "attention" theme);
that must be told apart from lazy reuse. The check needs to be tunable and disable-able if not useful.
**Rule:** Across the anthology, no two episodes should share distinctive phrasing - and openings, most
of all, must not read as near-copies. Premise vocabulary (wake/cold/alone/...) is shared by design;
*distinctive* lines are not. A deliberate recurring motif is allowed only by adding it to the motif
allowlist on purpose, never by letting it slip through.
**Enforced by:** `tools/diversity.mjs` - a zero-dep, deterministic, **advisory-only** corpus check run
in `validate`'s whole-manifest pass (so it shows in CI, never gates). Signal 1: shared distinctive
n-gram phrases across episodes (stopword/common phrasing filtered, intentional motifs suppressed via
`tools/diversity-allow.txt`). Signal 2: TF-IDF cosine between episode openings, flagged above a
threshold. All dials and a master `enabled` switch live in `tools/diversity-config.mjs`; self-tested in
`tools/diversity.test.mjs`. It surfaces reuse for a human to judge (reword vs. allowlist) - it does not
block.

## L6 - Atmospheric/degraded prose must still parse on first read: no overcompressed metaphor

**Feedback:** on GRAFT's low-sanity `table` variant - "I don't understand this passage"
(`the whole has teeth`; `your eye has stopped trusting still`). The degraded variant reached for
mood and lost sense: a metaphor compressed past its literal meaning (`the whole has teeth`) and a
clipped, noun-dropped phrase (`trusting still`, meaning stillness) that reads as obscure or like a
typo.
**Rule:** This is L2 and the gestalt "not purple" rule applied to *atmosphere*. Dread, drunk,
glitching, low-sanity, and ending prose are still prose - a reader must parse them on the first
pass. Do not compress a metaphor until the plain meaning is gone, and do not drop words (especially
nouns) for rhythm in a way that reads as an error. Gestalt the *image* (suggestive); keep the
*sentence* legible (determinate). If a reader has to stop and decode it, rewrite. `sanityText` and
ending variants are the usual offenders because they invite a "poetic" register - hold them to the
same legibility bar as ordinary nodes.
**Enforced by:** this rule + the skill's final-read check (and re-read every `sanityText`/ending
variant cold, asking "does this parse?"). Subjective - not mechanically checkable.
**Watch especially:** any reword done to satisfy *another* constraint (breaking a diversity n-gram,
cutting a cliche, fixing cadence) can quietly trade legibility for the fix. GRAFT's gauge line went
obscure precisely when it was reworded to break a WARD echo. After any such edit, re-read the new
sentence cold for sense - do not assume a reword is safe because it cleared the original warning.

## L7 - `sanityText` REPLACES the base text, so every variant must stand on its own

**Feedback:** on GRAFT's bay - "Is the gauge introduced previously in the story since it being
referenced?" The low-sanity bay variants said "the gauge" and "since you last looked", but the
gauge is introduced only in the bay's *base* text.
**Mechanic (the trap):** the engine's `pickText` sets `t = node.sanityText[k]` for the lowest
matching threshold - the variant is shown **instead of** the base text, not appended. And a node can
be entered for the *first time* already below a threshold (in GRAFT, reading the consent screen on
the way down drops you to ~22, so the first time you ever see the bay you get the `20` variant). So
the base text - and anything introduced only there - may never have been shown.
**Rule:** Treat each `sanityText` variant as a complete, standalone description of the node, just
degraded. Re-introduce any object or place it names (do not lean on the base text to have
established it), and never imply prior presence ("again", "still", "since you last looked", "it has
branched") unless the node is provably only reachable after a prior visit. The base text is for the
calm first read; the variant must also work as a cold first read.
**Latent instances:** other episodes likely have this - e.g. WARD's `viewport` `40` variant opens
"It is not branching now. It has branched", which assumes the base text's branching was seen, yet
the viewport can be first-entered below 40. Worth an audit.
**Enforced by:** this rule + final-read for now. **Intended mechanical check** (not yet built): the
solver already tracks `entered` and `nodeMinSanity`; extend it to record each node's *first-arrival*
sanity, and warn when a node's highest `sanityText` threshold >= that first-arrival sanity (i.e. a
variant can be the first text a player ever sees for that node) so the author confirms it stands
alone. Pair with a fixture self-test, like the other solver checks.

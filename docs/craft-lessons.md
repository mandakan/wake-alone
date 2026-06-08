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

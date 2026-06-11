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
**Addendum (2026-06, corpus review):** distinctiveness covers *images and signature lines*, not just
n-grams. WARD's ending reproduced derelict's signature stroke ("Not pain, not fear. Attention.")
nearly verbatim, and VIGIL reused TENANT's palm-up glove with different wording - both below the
n-gram radar. A signature image or closing line belongs to one episode; reusing it elsewhere needs a
deliberate allowlist decision, never a drift. Checked by reading (the reviewer's slop lens compares
against `docs/gestalt.md`'s cited specimens).

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

## L8 - Ground before atmosphere: give the reader footing before the mood

**Feedback:** on FATHOM - "I think it's too vague and poetic ... it tries to be mysterious and
chilling but too much," and separately "it might be hard understanding what the character is doing
or trying to accomplish ... 'the trade' is a bit confusing." We worked the two complaints back to a
single confirmed root: **the prose reached for mood and mystery before giving the reader solid
footing.** Without footing, mystery reads as vagueness and the chill reads as noise.
**Rule:** Atmosphere sits *on top of* grounding, never instead of it. Two kinds of footing must be
on the page before the mood is allowed to do its work:
- **Image footing - what the reader can SEE.** Every dread beat, and every ending above all, needs
  one concrete, picturable thing (a telling object, a bodily sensation, an event) under the
  abstraction. Abstraction (regard, attention, "the looking") is seasoning on a concrete image, not
  the dish. FATHOM's endings that landed each had an anchor - stars that will not shift (parallax),
  a hand that is not there, a blank page above your name; the descent ending failed because it had
  only concepts and nothing to picture. If you cannot name the one thing the reader sees in a beat,
  it is fog, not fear. This is the image-legibility twin of L2's causal-legibility, and the
  concrete-fragments-not-a-blur core of `docs/gestalt.md`.
- **Orientation footing - who/what/why.** Within the first node or two, plainly establish who the
  protagonist is and what they are trying to do *here* - their immediate objective - in words a
  reader who never saw the `character` block can follow. The objective is orientation, not
  backstory: backstory stays indirect (L4), but what the character wants right now belongs on the
  page. In-world jargon for the profession ("the trade", "the discipline") is allowed only after it
  has been grounded in plain language first; never let an unglossed insider term carry meaning the
  reader needs to follow the story.
**Enforced by:** this rule + the skill's final-read, which now runs two checks - "name the one
concrete thing the reader sees in this beat; if there is none, rewrite," and "would a reader who
never saw the `character` block know, by the end of the opening, what this person is and what they
want?" - plus the reviewer's gestalt and legibility lenses. Judgment, not mechanically checkable for
now (a possible future heuristic: flag ending nodes with high abstract-noun density and no concrete
nouns).

## L9 - Land the dread by restraint: one concrete stroke, then trust the reader

**Feedback:** two rounds on FATHOM's endings. First they "[felt] like word salad ... mysterious ...
but it fails and never really brings the realization home" - each revealed a clever facet (the stars
do not shift; no hand; a blank page) and stopped at the oblique trick, the gut-punch withheld. So
they were rewritten to deliver the realization outright - and that over-corrected: "now I think they
might be too wordy and on the nose ... not really evoking the dread ... Are we staying true to the
corpus?" They were not. The plain-delivery version *itemized* the horror (no sky, no ship, no body,
no past, alone, not getting out) and *narrated* the realization - exactly the "bald catalogue" the
corpus forbids.
**Rule:** A reveal has two failure modes and one narrow target between them. **Fog** (too oblique):
no concrete anchor, only concept ("the looking has no other side") - the reader cannot furnish the
horror because nothing was given. **Lecture** (too plain): the anchor is there but every implication
is spelled out - the dread dies on contact, against Blackwood's "keep it inferred," Lovecraft's
"imply; don't itemize," and Mary Celeste's "let the player furnish the horror" (`docs/style-cards.md`).
The target, and the house default (derelict's one-word "Attention."): **give one concrete, picturable
anchor; accrete the dread in a sentence or two; end on one short flat stroke - then stop, leaving the
seven-eighths unsaid for the reader to assemble.** Deliver the *turn*, not the *consequences*: name
the thing that just happened (the measurement leaned back; there is nothing to reach with; the page
above your name is blank) and let "kept mind / no body / forever" detonate in the reader, unstated.
This is L2's legible causal turn held in tension with gestalt/iceberg restraint - the horror's full
weight stays below the surface. Where an anthology's endings share one truth, give each a different
concrete anchor onto the same prison (FATHOM: a false star that will not recede; a hand that was
never there; a blank page; a kept thing in a cradle; the scope set down) - never the same image,
never the spelled-out list. Distinct from L8: L8 is *have* an anchor and orient the reader; L9 is
*land the anchor and then stop* - one flat stroke, not a paragraph of what it means.
**Enforced by:** this rule + the skill's final-read, now a two-sided check per ending: "is there one
concrete thing the reader can picture, AND is the realization delivered by a single flat stroke
rather than an itemized explanation? If it reads as a list of what-is-no-longer-true, cut back to the
one stroke." Plus the reviewer's gestalt and ending-legibility lenses. Judgment, not mechanically
checkable (a future heuristic could flag ending paragraphs over N sentences, or with a run of
"no X, no Y, no Z" clauses).

## L10 - Keep the protagonist's body state coherent: never reference a limb the character can't use

**Feedback:** on GRAFT's `straps` node - "This part is hard to understand and does not make sense
since one hand is not even available to the protagonist." The episode's premise is that the right
arm runs into the machine at a wrist coupling and the right hand is severed in a cylinder, so there
is exactly **one** usable hand (the "good hand") and **one** cuffed wrist. The restraint node still
said "Both wrist cuffs" and "Your hands are on the releases" / "Free your chest and wrists" - asking
the reader to picture two working hands the character provably does not have. The contradiction
breaks immersion the moment the reader tries to stage the action.
**Rule:** When an episode alters or constrains the protagonist's body (a missing/severed/coupled
limb, a bound hand, an injury that costs a faculty, a body "taken in stages"), that state is a
running fact the prose must honour at **every** node, not just where it is introduced. Track what the
character actually has: how many hands are free, which wrist is cuffed, what they can reach. Never
write "hands"/"both"/"wrists" by reflex when the established state is singular. The constraint is
usually the horror's whole point - referencing the lost part as if it were present throws away the
dread and reads as a generation slip. House examples done right: GRAFT consistently routes every
physical action through "your good hand" and frees the coupled arm as a separate gated step; the
restraint node now reads "The cuff on your free wrist. The other arm the machine holds its own way,
and no buckle will answer for that."
**Enforced by:** this rule + the skill's final-read, which now runs a body-state pass: "name the
protagonist's physical constraints established anywhere in this episode (lost/bound/altered limbs or
faculties); then scan every node's prose and choice text for any reference - 'hands', 'both', a
specific limb, an action requiring two hands - that the constraint forbids, and rewrite it." Plus the
reviewer's continuity lens. Judgment, not mechanically checkable in general (the prose-lint's
"your <item> you can't hold" check is the closest existing mechanical cousin; a future heuristic
could flag plural 'hands'/'both wrists' in an episode whose `character`/opening establishes a
single-hand state).
**Addendum (2026-06, corpus review):** the rule generalizes from the protagonist's body to **scene
state**. Any established physical fact of a scene - a body occupying a chair, a sealed hatch, a
restraint that was never released on the page - binds every later prose and choice reference to that
scene. BECALMED offered "Sit in the captain's seat" while the captain's nine-days-dead body was
established as sitting in it; WARD cuffed the protagonist's wrist in `wake` and never spent a clause
releasing it. Never offer an action the established scene state makes impossible to stage without
acknowledging the obstacle.

## L11 - A sanity-costing choice must buy prose: no stat-tax self-loops

**Feedback:** corpus review (2026-06). BECALMED's three biggest dread beats (-30 sit in the captain's
seat, -22 look at your own chair, -30 watch where the boat went), FATHOM's port scrape (-10) and
look-for-your-ship (-15), and TENANT's glove pickup (-8) all looped back to the same node whose text
never changed. The player pays the episode's heaviest costs and is shown nothing - the choices read
as mechanical self-harm buttons, not scares, and the unchanged base text then contradicts what the
player just did (FATHOM's lock still promised "the way back to your ship" after the look established
there is no ship).
**Rule:** A choice that costs sanity must land on new prose. Never loop a sanity-costing action back
to its own node: route it through a one-shot payoff node (the watchroom_log / hold_glove /
register_read pattern) that shows what the cost bought, then return to the parent. Big optional hits
(~-20 or worse) above all: a major cost with no payoff is a bug, not a scare.
**Enforced by:** `validate` errors on any choice with a negative `effects.sanity` whose `to` is its
own node (self-tested). The judgment half - whether the payoff prose is *worth* the cost - stays with
the skill's final read and the reviewer's tension lens.

## L12 - A payoff may only lean on what its route guarantees

**Feedback:** corpus review (2026-06), the most repeated finding class. BECALMED's endings invoke
"the four words" that exist only in the optional watchroom_log; DERELICT's darkgap body has "that
same terrible attention" pointing at a sheet-lift on another optional branch; DERELICT's airlock
ending pays off hearing the stars call when no node ever planted a call; WARD's central reveal cites
"every time you bent to the grille" on routes that never visit the panel; VIGIL's warning node recaps
a recording from a sibling branch the player may not have seen.
**Rule:** This is L7 generalized beyond `sanityText`. Before shipping any payoff - an ending's anchor
image, a reveal's "you have been doing X all along", a comparative ("that same X", "again"), a recap
of evidence - list what it presupposes, and check each item against every route that can reach the
node, not the intended one. Three legal moves: (a) restate the referent inline so the beat works as a
cold read, (b) gate the payoff on the flag that proves the player saw the source, (c) cut the
presupposition ("a terrible attention" instead of "that same terrible attention"). An ending may only
pay off motifs some reachable prior node actually planted - a retro-declared motif is a non sequitur
at the worst possible moment.
**Enforced by:** this rule + the skill's final-read (per ending/reveal: "what does this line assume
the player has seen, and does every route guarantee it?") + the reviewer's legibility and coherence
lenses. Judgment; the solver's reachability data makes spot-checks cheap.

## L13 - Static prose must hold in every state it can display

**Feedback:** corpus review (2026-06). DERELICT's engineering `30` variant asserts "The reactor hums
even though it's dead" and "The panel is bolted shut" - false after the player restores power and
opens the panel, then returns below 30. GRAFT's hatch says "you can feel the gauge climbing" at the
one moment every escaping player is holding the cell that drives the climb, and its surrender endings
run on power the player may be carrying away. FATHOM's locked hint diagnoses "you do not have the
release code yet" - false for the player who has the code but lacks the seal. FATHOM's datum keeps
the scope on its tripod after the player pockets it.
**Rule:** Node base text, `sanityText` variants, and `locked` hints are static: they render in every
game state that reaches them. Never assert a mutable world fact (power on/off, a panel open/shut, an
item still on its shelf, a mechanism the player can disable) unless every state that can display the
text agrees with it. Three legal moves: (a) word it state-neutral (name only what cannot change),
(b) gate the path so contradicting states cannot reach it (requires/notItem with a locked line),
(c) put the mutable fact in a one-shot node instead. `locked` hints specifically: phrase the FULL
requirement list ("the console will not arm without command authorisation and a live reactor"), never
a diagnosis of which piece is missing - and never let a locked hint leak gated *knowledge* (VIGIL's
"you need to know how to cross unseen" handed the player the survival technique the flag was
guarding). L7 is this rule's first-arrival special case; this is the every-arrival rule.
**Enforced by:** this rule + the skill's final-read + the reviewer's coherence lens, plus two
solver-backed advisory warns in `validate` (self-tested): a pickup room whose `text`/`sanityText`
still names an item one of its own choices adds, when the solver proves the node can re-render with
the item already in inventory; and a re-enterable start node (anything routing back to `start`),
which replays its wake-up prose on every return - make the start a one-shot intro feeding a
state-neutral hub. The warns match item ids/labels only: a paraphrase ("a torch on its charging
hook" for `flashlight`) or a flag-gated fact (a cut conduit, an opened cabinet) still needs the
human read. House pattern for pickups: the room text describes the fixture (rack, hook, cradle,
shelf); only the take-choice's label - which hides itself after the take - names the item.

## L14 - The escape must cost something: a forced-loss floor on the optimal route

**Feedback:** corpus review (2026-06). DERELICT (forced loss 15), VIGIL (16), and TENANT (10) all let
an informed player escape near full sanity while the prose claims an ordeal ("forty meters of the
hardest stillness of your life" - costing 0). The climax has no teeth on replay, the "watching" lines
never fire, and the ending's relief is unearned.
**Rule:** The cheapest escape route must charge a real price. Reason about forced loss (costs the
route cannot avoid, ignoring med-gel restores), not final sanity: free pickups and avoidable scares
do not count. House floor: at least ~20 forced loss on the optimal escape path; the climactic action
itself should usually carry a cost. Restores exist so the player can afford the horror, not so the
horror is optional.
**Enforced by:** `validate` re-runs the solver with med-gel disabled and warns (advisory) when the
best escape's forced loss is under 20 (self-tested). Tuning the *feel* stays judgment - the reviewer's
tension lens asks "does the good path read hard-won?"

## L15 - No construction may become a tic: scaffolds, closing formulas, negation runs

**Feedback:** corpus review (2026-06). The "the way X" simile scaffold carried 12 comparisons in
GRAFT, 9 in WARD, 8 in FATHOM ("patient the way only it is patient", "dressed the way you are
dressed") - mid-sentence, so the opener heuristics missed it, and by mid-episode the frame is
audible and the simile that needs it most (WARD's central reveal) lands as one more flourish. FATHOM
closed three of five endings on the identical move (the watcher leaning close "to see whether X");
BECALMED closed two endings on the same dying green cell; negation runs ("no X, no Y, no Z") recurred
five times in FATHOM, three of them in endings.
**Rule:** Rhetorical constructions are spent by use. Per episode: one simile scaffold ("the way X",
"like X", "as if X") carries at most ~4-5 comparisons - keep the strongest, recast the rest as direct
statement or different syntax. Per episode: no two endings share a closing syntactic formula or
closing image - put the last sentence of every ending side by side before finishing (this is L9's
different-anchors rule extended from images to syntax). Reserve an inversion/chiasmus ("not A but B")
for the beat that needs it - if it ran four times before the reveal, the reveal inherits a worn tool.
Negation-run itemizing is allowed where an inventory of absences IS the point, once.
**Enforced by:** `prose-lint` warns (advisory) when "the way " exceeds 5 uses across an episode
(self-tested). The closing-formula side-by-side and inversion-budget checks are judgment - the
skill's final-read and the reviewer's slop lens.

## L16 - In an ending, the hint stops being deniable: state the causal fact, keep the nature gestalt

**Feedback:** on FAULT's relief ending - "perhaps a bit too vague for someone not in on the plot
twist? I don't want to break gestalt but can we make the hint a bit more clean." The ending's one
reveal carrier ("The entries are in your syntax") was written to the same deniability standard as
the episode's mid-run clues - and a chief systems officer's syntax in a duty roster has a perfectly
innocent reading, so for a player not already in on the twist the ending carried no turn at all.
**Rule:** Deniability is a virtue in clues and a defect in endings. Mid-episode, a twist clue should
survive an innocent reading - that is what makes it a clue. At an ending, above all one reachable
before any evidence has been seen, the *causal fact* must be stated undeniably (you wrote the
schedule that killed them, and you are writing a new one), while the *nature* of the wrongness (what
you are) may stay gestalt. This is L2's explicit-cause rule plus L9's fog/lecture line, specialized
for twist episodes: the reader must leave the ending knowing what happened, even if not yet what
they are. Test: read each twist-gated ending as the player who took the shortest route there - if
every reveal-bearing line still has an innocent reading, it is fog; sharpen the fact, not the
ontology.
**Enforced by:** this rule + the skill's final-read (per ending: "does the cause survive an innocent
reading? it must not") + the reviewer's ending-legibility lens. Judgment, not mechanically checkable.

## L17 - The deaths must be findable when dread needs them: traces as effects, spent sparingly

**Feedback:** on FAULT (2026-06) - "I'm sort of missing the dread creeping up. I don't want a lot of
gore but the traces of the crew and how they were killed are almost completely absent... None of the
episodes is supposed to be child friendly, rather the opposite." Calibration from the same feedback:
do not force traces into every episode, and do not discourage them - use them sparingly, where they
matter to the dread and the story.
**Rule:** "Dread over gore" forbids splatter, not evidence. An episode whose horror includes dead or
taken crew should usually let the player *find how it happened* in physical traces - staged as
effects, never wounds: the scratches that stop at the seam where a door held, a pump counter at
fourteen bags, lights that dimmed as a courtesy while the air went. Absence-of-people is a house
mode (Mary Celeste); absence-of-evidence is usually just thinness. Calibration: traces are a spice,
not a quota - a few charged ones beat coverage (gestalt, L9); place them where they pay the
episode's mechanic (in FAULT every trace is a system doing exactly as it was told); and a zero-trace
episode is allowed as a deliberate choice, never as a default. The cruelty ceiling: procedural and
implied beats anatomical and shown - the nastiest line should be one a child could read aloud
without understanding.
**Enforced by:** this rule + the skill's final-read ("can the player find how the crew died, and does
each trace name an effect, not a wound? if the episode has none, was that chosen on purpose?") + the
reviewer's gestalt and tension lenses. Judgment, not mechanically checkable.
**Addendum (2026-06): the register ladder and the `traces` dial.** Trace intensity is tunable per
episode via the optional spec field `"traces"` (`tools/spec.mjs`, enum-validated):
- `absent` - deliberate Mary Celeste mode; satisfies the deliberate-zero clause above.
- `restrained` - counter-facts: the evidence states what happened, no forward motion ("the pump's
  counter reads fourteen bags").
- `forward` - the systems are still mid-task: a request pending ("has put in for more"), a setting
  offered to the player ("the panel offers you the same setting now"), an answer that poisons an
  earlier line ("it is the same answer it gave you this morning").
Every rung must pass the **read-aloud test**: the nastiest sentence stays one a child could read
aloud without understanding - the dial moves how far the implication reaches, never how much is
shown. Method: draft all traces at `restrained`, then amplify only the few that pay the episode's
mechanic by one rung; never amplify everywhere (L15 - a register used everywhere becomes a tic).
To re-tune a shipped episode, declare the dial in its spec and run `/review-episode` - the gestalt
lens reports rung mismatches as findings.

## L18 - sanityText has a register, not just an intensity: the psychotic ladder is opt-in and stays lucid

**Design intent (2026-06, register pass; not a playtest finding):** every other lesson in this
ledger is feedback-driven; this one is forward design intent from the psychotic-register pass -
rewrite it if playtest feedback supersedes it. The existing `sanityText` default is the Gilman
mode - the same space re-read as subtly, then overtly, *wrong* (L7's "degraded"). That is one
register. A second is available: the same space re-read as *psychotic* - referential, recorded,
obeyed. The four interior-collapse style cards (Schreber, Beers, Perceval, Merivale - see
`docs/style-cards.md`) distill its mechanics. This lesson is the guardrail set for writing it
without tripping L6/L7/L9/L13/L15, and the dial that keeps it from becoming the house default.
**Mechanic (the dial):** the optional per-episode spec field `"sanityRegister"` (enum, validated
in `tools/spec.mjs`, stripped at build with the rest of `spec`):
- `wrong` - **default.** The Gilman degrade: same objects, re-read as off, then wrong. What the
  episodes already do; absence-mode (Mary Celeste) and body-horror episodes stay here.
- `psychotic` - the ladder below. Opt-in only, so it remains ONE distinct mode among several (L5),
  never the thing every episode drifts into.
**Rule - the band ladder (escalate grammar across the thresholds you already use):**
- **Reference (fires high, ~45-60).** Lowest intensity, most deniable. The space tilts toward
  *meant*: a thing seems arranged, addressed, intended - at you. The narrator might still be wrong
  about being watched. (Beers, low gain.)
- **Record (fires mid, ~35-44, the `40` band).** The apparatus, stated from inside: you are being
  taken down; a thought arrives already known, a half-beat late; a voice repeats one learned phrase,
  by rote, the same phrase. The room re-reads as instrument. (Schreber's writing-down system.)
- **Command (fires low, ~20-30).** The obeyed voice in the character's OWN register: an instruction
  surfaces - reasonable, in-domain (L4), compelling - and complying feels like the only sane act;
  the self-argument ("you know it isn't, you *know* it") loses. (Perceval; Schreber's
  lucidity-toward-a-wrong-conclusion; Merivale's collapsing self-defence.)
**Rule - the guardrails (all of these are existing lessons, applied to this register):**
1. **Legibility is the hard floor (L6).** This is the project's highest word-salad risk. The power
   of the source (Schreber above all) is lucidity: sane sentences reasoning correctly off a corrupt
   premise. Every sentence must parse on a cold first read; only the *premise* is mad. A line that
   reads as poetic noise has failed the register, not achieved it. "Sane voice, wrong world," never
   "the whole has teeth."
2. **One move per node (L15).** Reference / record / command do not stack inside one variant - pick
   the single move the node's content pays. Across an episode, do not run the same move at every
   threshold; the three rungs are the variety.
3. **Standalone and state-true (L7/L13).** The delusion re-reads existing objects: re-introduce what
   it names, assert no mutable fact. "The logs are addressed to you" (state-neutral) yes; "the panel
   you opened is addressed to you" no.
4. **One concrete anchor; never itemize the system (L8/L9).** The delusion fastens to a single
   picturable thing - the dust, a readout, the voice's one phrase - not to free-floating concept.
   Never lay out the whole delusional cosmology: that is Schreber's theology and L9's "bald
   catalogue" in one move.
5. **Second person; drop the period metaphysics.** Convert the first-person sources to "you." Take
   the apparatus and the compulsion; leave the sources' God / unmanning / religiosity behind
   (no-pastiche rule, `docs/inspiration.md`). The mechanic transfers; the 1900s cosmology does not.
**Enforced by:** the `sanityRegister` enum is mechanical (`tools/spec.mjs`, self-tested in
`tools/validate.test.mjs`); the rest is this rule + the `author-episode` skill's final-read, which
gains a register pass when `sanityRegister: psychotic`: per variant - "(a) does it read as a lucid
wrong belief that parses cold (L6); (b) does it attach to one concrete anchor (L8); (c) is it a
single delusional move, not the whole system (L9/L15); (d) is it state-true and standalone
(L7/L13)?" Plus the reviewer's gestalt and legibility lenses. The legibility half is already partly
covered by L6's check; no new mechanical gate is required, though a future advisory heuristic could
flag psychotic-mode variants with high abstract-noun density and no concrete noun (same shape as
L8's mooted ending heuristic).

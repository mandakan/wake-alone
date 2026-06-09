# FATHOM - episode design

A WAKE ALONE episode where every ending presents as a hard-won escape, then drops into
the truth: the protagonist never arrived, there is no outside, and something many-eyed and
patient is taking soundings of *them*. Maybe a head in a vat; maybe a cage. You are not told.

## Logline

A deep-space survey contractor wakes mid-measurement inside a structure they were hired to
chart. Every route they assemble to *finish the map and leave* delivers a triumphant beat and
then collapses, in a different register each time, into being a studied specimen.

## Dials (`spec`)

- `size: standard` (12-14 nodes)
- `punishment: cruel` (high death ratio; madness reachable)
- `escape: forbidden` (no survivable exit; any `escape`-typed ending is a validator ERROR;
  episode must stay completable via death/madness)

## The legible core mechanic (L2)

The observers run one experiment: what does the subject do when it tries to leave, and when it
tries to know what is real. Trying is the data. Every ending names this plainly before any
flourish - "you assembled the way out; the assembling was the experiment; here is what it
bought you" - so no ending reads as a cheap gotcha.

The frame is deliberately ambiguous (vat vs. cage). The not-knowing IS the mechanic, not
evasion: each ending resolves the escape-fiction while dropping a DIFFERENT register of the
reveal, so across a full playthrough the player is never handed a consistent answer.

## Protagonist (`character`, drives L4)

Survey contractor / structural cartographer. In-domain: distances, bearings, whether a place
"adds up," closing a map. That competence is the trap - their certainty that real space is
consistent is exactly what the structure violates, and their need to close the map is the
experiment. The observers and the apparatus are out-of-domain for any human and stay pure
gestalt (many eyes, wrong regard, never named or explained).

- role: structural cartographer / survey contractor
- expertise: surveying, cartography, spatial triangulation, structural sounding, navigation bearings
- backstory (surfaces indirectly): a career closing maps of dead structures; the discipline that
  a true place always adds up, that the numbers do not lie. Here they do.

## Distinct opening (L5)

NOT "you wake / you surface from cryo" - every existing episode opens that way. FATHOM resumes
mid-action: you are counting paces and realize you do not know what number you were on. The
scene was already running when you noticed you were in it.

## Map

One hub (`the datum` - a surveyor's fixed reference everything is measured from, and the room
you keep returning to: the trap made literal). Three outward branches + one inward.

```
                        start  (mid-survey opener)
                          |
                      [ the datum ]  <- hub, you keep returning here
                     /     |     \      \
            viewport    egress   records   the descent (inward)
              |           |         |          |
   sighting/clear     suit+code   manifest   the center
              |           |         |          |
        END: bearing  END: egress  END: records   END / madness
```

## Endings (all `type: dead` - stamp carries false hope, prose guts it)

| Branch | Assembles (cross-branch gate) | False win / stamp | Reveal register |
|---|---|---|---|
| Viewport | sighting tool + cleared port | `// POSITION FIXED` (you know where you are) | The eyes. Behind the resolved "stars," regard. Every window held the same dark. |
| Egress | seal/suit + lock code | `// AIR AND STARS` (you cycle the lock, step out) | Vat. You reach for the wheel and have no hand. Never had one. The suit was a sensation lent to you. |
| Records | manifest power + your name found | `// ON RECORD` (proof you existed before this) | Cage. The door out of records opens on the datum. The log is in your own hand though you never wrote it; one page deep, blank behind. |
| Descent | go inward, heavy sanity cost | `// CENTER REACHED` (you find the source) | Looking directly. The center is the act of being looked at. Depleted -> automatic madness (sanity 0); steadier -> survive to the dead ending. |

Plus a hub quiet-death at low sanity: `// SURVEY ABANDONED` (you stop trying to close the map
and sit; mirrors BECALMED's end_stop).

5 authored `dead` endings + reachable automatic madness -> death ratio 100%, clears `cruel`.

## Cross-branch assembly ("build your own punchline")

Egress needs the **seal** (found on the viewport branch) + the **lock code** (found on the
records branch), so the most "complete" escape forces a full tour of the structure - the more
thoroughly you earn the exit, the more total the reveal. Each item/flag is read by exactly one
ending gate (no dead items; validator-clean).

## Sanity economy (start 100; forbidden, so endings need not leave you > 0)

- minor wrongness -5..-10; a real seam (a corridor that measures two lengths) -12..-18; the
  descent's center -30..-35.
- 2 med-gel (+25 each): one on the viewport branch, one in records.
- Tuned so a player can consciously walk into any of the four dead endings while still alive (a
  chosen false-escape, not forced), AND a player who pushes the descent while depleted hits 0 =
  madness. Solver must confirm: descent-to-madness route exists; each dead ending reachable.

## `watching` lines (shipped; UPPERCASE ASCII; observers' field notes)

Inhuman, observational, tied to the surveyor's actions. Draft pool:

- IT IS COUNTING THE ROOM AGAIN.
- THE COUNT NEVER MATCHES. NOTE THE DISTRESS.
- WE GAVE IT HANDS THIS TIME. OBSERVE THE PREFERENCE.
- IT IS LOOKING FOR THE OUTSIDE.
- IT BELIEVES THE LOG IS ITS OWN.
- THE SUBJECT REACHES FOR THE DOOR.
- MEASURE WHAT IT DOES WHEN IT CANNOT LEAVE.
- STILL TRYING TO CLOSE THE MAP.
- IT HAS NOT NOTICED US. GOOD.
- RUN IT AGAIN.

## Craft guardrails to hold while writing

- L1: single hyphen `-`, ASCII only.
- L2: every ending leads with cause (the named experiment) before dread.
- L4: in-domain (layout/bearings) gets named tools and a hinted missing tool; out-of-domain (the
  observers, the apparatus) is gestalt only.
- L5: opening must not echo any existing episode's wake/cold/surface phrasing.
- L6: degraded/ending prose must still parse on first read - no overcompressed metaphor.
- L7: every `sanityText` variant stands alone (re-introduce what it names; no "again/still"
  unless the node is provably second-visit-only).

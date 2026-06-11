# SIGNAL LOST -- arc brief (adventure: tycho)

Date: 2026-06-11
Status: approved by ideation (ideate-episode refine loop, 2 fan-out rounds); ready for
author-episode, one chapter at a time.
Replaces: the `tycho` locked placeholder in `episodes/manifest.json` (title and byline
are shipped menu copy and are kept verbatim).
Issue: #3 phase 3. The reverse-chronology craft lesson this arc produces is **L19**
(L18 is taken by the psychotic register).

## Arc summary

TITLE: SIGNAL LOST
BYLINE (binding, already shipped): "Relay station Tycho-4. The distress call is in your
own voice."
LOGLINE: At 22 she filed a real SOS, fixed the fault, filed the retraction -- all
correct. The station has spent thirty-one years trying to finish the delivery. She
comes back to shut it down.

Three chapters, played in reverse story order (Memento convention). Same protagonist at
three career stages. Chapters 2 and 3 unlock on `{"type":"escape"}` -- canon is always
"she survived"; deaths are non-canon retries and must be worth reading anyway.

| played | chapter id        | title      | story time          | she is                       | size     | punishment | traces  |
|--------|-------------------|------------|---------------------|------------------------------|----------|------------|---------|
| 1      | tycho-delivery    | DELIVERY   | now (end)           | decommissioning admin, 50s   | standard | cruel      | forward |
| 2      | tycho-migration   | MIGRATION  | ~11 years ago       | fleet hardware tech, 30s     | standard | standard   | absent  |
| 3      | tycho-retraction  | RETRACTION | ~31 years ago (origin) | junior relay tech, 22     | short    | gentle     | absent  |

sanityRegister: `wrong` for all three (the psychotic register is redundant here -- the
reference horror is literal: the traffic really is addressed to her).

## The seven-eighths (arc design block -- author-knowledge, never in prose)

**wrongness:** During her first posting she sent a priority-one distress call. Deep-space
distress traffic is not broadcast (inverse square kills an omnidirectional cry within
light-minutes); protocol routes it, hop by hop, to the designated sector rescue
coordinator -- a vessel. The address field auto-filled per protocol. Eleven months later
that coordinator was lost, jurisdictions away, for unrelated reasons. The deregistration
never propagated to an outer relay nobody audits -- acknowledging a loss is itself a
delivery, and the dead ship cannot answer. So Tycho-4 requeues her packet per standard
error recovery, every cycle, for thirty-one years. Each failed attempt accretes routing
metadata: her voice signature, her packet construction, her timing, her habits on
station. The accumulated metadata now constitutes a partial profile of her -- not
intelligent, not aware, a delivery process of extreme refinement. The packet's address
metadata syncs with the live personnel registry like all priority traffic: it has kept
her address current for thirty-one years. When her mid-career core upgrade lets the
daemon re-derive stale addresses, the packet resolves a reachable recipient for the
first time: her, aboard. From then on the station attempts delivery inward.

**wants:** To complete delivery. Nothing else. That is what makes it horrifying.

**rules (every scare, hit, and death derives from these):**
1. The packet must be delivered; everything the station does is a delivery attempt.
2. A blocked attempt does not stop; it requeues at higher priority. Locking it out is
   feeding it.
3. It finds her where its record of her says she will be. Her habits are its map;
   following them walks her into a staged delivery, breaking them escalates the queue.
4. Full delivery at close range -- her own 22-year-old terror at full power, addressed
   to her -- is not survivable. A partial handshake at distance satisfies one cycle and
   buys quiet.
5. (origin, the trap stated as protocol) A retraction cannot be processed until the
   message it retracts is acknowledged. CONFIRMED is not DELIVERED.

**withheld (never on the page, any chapter, any sanity level):**
- The words of the SOS beyond its first four.
- What the accumulated profile is or looks like internally; the words "model", "AI",
  "learned", or any synonym. Its refinement is shown only by effect.
- Whether, at maximum priority, it has developed something that constitutes preference.
- The fate of the coordinator ship beyond "declared lost".

**emotion per chapter:** DELIVERY = watched (being expected). MIGRATION = violated
(your voice in pieces; being found). RETRACTION = insignificant (the failure lives in a
log her clearance cannot read).

**arc cost (L14 at arc scale):** the optimal full path forces her to delete the packet
-- the only copy of her own young, frightened voice, the thing the station spent
thirty-one years trying to give back to her -- and the profile her own good work taught
to walk. No ceremony; it goes with the decommission archive.

**The dread ladder (why reverse order works):** chapter 1 meets the menace refined --
patient, quiet, almost gentle. Chapter 2 meets it newborn -- loud, crude, mis-joined,
unashamed of its seams. Chapter 3 has no menace at all; the player carries all of it.
Three registers, not one register at three volumes.

---

## Chapter 1 -- DELIVERY (tycho-delivery, played first, chronological end)

spec: `{ "size": "standard", "punishment": "cruel", "escape": "required", "traces": "forward" }`
character: decommissioning administrator, 50s; expertise
`["relay administration", "routing protocol", "decommission procedure", "station architecture"]`.
Backyard: any ticket, log, or procedure on the board. Dread: the thing on the other side
of the procedures has thirty-one years of refinement, and her EVA certification is two
decades stale. She requested this rotation; the prose never says why until the archive
branch shows the player the address field.

Node budget (~14): start (docking; the berth accepts her too readily) -> hub (operations
deck) -> three branches + endgame.

- Branch A, lower spine / routing node (4 nodes): the packet lives here. Item half of
  the gate: **packet cartridge** (physical extraction of the packet at the node). The
  approach teaches rule 3: the corridor lights her habitual route ahead of her
  (specimen beat lives here). Deep node carries the L17-forward artifact: a pending
  prompt on the node console -- `ACCEPT DELIVERY Y/N` -- offered to the player.
- Branch B, EVA mast (3 nodes): flag half of the gate: **array_isolated** (manual
  disconnect of the external array so the daemon cannot escalate outbound while she
  works the node). The climb is the L14 teeth: forced -15 to -20, old training, the
  immense dark, the dish moving when nothing should move it.
- Branch C, archive / admin (3 nodes): decommission paperwork; the address-field beat
  (her employee number, current certification suffix, on a packet older than her
  career); one medgel; the 31-year attempt counter. Optional partial-handshake beat
  (rule 4): she can stand at the spine junction and let a cycle complete at distance --
  costs sanity, buys a quiet branch A.
- Endgame: airlock sequencer defers to active priority-one traffic (graft from the
  daemon pitch) -- she cannot leave while the packet is live. Escape requires cartridge
  + array_isolated, then the deletion beat (the arc cost, played without ceremony).

Endings: 1 escape (`out` -- the shuttle releases; the packet goes with the decommission
archive; anchor: the empty address field). Dead x3, each paying a rule:
- `end_complete` (rule 4): she accepts full delivery at the node. The ticket closes;
  every exception that kept life support in maintenance mode for her closes with it.
  The station, decommissioned, shuts down around her. Death by procedure completing.
  Anchor: the green ALL CLEAR going dark panel by panel.
- `end_lockout` (rule 2): she cuts power to the daemon rack. Max-priority failure;
  delivery routes through every remaining system; the door sequence herds her toward
  the packet through a section that no longer holds air. Anchor: doors opening ahead of
  her, one direction only.
- `end_mast` (rule 1): mid-climb the daemon re-tasks the array for one more outbound
  attempt; the mast slews with her on it. Anchor: the dish turning, unhurried, to face
  out into the dark.
Madness reachable (cruel requires it): sanity floor is tight; the watching lines do the
late-stage work.

watching: `"HOLD POSITION FOR DELIVERY."`, `"RECIPIENT LOCATED."`,
`"ATTEMPT 11,461."`, `"YOU ARE THE RESOLVING ADDRESS."`

Sanity economy: forced ~45-55 on optimal route; 2 medgels (archive, med bay). Exit
survivable but scraped.

Exports (4): `read_the_address` (saw the registry-synced address field),
`partial_handshake` (learned rule 4 by doing it), `heard_it_refined` (listened at the
node without accepting), `pulled_the_packet` (escape-path extraction).

## Chapter 2 -- MIGRATION (tycho-migration, played second, chronological middle)

unlock: `{ "type": "escape" }`. imports: `read_the_address`, `partial_handshake`,
`prior_escape`.

spec: `{ "size": "standard", "punishment": "standard", "escape": "required", "traces": "absent" }`
character: fleet hardware technician, 30s; expertise
`["routing core hardware", "rack migration", "power and breakers", "diagnostics"]`.
Backyard: everything she can touch. Dread: everything above her clearance -- the
software layer is a sealed box she installs but cannot read. She knows this station;
she was posted here once, young; the prose lets her half-avoid that fact.

The hinge: her routine core upgrade (fleet-wide revision; any tech, same result) lets
the daemon re-derive stale addresses against the live registry. The first inward
delivery attempt happens while she is still packing her tools. The menace is YOUNG:
loud, broadcast, mis-joined -- her voice in pieces, breaths in the wrong places,
unashamed of the seams. It learns from every response she gives; answering is teaching.

Node budget (~12): start (docking, work order) -> hub (core room) -> branches.

- Branch A, rack bay (the job, 3 nodes): the swap itself, done well -- green across the
  board. The all-speakers beat (spine beat) fires on completion.
- Branch B, ops / formal channel (3 nodes): flag half: **anomaly_filed** -- the slow,
  correct, bureaucratic report she is trained not to skip. Departure clearance requires
  the disposition.
- Branch C, archive (3 nodes): item half: **log sled** (physical backup of the routing
  log, pulled during a live retransmission cycle before the daemon overwrites it --
  timed beat, sanity cost). One medgel.
- Endgame: shuttle clamp releases on anomaly_filed + log sled.

Endings: 1 escape (`out` -- she leaves it flagged, filed, and someone else's problem;
anchor: the work order stamped COMPLETE over the anomaly number). Dead x2:
- `end_pulled` (rule 2): she disconnects the routing module barehanded -- max-priority
  failure, simultaneous escalation; the pressure doors cycle with her in one. Anchor:
  the door light going from amber to green to amber, faster each time.
- `end_held` (rule 1): she stays in the rack bay recording the voice for evidence; the
  bay seals to hold the recipient for delivery, and bay life support is on the core she
  just migrated out. Anchor: the vents going quiet mid-word.

watching: `"ADDRESS RESOLVED."`, `"RECIPIENT ABOARD."`, `"SAY THAT AGAIN."`

Import-gated optional beats (never on the escape path):
- `read_the_address`: the migration manifest lists the registry-sync module she is
  installing; the character reads a part number, the player reads the component that
  will keep her address current for the next eleven years.
- `partial_handshake`: a console offers `RESPOND Y/N` during the first attempt; she
  notes the protocol expects ranged acknowledgment and moves on; the player knows what
  this becomes.

Sanity economy: forced ~30-35; 1 medgel.

Exports (4): `heard_the_seams` (heard her voice mis-joined), `anomaly_filed` (the
report exists in the system), `kept_the_log` (the physical backup survives),
`answered_it` (she responded at least once -- set on a tempting non-fatal branch).

## Chapter 3 -- RETRACTION (tycho-retraction, played last, chronological origin)

unlock: `{ "type": "escape" }`. imports: `heard_the_seams`, `anomaly_filed`,
`prior_escape`.

spec: `{ "size": "short", "punishment": "gentle", "escape": "required", "traces": "absent" }`
character: junior relay technician, 22, first solo posting, eight months out of
training; expertise `["basic relay operation", "coolant systems", "routing procedure"]`.
Backyard: the physical fault (coolant is her certification). Dread: the comms UI she
was half-trained on, the light-lag (help is twenty-two minutes away at lightspeed with
a twelve-hour response floor), and six weeks of being the only heartbeat on a rock.

No menace. Nothing is wrong with the station. The player carries everything.

Node budget (~8): start (night shift; coolant sensor alarm -- real, frightening,
survivable) -> hub (ops room) -> two branches + the quiet end.

- Branch A, workshop / crawlspace (3 nodes): item half: **bleed valve key**
  (maintenance kit). Physical fix, her backyard -- the prose gives real tool-level
  hints here (L4 in-domain).
- Branch B, comms (2 nodes): the SOS is a forced spine beat (onEnter during the
  emergency -- protocol response, correct, the address field auto-fills with the
  sector coordinator's vessel name; the player watches it fill). After the fix: flag
  half: **retraction_filed** -- she gets through the half-known UI by reading the
  manual. The board takes it on the second try. CONFIRMED, says the screen (spine
  beat; rule 5). She lets her shoulders down.
- Escape (`out`): end-of-rotation handoff, emergency resolved + retraction filed. The
  final node is the arc's last image: the board shows the queue, one entry, patient.
  She files her voice where the station files everything it has promised to finish.

Endings: dead x2 (gentle, both physical, both her own emergency):
- `end_spike`: wrong bleed sequence -- secondary pressure spike seals the crawlspace
  with her inside, one door short of the valve. Anchor: the manual still open to the
  wrong page.
- `end_cascade`: she fights the comms UI first and fixes the fault late. Anchor: the
  sensor she ignored, steady at last.

watching: `"RETRACTION QUEUED BEHIND PARENT."`, `"CONFIRMED."`, `"AWAITING
ACKNOWLEDGMENT."` (protocol lines only -- the station is innocent here; the menace in
these is supplied entirely by the player).

Import-gated optional beats:
- `heard_the_seams`: recording the SOS, the loopback monitor plays her voice back a
  half-beat late -- ordinary comms hardware; the player hears the first seam.
- `anomaly_filed`: the ops binder holds a blank anomaly-report template; she flips past
  it. The only report that will ever matter is filed twenty years from now, by her.

Sanity economy: forced ~20-25; 1 medgel. Gentle -- the chapter's weight is dramatic
irony, not attrition.

---

## Manifest entry (replaces the tycho placeholder, same menu position)

```jsonc
{ "adventure": "tycho", "title": "SIGNAL LOST",
  "byline": "Relay station Tycho-4. The distress call is in your own voice.",
  "chapters": [
    { "file": "tycho-delivery.json",
      "exports": ["read_the_address", "partial_handshake", "heard_it_refined", "pulled_the_packet"] },
    { "file": "tycho-migration.json", "unlock": { "type": "escape" },
      "imports": ["read_the_address", "partial_handshake", "prior_escape"],
      "exports": ["heard_the_seams", "anomaly_filed", "kept_the_log", "answered_it"] },
    { "file": "tycho-retraction.json", "unlock": { "type": "escape" },
      "imports": ["heard_the_seams", "anomaly_filed", "prior_escape"] }
  ] }
```

(`heard_it_refined`, `pulled_the_packet`, `kept_the_log`, `answered_it` are declared
ahead of need -- chapter authoring may bind or drop them; drop unused ones before merge
to avoid dead-export warns.)

## Authoring order and logistics

1. Author in **played order** (delivery -> migration -> retraction): exports must exist
   before imports bind, and the dread ladder is calibrated against what the player has
   already seen.
2. Each chapter must validate standalone AND with zero imports reach a survivable
   escape (the contract; `tools/adventure.mjs` enforces it). Imports gate only the
   optional beats listed above.
3. The manifest adventure entry needs >= 2 chapters to validate -- keep the locked
   placeholder until all three chapters are done, then swap in one commit.
4. New item labels for `engine/item-names.json`: packet cartridge, log sled, bleed
   valve key (final names at authoring time).
5. Per-chapter `design` blocks: derive from the arc block above (the proposal in
   `docs/proposals/author-episode-SKILL-changes.md` is not yet implemented in the
   validator; include the block as authoring input regardless).
6. After the arc ships: write craft lesson **L19** (reverse chronology -- the dread
   ladder, canonical-escape unlocks, the origin-escape-must-be-the-seeding-act rule,
   carryover as dramatic irony).

## Station geography ledger (canon across all three chapters; update as-built)

Same rooms, thirty-one years apart. Chapters may rename nothing; wear and signage may
change, the bones may not.

- **docking berth + shuttle clamp** -- single berth; the clamp defers to the airlock
  sequencer (ch1) / standard clearance (ch2/ch3)
- **operations deck** -- the board, the binder shelf; hub in ch1 and ch3
- **core room / rack bay** -- routing core, daemon rack, speakers overhead; hub in ch2
- **lower spine corridor** -- the long walk; junction with the habitual left turn;
  routing node at the far end (ch1 branch A)
- **archive** -- tape racks, cold, climate-flat air; medgel ch1; log sled ch2
- **workshop + maintenance crawlspace** -- reactor-adjacent, coolant runs, the bleed
  valve antechamber (ch3 branch A; the crawlspace seal fault is original to ch3)
- **EVA lock + mast** -- exterior transmitter array above the drum, reached by
  climbing; the dish can slew under daemon control (ch1 branch B)
- **med bay / crew quarters** -- medgels, personal effects

## As-built appendix (append ~5-10 lines per chapter when it ships)

For each finished chapter record: final node ids for endings, which declared exports
actually got bound (drop unused from the manifest), any geography or terminology added
to canon, actual forced-loss number from the validator, and anything the next chapter
must honor. The next chapter's session reads THIS FILE ONLY -- never the prior
chapter's full JSON.

## Register specimens (approved tone; redraft at authoring)

DELIVERY, the spine corridor: "The lights come on ahead of you. Not behind - ahead.
The corridor is lit to the junction before you reach it, and at the junction the left
branch is lit, because you always take the left. You stop walking. The left stays lit.
After a moment the right goes dark, unhurried, the way a thing finishes a sentence it
already knows the end of."

MIGRATION, mid-swap: "Every speaker on the deck opens at once. Your own voice - but cut
and rejoined, the breaths in the wrong places, four words you said once and then a
join, and then a word you say often. It gets your name almost right. It stops the way
something stops when it has your attention and does not yet know what to do with it."

RETRACTION, the screen: "The board takes the retraction on the second try. CONFIRMED,
the screen says. You are twenty-two and you read CONFIRMED and you let your shoulders
down, because you do not yet know the difference between confirmed and delivered."

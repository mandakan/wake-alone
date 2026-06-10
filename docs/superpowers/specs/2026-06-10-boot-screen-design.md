# Boot screen, typed tagline, menu drone -- design

Date: 2026-06-10. Status: approved (brainstorm session).

## Goal

A landing/boot screen the player clicks past to reach the salvage menu. The click is the
browser autoplay gesture, so it unlocks audio: a quiet spaceship drone under the menu, and
the manifest tagline ("an anthology of small dark rooms in deep space") typed out character
by character with telemetry blips into the existing blinking-cursor line.

## 1. Boot screen (new pre-route state)

On every fresh page load, before any routing, `bootScreen()` renders instead of the menu:
a short in-fiction POST scroll, lines appearing one by one (~200ms apart, silent -- the
browser cannot play sound before a gesture, which the fiction absorbs):

```
SKEIN RUNTIME v1.4.0          <- real VERSION injected at build
MEM CHECK ............ OK
PHOSPHOR ............. OK
NEURAL LINK .......... DEGRADED
AUDIO BUS ............ WAITING

> PRESS ANY KEY TO WAKE_      <- existing blinking .cursor
```

Behavior:

- A click or keypress mid-scroll completes the scroll instantly to the prompt.
- The next click/keypress is the wake gesture: `AUDIO.init()`, one boot beep, the
  `AUDIO BUS` line flips `WAITING -> OK`, a ~400ms beat, then route.
- Deep links pass through: a load with `#episode-id` boots first, then lands in the
  episode (full `wake()`) instead of the menu.
- Returning to the menu from an episode does NOT re-boot. The boot screen gates fresh
  loads only (module-level `booted` flag).
- `prefers-reduced-motion`: render the whole POST at once with the prompt ready.
- POST line copy is draft fiction; `NEURAL LINK .......... DEGRADED` carries the theme
  (something is already wrong before you start). Exact lines tunable at implementation.

## 2. Menu type-out

- The FIRST menu render after boot starts the subtitle line empty (cursor already
  blinking) and types `MANIFEST.subtitle` char by char, ~45ms/char with slight jitter:
  one blip per visible character, silence on spaces, a lower blip on punctuation.
- Episode cards are held at opacity 0 and fade in when the line completes.
- A click mid-typing completes the line instantly (and shows the cards).
- Subsequent menu renders (abort from episode, hashchange to empty) render fully
  formed, no re-type -- exactly as today (`menuTyped` flag).
- `prefers-reduced-motion`: no type-out; full render.
- Muted players get the full visual ritual, silent.

## 3. Audio: one new scene + one new voice (engine/skein-audio.js)

- **Menu scene.** A third level between `sleep()` and `wake()`: `menu()` -- the SAME
  drone graph at roughly a third of play volume with dread-gated voices held at calm
  (no tritone, no sub rumble). The drone fades up under the type-out. Entering an
  episode is the existing `wake()`, so menu -> episode is a continuous swell, not a
  hard start. `titleScreen()` switches `AUDIO.sleep()` to `AUDIO.menu()` (the old
  "the salvage menu is silent" decision is deliberately reversed).
- **Blip voice.** `blip(kind)`: one lazily-built triangle synth through a lowpass,
  ~30ms envelope, 700-900Hz with a few cents of random drift per character so it never
  sounds sequenced. `kind: 'punct'` drops roughly a fifth; `kind: 'boot'` is the
  slightly longer audio-bus-OK beep. Routed pre-master so mute and the volume pref
  apply. Dull telemetry register -- a machine printing to itself, not performing.
- A blip row goes into `tools/audio-bench.html` for tuning by ear.

## 4. What does not change

No episode schema, no validator, no build changes (audio already inlined by build).
Existing mute pref respected. Raw template without audio (`AUDIO === null`) still boots,
soundlessly -- every audio call site stays guarded. Lab mode and scars untouched.

## 5. Files touched

- `engine/template.html` -- boot screen, route gate, typewriter, menu first-render mode.
- `engine/skein-audio.js` -- menu scene, blip voice.
- `tools/audio-bench.html` -- blip trigger row.

## Decisions log (brainstorm answers)

1. Landing feel: **boot/POST sequence** (over dead-terminal and title-first gate).
2. Type-out location: **on the menu** (POST itself stays silent pre-click; the first
   audible beep is the audio bus coming up).
3. Boot policy: **every load, fast + skippable**; deep links pass through; no re-boot
   on abort-to-menu.
4. Menu drone: **same drone, distant** (~1/3 volume, calm-locked) -- not a distinct
   menu bed, not beeps-only.
5. Beep voice: **dull telemetry blips** (over classic terminal beep and
   pitch-follows-text motif).
